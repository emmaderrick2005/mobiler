import { useEffect, useState } from "react";
import api from "../../api";
import socket from "../../socket";
import { useAuth } from "../../context/AuthContext";
import LocationGate from "../../components/LocationGate";
import VerificationGate from "../../components/VerificationGate";
import StatusBadge from "../../components/StatusBadge";
import ThemeToggle from "../../components/ThemeToggle";

function formatMoney(n) {
  return Number(n).toLocaleString();
}

function CountdownBadge({ deadline }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((new Date(deadline) - Date.now()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((new Date(deadline) - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return <span className="countdown">{secondsLeft}s to respond</span>;
}

export default function AgentDashboard() {
  return (
    <VerificationGate>
      <LocationGate>{(location) => <AgentDashboardContent location={location} />}</LocationGate>
    </VerificationGate>
  );
}

function AgentDashboardContent({ location }) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [offers, setOffers] = useState([]);
  const [active, setActive] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // The server rejects /complete unless a call was logged for the job — this
  // just triggers that log alongside opening the dialer.
  async function markCalled(id) {
    await api.post(`/requests/${id}/call`);
    await loadAll();
  }

  async function loadAll() {
    const [{ data: p }, { data: o }, { data: a }] = await Promise.all([
      api.get("/agents/me"),
      api.get("/requests/offers/mine"),
      api.get("/requests/active/mine"),
    ]);
    setProfile(p);
    setOffers(o);
    setActive(a);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    function onOffer() {
      loadAll();
    }
    function onUpdate() {
      loadAll();
    }
    socket.on("request:offer", onOffer);
    socket.on("request:update", onUpdate);
    return () => {
      socket.off("request:offer", onOffer);
      socket.off("request:update", onUpdate);
    };
  }, []);

  async function saveProfile(patch) {
    setSavingProfile(true);
    try {
      const { data } = await api.patch("/agents/me", patch);
      setProfile(data);
    } finally {
      setSavingProfile(false);
    }
  }

  // Keep the agent's broadcast location in sync with their device location.
  useEffect(() => {
    if (!profile) return;
    if (profile.lat === location.lat && profile.lng === location.lng) return;
    saveProfile({ lat: location.lat, lng: location.lng });
  }, [profile, location.lat, location.lng]);

  async function respond(id, action) {
    const offer = offers.find((r) => r.id === id);
    await api.post(`/requests/${id}/${action}`);
    // Accepting a job immediately opens the dialer and logs the call
    // server-side — the /complete endpoint refuses to run without it.
    if (action === "accept" && offer?.customerContact?.phone) {
      await api.post(`/requests/${id}/call`);
      window.location.href = `tel:${offer.customerContact.phone}`;
    }
    await loadAll();
  }

  async function complete(id) {
    await api.post(`/requests/${id}/complete`);
    await loadAll();
  }

  if (!profile) return <div className="dashboard"><p>Loading...</p></div>;

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
          <h2>Your availability</h2>
          <label className="switch-row">
            <span>Online (visible to customers)</span>
            <input
              type="checkbox"
              checked={profile.isOnline}
              onChange={(e) => saveProfile({ isOnline: e.target.checked })}
            />
          </label>

          <label>Cash on hand</label>
          <input
            type="number"
            value={profile.cashOnHand}
            onChange={(e) => setProfile((p) => ({ ...p, cashOnHand: e.target.value }))}
            onBlur={(e) => saveProfile({ cashOnHand: e.target.value })}
          />

          <label>Airtel Money float</label>
          <input
            type="number"
            value={profile.airtelFloat}
            onChange={(e) => setProfile((p) => ({ ...p, airtelFloat: e.target.value }))}
            onBlur={(e) => saveProfile({ airtelFloat: e.target.value })}
          />

          <label>MTN Mobile Money float</label>
          <input
            type="number"
            value={profile.mtnFloat}
            onChange={(e) => setProfile((p) => ({ ...p, mtnFloat: e.target.value }))}
            onBlur={(e) => saveProfile({ mtnFloat: e.target.value })}
          />

          <label>Service radius (km)</label>
          <input
            type="number"
            min="1"
            value={profile.radiusKm}
            onChange={(e) => setProfile((p) => ({ ...p, radiusKm: e.target.value }))}
            onBlur={(e) => saveProfile({ radiusKm: e.target.value })}
          />

          <label>Your location</label>
          <p className="muted">Detected automatically: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
          {savingProfile && <p className="muted">Saving...</p>}
        </section>

        <section className="card">
          <h2>Incoming requests</h2>
          {offers.length === 0 && <p className="muted">No pending offers.</p>}
          <ul className="request-list">
            {offers.map((r) => (
              <li key={r.id} className="request-item">
                <div className="request-row">
                  <strong>{r.type === "WITHDRAW" ? "Withdraw" : "Deposit"} UGX {formatMoney(r.amount)} · {r.network === "AIRTEL" ? "Airtel Money" : "MTN MoMo"}</strong>
                  <StatusBadge status={r.status} />
                </div>
                {r.note && <p className="muted">{r.note}</p>}
                {r.customerContact && (
                  <div className="call-confirm">
                    <p className="muted">Call {r.customerContact.name} to confirm the order before accepting.</p>
                    <a className="call-button" href={`tel:${r.customerContact.phone}`}>
                      Call {r.customerContact.phone}
                    </a>
                  </div>
                )}
                <CountdownBadge deadline={r.acceptDeadline} />
                <div className="actions">
                  <button onClick={() => respond(r.id, "accept")}>Accept</button>
                  <button className="secondary" onClick={() => respond(r.id, "decline")}>Decline</button>
                </div>
              </li>
            ))}
          </ul>

          <h2>Active jobs</h2>
          {active.length === 0 && <p className="muted">No active jobs.</p>}
          <ul className="request-list">
            {active.map((r) => (
              <li key={r.id} className="request-item">
                <div className="request-row">
                  <strong>{r.type === "WITHDRAW" ? "Withdraw" : "Deposit"} UGX {formatMoney(r.amount)} · {r.network === "AIRTEL" ? "Airtel Money" : "MTN MoMo"}</strong>
                  <StatusBadge status={r.status} />
                </div>
                {r.customerContact && (
                  <div className="call-confirm">
                    <p className="agent-contact">Customer: {r.customerContact.name}</p>
                    {!r.calledAt && (
                      <p className="warn">You must call the customer before you can complete this job.</p>
                    )}
                    <a
                      className="call-button"
                      href={`tel:${r.customerContact.phone}`}
                      onClick={() => markCalled(r.id)}
                    >
                      Call {r.customerContact.phone}
                    </a>
                  </div>
                )}
                <button
                  onClick={() => complete(r.id)}
                  disabled={!r.calledAt}
                  title={r.calledAt ? undefined : "Call the customer first"}
                >
                  Mark as completed
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
