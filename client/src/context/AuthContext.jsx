import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";
import { connectSocket, disconnectSocket } from "../socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (user) connectSocket(user.id);
    return () => disconnectSocket();
  }, [user?.id]);

  function setSession(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    return setSession(data);
  }

  async function register(fields) {
    // Registration no longer logs the user in directly: the server creates
    // the account unverified and sends an OTP, so this returns the pending
    // verification info instead of a session.
    const { data } = await api.post("/auth/register", fields);
    return data;
  }

  async function verifyOtp(userId, code) {
    const { data } = await api.post("/auth/verify-otp", { userId, code });
    return setSession(data);
  }

  async function resendOtp(userId) {
    const { data } = await api.post("/auth/resend-otp", { userId });
    return data;
  }

  async function forgotPassword(email) {
    const { data } = await api.post("/auth/forgot-password", { email });
    return data;
  }

  async function resetPassword(userId, code, newPassword) {
    const { data } = await api.post("/auth/reset-password", { userId, code, newPassword });
    return setSession(data);
  }

  // Returns the logged-in user on success, or { needsProfile, email, name }
  // if this Google account isn't registered yet — the caller routes to a
  // short profile-completion step in that case.
  async function googleAuth(credential) {
    const { data } = await api.post("/auth/google", { credential });
    if (data.needsProfile) return data;
    return setSession(data);
  }

  async function googleComplete(credential, phone, role) {
    const { data } = await api.post("/auth/google/complete", { credential, phone, role });
    return setSession(data);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    disconnectSocket();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        verifyOtp,
        resendOtp,
        forgotPassword,
        resetPassword,
        googleAuth,
        googleComplete,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
