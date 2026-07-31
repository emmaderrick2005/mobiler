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

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
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
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function resendOtp(userId) {
    const { data } = await api.post("/auth/resend-otp", { userId });
    return data;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    disconnectSocket();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, verifyOtp, resendOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
