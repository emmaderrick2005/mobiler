import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../utils/roleHome";

export default function RequireAuth({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={roleHome(user.role)} replace />;
  }
  return children;
}
