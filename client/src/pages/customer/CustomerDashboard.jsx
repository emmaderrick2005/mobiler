import { useEffect, useState } from "react";
import api from "../../api";
import socket from "../../socket";
import { useAuth } from "../../context/AuthContext";
import LocationGate from "../../components/LocationGate";
import StatusBadge from "../../components/StatusBadge";
import ThemeToggle from "../../components/ThemeToggle";
import { MIN_AMOUNT } from "../../utils/limits";

function formatMoney(n) {
  return Number(n).toLocaleString();
}

export default function CustomerDashboard() {
  return <LocationGate>{(location) => <CustomerDashboardContent location={location} />}</LocationGate>;
}

function CustomerDashboardContent({ location }) {
  const { user, logout } = useAuth();
  const [type, setType] = useState("WITHDRAW");
  const [network, setNetwork] = useState("AIRTEL");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadRequests() {
    const { data } = await api.get("/requests/mine");
    setRequests(data);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    function onUpdate(updated) {
      setRequests((prev) => {
        const exists = prev.some((r) => r.id === updated.id);
        if (!exists) return [updated, ...prev];
        // Full replace, not a merge: the server payload is authoritative for
        // which fields (e.g. agentContact) are valid for the new status.
        return prev.map((r) => (r.id === updated.id ? updated : r));
      });
    }
    socket.on("request:update", onUpdate);
    return () => socket.off("request:update", onUpdate);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const minAmount = MIN_AMOUNT[type];
    if (!amount || Number(amount) < minAmount) {
      setError(
        `${type === "WITHDRAW" ? "Withdrawal" : "Deposit"} amount must be at least UGX ${minAmount.toLocaleString()}`
      );
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/requests", {
        type,
        network,
        amount: Number(amount),
        lat: location.lat,
        lng: location.lng,
        note,
      });
      setAmount("");
      setNote("");
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.error || "Could not create request");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRequest(id) {
    await api.post(`/requests/${id}/cancel`);
    await loadRequests();
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

      <div className="grid">
        <section className="card">
          <h2>Request cash</h2>
          <form onSubmit={handleSubmit}>
            <label>Type</label>
            <div className="role-toggle">
              <button type="button" className={type === "WITHDRAW" ? "active" : ""} onClick={() => setType("WITHDRAW")}>Withdraw</button>
              <button type="button" className={type === "DEPOSIT" ? "active" : ""} onClick={() => setType("DEPOSIT")}>Deposit</button>
            </div>
            <label>Network</label>
            <div className="role-toggle">
              <button type="button" className={network === "AIRTEL" ? "active" : ""} onClick={() => setNetwork("AIRTEL")}>Airtel Money</button>
              <button type="button" className={network === "MTN" ? "active" : ""} onClick={() => setNetwork("MTN")}>MTN MoMo</button>
            </div>
            <label>Amount</label>
            <input
              type="number"
              min={MIN_AMOUNT[type]}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="muted">Minimum UGX {MIN_AMOUNT[type].toLocaleString()}</p>
            <label>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. meet at the gate" />
            <p className="muted">Meeting point: your current location ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</p>
            {error && <p className="error">{error}</p>}
            <button disabled={submitting} type="submit">{submitting ? "Sending..." : "Find an agent"}</button>
          </form>
        </section>

        <section className="card">
          <h2>My requests</h2>
          {requests.length === 0 && <p className="muted">No requests yet.</p>}
          <ul className="request-list">
            {requests.map((r) => (
              <li key={r.id} className="request-item">
                <div className="request-row">
                  <strong>{r.type === "WITHDRAW" ? "Withdraw" : "Deposit"} UGX {formatMoney(r.amount)} · {r.network === "AIRTEL" ? "Airtel Money" : "MTN MoMo"}</strong>
                  <StatusBadge status={r.status} />
                </div>
                {r.note && <p className="muted">{r.note}</p>}
                {r.status === "UNMATCHED" && (
                  <p className="warn">No agents available nearby right now. Still searching...</p>
                )}
                {r.agentContact && r.status === "ASSIGNED" && (
                  <p className="agent-contact">
                    Agent: {r.agentContact.name} will call you shortly on {r.agentContact.phone} to confirm.
                  </p>
                )}
                {r.agentContact && r.status !== "ASSIGNED" && (
                  <p className="agent-contact">
                    Agent: {r.agentContact.name} · {r.agentContact.phone}{" "}
                    <a href={`tel:${r.agentContact.phone}`}>Call</a>
                  </p>
                )}
                {["PENDING", "ASSIGNED", "UNMATCHED"].includes(r.status) && (
                  <button className="link danger" onClick={() => cancelRequest(r.id)}>Cancel</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
