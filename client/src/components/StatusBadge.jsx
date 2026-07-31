const COLORS = {
  PENDING: "#9ca3af",
  ASSIGNED: "#f59e0b",
  ACCEPTED: "#3b82f6",
  COMPLETED: "#22c55e",
  UNMATCHED: "#ef4444",
  CANCELLED: "#6b7280",
};

export default function StatusBadge({ status }) {
  return (
    <span
      style={{
        background: COLORS[status] || "#9ca3af",
        color: "white",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.3,
      }}
    >
      {status}
    </span>
  );
}
