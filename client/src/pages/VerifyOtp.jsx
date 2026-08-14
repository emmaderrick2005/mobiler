import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import { roleHome } from "../utils/roleHome";
import { maskEmail } from "../utils/maskEmail";

export default function VerifyOtp() {
  const { verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, email, devCode } = location.state || {};

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(devCode ? `Dev mode: your code is ${devCode}` : "");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!userId) navigate("/login", { replace: true });
  }, [userId, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await verifyOtp(userId, code.trim());
      navigate(roleHome(user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Could not verify code");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");
    try {
      const data = await resendOtp(userId);
      setInfo(data.devCode ? `Dev mode: your new code is ${data.devCode}` : "A new code was sent");
      setCooldown(60);
    } catch (err) {
      setError(err.response?.data?.error || "Could not resend code");
      if (err.response?.data?.retryAfter) setCooldown(err.response.data.retryAfter);
    }
  }

  if (!userId) return null;

  return (
    <div className="auth-card">
      <div className="header-actions" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <ThemeToggle />
      </div>
      <h1>Verify your email</h1>
      <p className="subtitle">
        Enter the 6-digit code we sent to {maskEmail(email)}
      </p>
      <form onSubmit={handleSubmit}>
        <label>Verification code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          required
        />
        {error && <p className="error">{error}</p>}
        {info && <p className="hint">{info}</p>}
        <button disabled={submitting || code.length !== 6} type="submit">
          {submitting ? "Verifying..." : "Verify"}
        </button>
      </form>
      <p className="switch">
        <button className="link" type="button" disabled={cooldown > 0} onClick={handleResend}>
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </button>
      </p>
    </div>
  );
}
