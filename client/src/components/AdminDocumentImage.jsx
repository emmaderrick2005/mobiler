import { useEffect, useState } from "react";
import api from "../api";

export default function AdminDocumentImage({ agentProfileId, type, label }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    api
      .get(`/verification/admin/${agentProfileId}/document/${type}`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [agentProfileId, type]);

  return (
    <div className="doc-thumb">
      <p className="muted">{label}</p>
      {error && <p className="error">Failed to load</p>}
      {url && <img src={url} alt={label} className="doc-preview" />}
      {!url && !error && <p className="muted">Loading...</p>}
    </div>
  );
}
