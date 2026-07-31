import { useEffect, useState } from "react";
import api from "../api";
import AgentVerificationForm from "../pages/agent/AgentVerificationForm";

export default function VerificationGate({ children }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/verification/me");
    setStatus(data);
  }

  useEffect(() => {
    load().catch(() => setError("Could not load verification status"));
  }, []);

  if (error) return <div className="auth-card"><p className="error">{error}</p></div>;
  if (!status) return <div className="auth-card"><h1>Loading...</h1></div>;

  if (status.verificationStatus === "PENDING") {
    return (
      <div className="auth-card">
        <h1>Verification pending</h1>
        <p className="subtitle">
          We've received your documents and face scan. An admin will review them shortly —
          you'll be able to go online as soon as you're approved.
        </p>
      </div>
    );
  }

  if (status.verificationStatus === "VERIFIED") {
    return children;
  }

  return (
    <AgentVerificationForm rejectionReason={status.rejectionReason} onSubmitted={load} />
  );
}
