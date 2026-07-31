import { useEffect, useRef, useState } from "react";

// Live webcam capture for the face-scan step, falling back to a plain photo
// upload if the browser/device has no usable camera.
export default function FaceScanCapture({ onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraError, setCameraError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) setCameraError(true);
      }
    }
    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      setPreviewUrl(URL.createObjectURL(blob));
      onCapture(blob);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }, "image/jpeg");
  }

  function retake() {
    setPreviewUrl(null);
    onCapture(null);
    streamRef.current = null;
    setCameraError(false);
  }

  function handleFallbackFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    onCapture(file);
  }

  if (previewUrl) {
    return (
      <div className="face-scan">
        <img src={previewUrl} alt="Captured face scan" className="face-scan-preview" />
        <button type="button" className="secondary" onClick={retake}>Retake</button>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="face-scan">
        <p className="muted">Camera unavailable — upload a clear selfie instead.</p>
        <input type="file" accept="image/*" capture="user" onChange={handleFallbackFile} />
      </div>
    );
  }

  return (
    <div className="face-scan">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} autoPlay playsInline muted className="face-scan-video" />
      <button type="button" onClick={capture}>Capture photo</button>
    </div>
  );
}
