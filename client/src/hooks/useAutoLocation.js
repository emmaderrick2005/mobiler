import { useCallback, useEffect, useState } from "react";
import { getCurrentPosition } from "../geolocation";

// Used when the browser can't or won't provide a real position (permission
// denied, unsupported, or no hardware) so testing/demoing isn't blocked.
const FALLBACK_LOCATION = { lat: 0.3476, lng: 32.5825 };

// Requests the device's location automatically on mount. Falls back to a
// default location (with a flag so the UI can warn about it) rather than
// blocking the app outright.
export function useAutoLocation() {
  const [state, setState] = useState({ status: "loading", lat: null, lng: null, isFallback: false });

  const attempt = useCallback(() => {
    setState({ status: "loading", lat: null, lng: null, isFallback: false });
    getCurrentPosition()
      .then(({ lat, lng }) => setState({ status: "ready", lat, lng, isFallback: false }))
      .catch(() => setState({ status: "ready", ...FALLBACK_LOCATION, isFallback: true }));
  }, []);

  useEffect(() => {
    attempt();
  }, [attempt]);

  return { ...state, retry: attempt };
}
