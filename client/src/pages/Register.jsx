import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, validatePassword } from "../utils/validatePassword";
import { roleHome } from "../utils/roleHome";

export default function Register() {
  const { register, googleAuth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "CUSTOMER" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleGoogle(credential) {
    setError("");
    try {
      const result = await googleAuth(credential);
      if (result.needsProfile) {
        navigate("/complete-google-profile", {
          state: { credential, email: result.email, name: result.name, role: form.role },
        });
        return;
      }
      // A Google account matching an already-registered email just signs in.
      navigate(roleHome(result.role));
    } catch (err) {
      setError(err.response?.data?.error || "Google sign-in failed");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setLoading(true);
    try {
      const data = await register(form);
      navigate("/verify-otp", {
        state: { userId: data.userId, email: data.email, devCode: data.devCode },
      });
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="header-actions" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <ThemeToggle />
      </div>
      <h1>Create account</h1>
      <form onSubmit={handleSubmit}>
        <label>I am a</label>
        <div className="role-toggle">
          <button type="button" className={form.role === "CUSTOMER" ? "active" : ""} onClick={() => update("role", "CUSTOMER")}>Customer</button>
          <button type="button" className={form.role === "AGENT" ? "active" : ""} onClick={() => update("role", "AGENT")}>Agent</button>
        </div>
        <label>Name</label>
        <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
        <label>Email</label>
        <input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" required />
        <label>Phone</label>
        <input value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
        <label>Password</label>
        <input
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
        />
        <p className="hint">{PASSWORD_HINT}</p>
        {error && <p className="error">{error}</p>}
        <button disabled={loading} type="submit">{loading ? "Creating..." : "Create account"}</button>
      </form>
      <GoogleSignInButton onCredential={handleGoogle} onError={setError} />
      <p className="switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
