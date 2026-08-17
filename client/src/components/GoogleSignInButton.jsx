import { GoogleLogin } from "@react-oauth/google";

// Renders nothing if Google OAuth isn't configured (no VITE_GOOGLE_CLIENT_ID)
// rather than crashing — lets the rest of auth work without it set up.
export default function GoogleSignInButton({ onCredential, onError }) {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  return (
    <div className="google-signin">
      <div className="divider">
        <span>or</span>
      </div>
      <GoogleLogin
        onSuccess={(credentialResponse) => onCredential(credentialResponse.credential)}
        onError={() => onError?.("Google sign-in failed")}
        width="100%"
      />
    </div>
  );
}
