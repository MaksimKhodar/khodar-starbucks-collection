function ConfirmModal({
  isOpen = false,
  title = "",
  message = "",
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 1200,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
          border: "1px solid #e5e7eb",
          padding: "24px",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 10px 0", fontSize: "22px", color: "#111827" }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 22px 0", color: "#4b5563", lineHeight: 1.6 }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#111827",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid transparent",
              background: danger ? "#b91c1c" : "#1f6f54",
              color: "#ffffff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
