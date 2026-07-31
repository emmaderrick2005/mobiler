import { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../../components/ThemeToggle";
import AdminDocumentImage from "../../components/AdminDocumentImage";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState([]);
  const [reasons, setReasons] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const { data } = await api.get("/verification/admin/pending");
    setPending(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id) {
    setBusyId(id);
    try {
      await api.post(`/verification/admin/${id}/approve`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id) {
    const reason = reasons[id]?.trim();
    if (!reason) return;
    setBusyId(id);
    try {
      await api.post(`/verification/admin/${id}/reject`, { reason });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Hi, {user.name}</h1>
        <div className="header-actions">
          <ThemeToggle />
          <button className="link" onClick={logout}>Log out</button>
        </div>
      </header>

      <section className="card">
        <h2>Pending agent verifications</h2>
        {pending.length === 0 && <p className="muted">No agents waiting for review.</p>}
        <ul className="request-list">
          {pending.map((p) => (
            <li key={p.agentProfileId} className="request-item">
              <div className="request-row">
                <strong>{p.name}</strong>
              </div>
              <p className="muted">{p.email} · {p.phone}</p>
              <p className="agent-contact">ID number: {p.nationalIdNumber}</p>
              <p className="muted">Submitted {new Date(p.submittedAt).toLocaleString()}</p>

              <div className="doc-grid">
                <AdminDocumentImage agentProfileId={p.agentProfileId} type="nationalId" label="National ID" />
                <AdminDocumentImage agentProfileId={p.agentProfileId} type="traderLicense" label="Trader license" />
                <AdminDocumentImage agentProfileId={p.agentProfileId} type="mobileMoneyLicense" label="Mobile money license" />
                <AdminDocumentImage agentProfileId={p.agentProfileId} type="faceScan" label="Face scan" />
              </div>

              <div className="actions">
                <button disabled={busyId === p.agentProfileId} onClick={() => approve(p.agentProfileId)}>
                  Approve
                </button>
              </div>

              <label>Rejection reason</label>
              <input
                value={reasons[p.agentProfileId] || ""}
                onChange={(e) => setReasons((r) => ({ ...r, [p.agentProfileId]: e.target.value }))}
                placeholder="Why is this being rejected?"
              />
              <button
                className="secondary"
                disabled={busyId === p.agentProfileId || !reasons[p.agentProfileId]?.trim()}
                onClick={() => reject(p.agentProfileId)}
              >
                Reject
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
