import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await forgotPassword(email.trim());
      navigate("/reset-password", {
        state: { userId: data.userId, email: data.email, devCode: data.devCode },
      });
    } catch (err) {
      setError(err.response?.data?.error || "Could not send a reset code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="header-actions" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <ThemeToggle />
      </div>
      <h1>Forgot password</h1>
      <p className="subtitle">
        Enter your account email and we'll send a reset code to that address.
      </p>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        {error && <p className="error">{error}</p>}
        <button disabled={submitting} type="submit">
          {submitting ? "Sending..." : "Send reset code"}
        </button>
      </form>
      <p className="switch">
        <Link to="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
