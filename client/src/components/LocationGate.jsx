import { useAutoLocation } from "../hooks/useAutoLocation";

// Detects the device's location automatically on mount. If the browser
// won't provide one (denied/unsupported), falls back to a default location
// with a warning instead of blocking the app.
export default function LocationGate({ children }) {
  const location = useAutoLocation();

  if (location.status === "loading") {
    return (
      <div className="auth-card">
        <h1>Finding your location...</h1>
        <p className="subtitle">Allow location access when your browser asks.</p>
      </div>
    );
  }

  return (
    <>
      {location.isFallback && (
        <div className="location-warning">
          Couldn't get your device location, so we're using a default one for now.{" "}
          <button type="button" className="link" onClick={location.retry}>Try again</button>
        </div>
      )}
      {children(location)}
    </>
  );
}
