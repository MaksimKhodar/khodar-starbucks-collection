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

function base64UrlToUint8Array(base64Url: string) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyToken(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, payload: null };
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const data = `${headerEncoded}.${payloadEncoded}`;

  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const isValid = await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    base64UrlToUint8Array(signatureEncoded),
    encoder.encode(data)
  );

  if (!isValid) {
    return { valid: false, payload: null };
  }

  try {
    const payloadJson = new TextDecoder().decode(
      base64UrlToUint8Array(payloadEncoded)
    );
    const payload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && now > payload.exp) {
      return { valid: false, payload: null };
    }

    if (payload?.role !== "admin") {
      return { valid: false, payload: null };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, payload: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signingSecret = Deno.env.get("ADMIN_SIGNING_SECRET");

  if (!signingSecret) {
    return jsonResponse(
      { ok: false, error: "Admin secrets are not configured" },
      500
    );
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    return jsonResponse({ ok: false, error: "Missing token" }, 401);
  }

  const result = await verifyToken(token, signingSecret);

  if (!result.valid) {
    return jsonResponse({ ok: false, error: "Invalid token" }, 401);
  }

  return jsonResponse({
    ok: true,
    payload: result.payload,
  });
});