import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function base64UrlEncode(input: string) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signToken(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };

  const encoder = new TextEncoder();
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerEncoded}.${payloadEncoded}`;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(data)
  );

  const signature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${data}.${signature}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const adminPassword = Deno.env.get("ADMIN_PASSWORD");
  const signingSecret = Deno.env.get("ADMIN_SIGNING_SECRET");

  if (!adminPassword || !signingSecret) {
    return jsonResponse(
      {
        ok: false,
        error: "Admin secrets are not configured",
        debug: {
          hasAdminPassword: !!adminPassword,
          hasSigningSecret: !!signingSecret,
        },
      },
      500
    );
  }

  try {
    const body = await req.json();
    const password = String(body?.password || "");

    if (!password || password !== adminPassword) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid password",
          debug: {
            hasAdminPassword: !!adminPassword,
            hasSigningSecret: !!signingSecret,
            receivedPasswordLength: password.length,
            storedPasswordLength: adminPassword.length,
          },
        },
        401
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 60 * 60 * 24 * 30;

    const token = await signToken(
      {
        role: "admin",
        iat: now,
        exp: expiresAt,
      },
      signingSecret
    );

    return jsonResponse({
      ok: true,
      token,
      expiresAt,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      500
    );
  }
});