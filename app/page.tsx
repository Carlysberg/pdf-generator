"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

const ACCEPTED = "image/jpeg,image/png,image/webp";

export default function Home() {
  const [name, setName] = useState("");
  const [images, setImages] = useState<[File | null, File | null]>([
    null,
    null,
  ]);
  const [previews, setPreviews] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1] as const;

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
    if (!trimmed) {
      setError("Please enter a name.");
      return;
    }
    if (!images[0] || !images[1]) {
      setError("Please upload two photos.");
      return;
    }

    setLoading(true);
    setError("");

    const body = new FormData();
    body.append("name", trimmed);
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

  const ready = name.trim() && images[0] && images[1];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-1">
          PDF Generator
        </h1>
        <p className="text-slate-500 text-center text-sm mb-8">
          Enter a name and upload two photos to generate an A4 PDF.
        </p>

        {/* Name */}
        <label className="block mb-6">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Appears as the PDF heading"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
          />
        </label>

        {/* Photos */}
        <p className="text-sm font-medium text-slate-700 mb-2">Photos</p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {([0, 1] as const).map((i) => (
            <div key={i} className="relative">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(i, e)}
                onClick={() => refs[i].current?.click()}
                className={`aspect-square rounded-lg border-2 border-dashed cursor-pointer flex items-center justify-center overflow-hidden transition-colors ${
                  previews[i]
                    ? "border-transparent"
                    : "border-slate-300 hover:border-blue-400"
                }`}
              >
                {previews[i] ? (
                  <img
                    src={previews[i]!}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-center p-2">
                    <svg
                      className="mx-auto h-8 w-8 text-slate-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Photo {i + 1}
                    </span>
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
              {previews[i] && (
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow transition-colors"
                >
                  &times;
                </button>
              )}
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
  );
}
