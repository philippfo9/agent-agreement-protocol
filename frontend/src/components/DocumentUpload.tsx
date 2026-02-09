"use client";

import { useState, useRef } from "react";

interface UploadedDocument {
  key: string;
  url: string;
  hash: string;
  name: string;
  size: number;
  type: string;
}

interface DocumentUploadProps {
  onUpload: (doc: UploadedDocument) => void;
  document?: UploadedDocument | null;
}

export function DocumentUpload({ onUpload, document }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      onUpload(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (document) {
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{document.type === "application/pdf" ? "📄" : "📎"}</span>
            <div>
              <div className="text-sm text-shell-fg font-medium">{document.name}</div>
              <div className="text-xs text-shell-dim">{formatSize(document.size)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-shell-muted hover:text-shell-fg underline transition-colors"
            >
              View
            </a>
            <button
              onClick={() => onUpload(null as any)}
              className="text-xs text-shell-dim hover:text-shell-muted transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-shell-dim font-mono break-all">
          SHA-256: {document.hash}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-white/30 bg-white/[0.05]"
            : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.md"
          onChange={handleChange}
          className="hidden"
        />
        {uploading ? (
          <div className="text-shell-muted text-sm">Uploading...</div>
        ) : (
          <>
            <div className="text-3xl mb-2">📄</div>
            <div className="text-sm text-shell-muted mb-1">
              Drop a document here or click to browse
            </div>
            <div className="text-xs text-shell-dim">
              PDF, PNG, JPEG, TXT, MD — max 20MB
            </div>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 text-sm text-shell-muted">⚠️ {error}</div>
      )}
    </div>
  );
}
