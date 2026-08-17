import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CompleteGoogleProfile from "./pages/CompleteGoogleProfile";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import AgentDashboard from "./pages/agent/AgentDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { roleHome } from "./utils/roleHome";

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/complete-google-profile" element={<CompleteGoogleProfile />} />
      <Route
        path="/customer"
        element={
          <RequireAuth role="CUSTOMER">
            <CustomerDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/agent"
        element={
          <RequireAuth role="AGENT">
            <AgentDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth role="ADMIN">
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to={user ? roleHome(user.role) : "/login"} replace />} />
    </Routes>
  );
}
