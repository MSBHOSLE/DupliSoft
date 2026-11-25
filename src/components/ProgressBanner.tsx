import React from "react";
import { ScanProgress } from "../types";
import { formatBytes } from "../utils/formatters";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";

interface ProgressBannerProps {
  progress: ScanProgress;
  isScanning: boolean;
}

export const ProgressBanner: React.FC<ProgressBannerProps> = ({ progress, isScanning }) => {
  if (!isScanning && progress.phase !== "completed") return null;

  const phaseLabels: Record<string, string> = {
    indexing: "Stage 1: Traversal & File Size Grouping (zero byte reads)...",
    chunk_hashing: "Stage 2: Parallel 32KB Header/Trailer & Small-File Hashing...",
    full_hashing: "Stage 3: Multithreaded Cryptographic BLAKE3 Verification...",
    byte_verifying: "Stage 4: Strict 100% Byte-for-Byte Stream Verification...",
    completed: "Scan Complete — All duplicate groups cryptographically verified.",
  };

  return (
    <div className="bg-indigo-950/40 border-b border-indigo-500/20 px-6 py-2.5 select-none">
      <div className="flex items-center justify-between gap-4 text-xs mb-1.5">
        <div className="flex items-center space-x-2 min-w-0">
          {isScanning ? (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="font-semibold text-slate-200 truncate">
            {phaseLabels[progress.phase] || progress.phase}
          </span>
          {progress.phase === "byte_verifying" && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px] font-mono shrink-0">
              <ShieldCheck className="w-3 h-3" />
              Bit-Exact Mode
            </span>
          )}
        </div>

        <div className="flex items-center space-x-4 text-slate-400 font-mono text-[11px] shrink-0">
          <span>Scanned: {progress.files_scanned.toLocaleString()}</span>
          {progress.total_candidates > 0 && isScanning && (
            <span className="text-indigo-300">
              Candidates: {progress.total_candidates.toLocaleString()}
            </span>
          )}
          {progress.potential_savings > 0 && (
            <span className="text-emerald-400">
              Reclaimable: {formatBytes(progress.potential_savings)}
            </span>
          )}
        </div>
      </div>

      {/* Progress Indicator Bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        {isScanning ? (
          <div className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 rounded-full animate-pulse w-full" />
        ) : (
          <div className="h-full bg-emerald-500 rounded-full w-full" />
        )}
      </div>
    </div>
  );
};
