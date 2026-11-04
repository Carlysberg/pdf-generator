"use client";

import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from "react";

const ACCEPTED = "image/jpeg,image/png,image/webp";
const CARD_ASPECT = 85.6 / 53.98; // ISO/IEC 7810 ID-1 card ratio

export default function Home() {
  const [name, setName] = useState("");
  const [indexNumber, setIndexNumber] = useState("");
  const [programOfStudy, setProgramOfStudy] = useState("");
  const [ghanaCardNumber, setGhanaCardNumber] = useState("");
  const [images, setImages] = useState<[File | null, File | null]>([null, null]);
  const [previews, setPreviews] = useState<[string | null, string | null]>([null, null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1] as const;

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<0 | 1>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (cameraOpen && video && streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
  }, [cameraOpen]);

  async function openCamera(index: 0 | 1) {
    setCameraTarget(index);
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera is unavailable. Open the site over HTTPS (or localhost) and allow camera access.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError("Could not access camera. Please check permissions.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!video || !canvas || !frame || !video.videoWidth) return;

    // The video is shown with object-cover, so map the on-screen frame back to video pixels.
    const vr = video.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const scale = Math.max(vr.width / video.videoWidth, vr.height / video.videoHeight);
    const offX = (vr.width - video.videoWidth * scale) / 2;
    const offY = (vr.height - video.videoHeight * scale) / 2;
    const sx = (fr.left - vr.left - offX) / scale;
    const sy = (fr.top - vr.top - offY) / scale;
    const sw = fr.width / scale;
    const sh = fr.height / scale;

    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${cameraTarget + 1}.jpg`, { type: "image/jpeg" });
        pickImage(cameraTarget, file);
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  }

  function pickImage(index: 0 | 1, file: File | null) {
    if (file && !file.type.startsWith("image/")) {
      setError("Please upload an image file (JPEG, PNG, or WebP).");
      return;
    }
    setImages((prev) => {
      const next = [...prev] as [File | null, File | null];
      next[index] = file;
      return next;
    });
    if (previews[index]) URL.revokeObjectURL(previews[index]!);
    setPreviews((prev) => {
      const next = [...prev] as [string | null, string | null];
      next[index] = file ? URL.createObjectURL(file) : null;
      return next;
    });
    setError("");
  }

  function onDrop(index: 0 | 1, e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) pickImage(index, file);
  }

  function onFileChange(index: 0 | 1, e: ChangeEvent<HTMLInputElement>) {
    pickImage(index, e.target.files?.[0] ?? null);
  }

  function removeImage(index: 0 | 1) {
    pickImage(index, null);
    const input = refs[index].current;
    if (input) input.value = "";
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter a name."); return; }
    if (!indexNumber.trim()) { setError("Please enter an index number."); return; }
    if (!programOfStudy.trim()) { setError("Please enter a program of study."); return; }
    if (!ghanaCardNumber.trim()) { setError("Please enter a Ghana Card number."); return; }
    if (!images[0] || !images[1]) { setError("Please upload two photos."); return; }

    setLoading(true);
    setError("");

    const body = new FormData();
    body.append("name", trimmed);
    body.append("indexNumber", indexNumber.trim());
    body.append("programOfStudy", programOfStudy.trim());
    body.append("ghanaCardNumber", ghanaCardNumber.trim());
    body.append("image1", images[0]);
    body.append("image2", images[1]);

    try {
      const res = await fetch("/api/generate-pdf", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${trimmed.replace(/[\\/:*?"<>|]/g, "") || "document"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const ready =
    name.trim() &&
    indexNumber.trim() &&
    programOfStudy.trim() &&
    ghanaCardNumber.trim() &&
    images[0] &&
    images[1];

  return (
    <>
      {/* Camera modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              ref={frameRef}
              className="relative rounded-xl border-2 border-white pointer-events-none"
              style={{
                width: `min(85%, calc(70vh * ${CARD_ASPECT}))`,
                aspectRatio: `${CARD_ASPECT}`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
            />
            <p className="absolute top-4 left-0 right-0 text-center text-white text-sm font-medium drop-shadow-lg">
              Align your card within the frame
            </p>
          </div>
          <div className="bg-black/90 flex items-center justify-center gap-8 py-6 px-4">
            <button
              onClick={stopCamera}
              className="w-12 h-12 rounded-full border-2 border-white/60 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-colors"
            />
            <div className="w-12" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-800 text-center mb-1">
            PDF Generator
          </h1>
          <p className="text-slate-500 text-center text-sm mb-8">
            Fill in your details and upload two photos to generate an A4 PDF.
          </p>

          {/* Name */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Full name"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            />
          </label>

          {/* Index Number */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700">Index Number</span>
            <input
              type="text"
              value={indexNumber}
              onChange={(e) => setIndexNumber(e.target.value)}
              maxLength={30}
              placeholder="e.g. PS/ITC/22/0001"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            />
          </label>

          {/* Program of Study */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700">Program of Study</span>
            <input
              type="text"
              value={programOfStudy}
              onChange={(e) => setProgramOfStudy(e.target.value)}
              maxLength={100}
              placeholder="e.g. BSc Information Technology"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            />
          </label>

          {/* Ghana Card Number */}
          <label className="block mb-6">
            <span className="text-sm font-medium text-slate-700">Ghana Card Number</span>
            <input
              type="text"
              value={ghanaCardNumber}
              onChange={(e) => setGhanaCardNumber(e.target.value)}
              maxLength={20}
              placeholder="GHA-XXXXXXXXX-X"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            />
          </label>

          {/* Photos */}
          <p className="text-sm font-medium text-slate-700 mb-2">Photos</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {([0, 1] as const).map((i) => (
              <div key={i} className="relative">
                {previews[i] ? (
                  <div className="aspect-square rounded-lg overflow-hidden border border-slate-200">
                    <img
                      src={previews[i]!}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow transition-colors"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(i, e)}
                    className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 p-2"
                  >
                    <span className="text-xs text-slate-400">Photo {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => refs[i].current?.click()}
                      className="w-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md py-1.5 transition-colors flex items-center justify-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                      Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => openCamera(i)}
                      className="w-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md py-1.5 transition-colors flex items-center justify-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                      Camera
                    </button>
                  </div>
                )}
                <input
                  ref={refs[i]}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => onFileChange(i, e)}
                />
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-600 text-sm text-center mb-4">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !ready}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Generating…" : "Generate PDF"}
          </button>
        </div>
      </main>
    </>
  );
}
