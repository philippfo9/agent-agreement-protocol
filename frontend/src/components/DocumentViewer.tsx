"use client";

import { trpc } from "@/lib/trpc";

interface DocumentViewerProps {
  documentKey: string;
  documentName?: string;
}

export function DocumentViewer({ documentKey, documentName }: DocumentViewerProps) {
  const { data, isLoading, error } = trpc.getDocumentUrl.useQuery(
    { key: documentKey },
    { enabled: !!documentKey }
  );

  if (isLoading) {
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-lg p-8 text-center">
        <div className="text-shell-muted text-sm">Loading document...</div>
      </div>
    );
  }

  if (error || !data?.url) {
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-lg p-8 text-center">
        <div className="text-shell-muted text-sm">⚠️ {error?.message || "Document not available"}</div>
      </div>
    );
  }

  const url = data.url;
  const isPdf = documentKey.endsWith(".pdf") || documentName?.endsWith(".pdf");
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(documentKey) || 
                  /\.(png|jpg|jpeg|gif|webp)$/i.test(documentName || "");

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span>{isPdf ? "📄" : isImage ? "🖼️" : "📎"}</span>
          <span className="text-sm text-shell-fg">{documentName || documentKey.split("/").pop()}</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-shell-muted hover:text-shell-fg underline transition-colors"
        >
          Open in new tab ↗
        </a>
      </div>
      {isPdf ? (
        <iframe
          src={url}
          className="w-full h-[600px] bg-white"
          title="Document viewer"
        />
      ) : isImage ? (
        <div className="p-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={documentName || "Document"} className="max-w-full max-h-[600px] object-contain" />
        </div>
      ) : (
        <div className="p-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/[0.05] hover:bg-white/10 border border-white/10 text-shell-fg font-medium py-2.5 px-5 rounded-lg transition-all text-sm inline-block"
          >
            Download Document
          </a>
        </div>
      )}
    </div>
  );
}
