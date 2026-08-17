import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { roleHome } from "../utils/roleHome";

export default function Login() {
  const { login, googleAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle(credential) {
    setError("");
    try {
      const result = await googleAuth(credential);
      if (result.needsProfile) {
        navigate("/complete-google-profile", {
          state: { credential, email: result.email, name: result.name },
        });
        return;
      }
      navigate(roleHome(result.role));
    } catch (err) {
      setError(err.response?.data?.error || "Google sign-in failed");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(roleHome(user.role));
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresOtp) {
        navigate("/verify-otp", {
          state: { userId: data.userId, email: data.email, devCode: data.devCode },
        });
        return;
      }
      setError(data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="header-actions" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <ThemeToggle />
      </div>
      <h1>Mobiler</h1>
      <p className="subtitle">Sign in to request or fulfil cash orders</p>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        {error && <p className="error">{error}</p>}
        <button disabled={loading} type="submit">{loading ? "Signing in..." : "Sign in"}</button>
      </form>
      <GoogleSignInButton onCredential={handleGoogle} onError={setError} />
      <p className="switch">
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
      <p className="switch">
        No account? <Link to="/register">Register</Link>
      </p>
      <p className="hint">Demo accounts: customer1@example.com / agent1@example.com (password123)</p>
    </div>
  );
}
