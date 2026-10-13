import React from "react";
import { ScanProgress } from "../types";
import { formatBytes } from "../utils/formatters";
import { Loader2, CheckCircle2 } from "lucide-react";

interface ProgressBannerProps {
  progress: ScanProgress;
  isScanning: boolean;
}

export const ProgressBanner: React.FC<ProgressBannerProps> = ({ progress, isScanning }) => {
  if (!isScanning && progress.phase !== "completed") return null;

  const phaseLabels: Record<string, string> = {
    indexing: "Stage 1: Traversal & File Size Grouping (O(N) zero disk reads)...",
    chunk_hashing: "Stage 2: 32KB Header/Trailer Chunk Hashing (eliminating non-duplicates)...",
    full_hashing: "Stage 3: Full Multithreaded SIMD BLAKE3 Hashing...",
    completed: "Scan Complete! All duplicates identified.",
  };

  return (
    <div className="bg-indigo-950/40 border-b border-indigo-500/20 px-6 py-3 select-none">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center space-x-2">
          {isScanning ? (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span className="font-semibold text-slate-200">
            {phaseLabels[progress.phase] || progress.phase}
          </span>
        </div>

        <div className="flex items-center space-x-4 text-slate-400 font-mono text-[11px]">
          <span>Files Processed: {progress.files_scanned.toLocaleString()}</span>
          {progress.potential_savings > 0 && (
            <span className="text-emerald-400">
              Potential Savings: {formatBytes(progress.potential_savings)}
            </span>
          )}
        </div>
      </div>

      {/* Progress Animated Line */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        {isScanning ? (
          <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-pulse w-full" />
        ) : (
          <div className="h-full bg-emerald-500 rounded-full w-full" />
        )}
      </div>
    </div>
  );
};
