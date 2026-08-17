import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import { roleHome } from "../utils/roleHome";

export default function CompleteGoogleProfile() {
  const { googleComplete } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { credential, email, name, role: initialRole } = location.state || {};

  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(initialRole || "CUSTOMER");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!credential) navigate("/login", { replace: true });
  }, [credential, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await googleComplete(credential, phone, role);
      navigate(roleHome(user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Could not finish setting up your account");
    } finally {
      setSubmitting(false);
    }
  }

  if (!credential) return null;

  return (
    <div className="auth-card">
      <div className="header-actions" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <ThemeToggle />
      </div>
      <h1>Almost there</h1>
      <p className="subtitle">
        Welcome{name ? `, ${name}` : ""}. We just need a couple more details for {email}.
      </p>
      <form onSubmit={handleSubmit}>
        <label>I am a</label>
        <div className="role-toggle">
          <button type="button" className={role === "CUSTOMER" ? "active" : ""} onClick={() => setRole("CUSTOMER")}>Customer</button>
          <button type="button" className={role === "AGENT" ? "active" : ""} onClick={() => setRole("AGENT")}>Agent</button>
        </div>
        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button disabled={submitting} type="submit">
          {submitting ? "Finishing up..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
