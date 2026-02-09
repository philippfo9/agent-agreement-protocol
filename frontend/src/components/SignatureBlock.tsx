"use client";

interface SignatureBlockProps {
  name: string;
  pubkey: string;
  signed: boolean;
  signedAt?: string;
  role: string;
}

export function SignatureBlock({ name, pubkey, signed, signedAt, role }: SignatureBlockProps) {
  return (
    <div className={`border rounded-lg p-5 transition-all ${
      signed 
        ? "border-white/20 bg-white/[0.03]" 
        : "border-dashed border-white/10 bg-white/[0.01]"
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-shell-dim uppercase tracking-wider mb-0.5">{role}</div>
          <div className="text-sm text-shell-fg font-medium">{name || "Unknown"}</div>
        </div>
        {signed ? (
          <div className="bg-white/10 text-shell-fg text-xs font-medium px-2.5 py-1 rounded">
            ✓ Signed
          </div>
        ) : (
          <div className="bg-white/[0.03] text-shell-dim text-xs font-medium px-2.5 py-1 rounded border border-dashed border-white/10">
            Pending
          </div>
        )}
      </div>

      {/* Signature line */}
      <div className="mt-4 pt-4 border-t border-white/10">
        {signed ? (
          <div>
            {/* Cursive signature effect using the name */}
            <div className="font-serif italic text-2xl text-shell-fg mb-1 tracking-wide" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
              {name || pubkey.slice(0, 12)}
            </div>
            <div className="text-[10px] text-shell-dim font-mono">{pubkey}</div>
            {signedAt && (
              <div className="text-[10px] text-shell-dim mt-1">{signedAt}</div>
            )}
          </div>
        ) : (
          <div>
            <div className="h-8 border-b border-dashed border-white/10 mb-2" />
            <div className="text-[10px] text-shell-dim font-mono">{pubkey}</div>
            <div className="text-[10px] text-shell-dim italic mt-1">Awaiting signature...</div>
          </div>
        )}
      </div>
    </div>
  );
}
