import { useState } from "react";
import api from "../../api";
import FaceScanCapture from "../../components/FaceScanCapture";

function FilePreview({ file, label, onChange }) {
  const previewUrl = file ? URL.createObjectURL(file) : null;
  return (
    <div className="doc-upload">
      <label>{label}</label>
      {previewUrl && <img src={previewUrl} alt={label} className="doc-preview" />}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files[0] || null)}
      />
    </div>
  );
}

export default function AgentVerificationForm({ rejectionReason, onSubmitted }) {
  const [nationalIdNumber, setNationalIdNumber] = useState("");
  const [nationalId, setNationalId] = useState(null);
  const [traderLicense, setTraderLicense] = useState(null);
  const [mobileMoneyLicense, setMobileMoneyLicense] = useState(null);
  const [faceScan, setFaceScan] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!nationalIdNumber.trim() || !nationalId || !traderLicense || !mobileMoneyLicense || !faceScan) {
      setError("National ID number, all three documents, and a face scan are all required");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("nationalIdNumber", nationalIdNumber.trim());
      formData.append("nationalId", nationalId);
      formData.append("traderLicense", traderLicense);
      formData.append("mobileMoneyLicense", mobileMoneyLicense);
      formData.append("faceScan", faceScan, "faceScan.jpg");
      await api.post("/verification", formData);
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.error || "Could not submit verification");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card verification-card">
      <h1>Verify your account</h1>
      <p className="subtitle">
        Before you can go online and accept jobs, we need to confirm who you are.
      </p>
      {rejectionReason && (
        <p className="error">Your last submission was rejected: {rejectionReason}</p>
      )}
      <form onSubmit={handleSubmit}>
        <label>National ID number</label>
        <input
          value={nationalIdNumber}
          onChange={(e) => setNationalIdNumber(e.target.value)}
          placeholder="e.g. CM12345678ABC"
        />
        <FilePreview label="National ID" file={nationalId} onChange={setNationalId} />
        <FilePreview label="Trader license" file={traderLicense} onChange={setTraderLicense} />
        <FilePreview label="Mobile money license" file={mobileMoneyLicense} onChange={setMobileMoneyLicense} />
        <label>Face scan</label>
        <FaceScanCapture onCapture={setFaceScan} />
        {error && <p className="error">{error}</p>}
        <button disabled={submitting} type="submit">
          {submitting ? "Submitting..." : "Submit for verification"}
        </button>
      </form>
    </div>
  );
}
