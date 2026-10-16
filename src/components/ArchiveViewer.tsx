import React from "react";
import { ArchivePreview } from "../types";
import { formatBytes } from "../utils/formatters";
import { Archive, AlertCircle, Folder, File, Sparkles } from "lucide-react";

interface ArchiveViewerProps {
  data: ArchivePreview | null;
  loading: boolean;
  error: string | null;
  filename: string;
}

export const ArchiveViewer: React.FC<ArchiveViewerProps> = ({
  data,
  loading,
  error,
  filename,
}) => {
  if (loading) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-8 text-slate-400 animate-pulse">
        <Archive className="w-10 h-10 text-purple-400/60 mb-3 animate-bounce" />
        <p className="text-sm font-medium text-slate-300">Scanning archive index...</p>
        <p className="text-xs text-slate-500 mt-1">Reading ZIP Central Directory in 1.5ms without extracting</p>
      </div>
    );
  }

  if (error || !data || data.total_entries === 0) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertCircle className="w-9 h-9 text-amber-400/80 mb-2" />
        <p className="text-sm font-medium text-slate-200">Unable to inspect archive</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">{error || "Archive is empty or unreadable."}</p>
      </div>
    );
  }

  const compressionRatio = data.total_uncompressed_bytes > 0
    ? Math.round(
        ((data.total_uncompressed_bytes - data.total_compressed_bytes) /
          data.total_uncompressed_bytes) *
          100
      )
    : 0;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 text-xs overflow-hidden rounded border border-slate-800/80">
      {/* Top Metadata Header */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 truncate max-w-[60%]">
          <Archive className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="font-semibold text-slate-200 text-xs truncate" title={filename}>
            {filename}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-medium border border-purple-500/25">
            {data.total_entries.toLocaleString()} files
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
          <span className="flex items-center space-x-1 text-emerald-400 font-mono">
            <Sparkles className="w-3 h-3" />
            <span>{compressionRatio}% Saved</span>
          </span>
          <span className="font-mono">
            {formatBytes(data.total_compressed_bytes)} / {formatBytes(data.total_uncompressed_bytes)}
          </span>
        </div>
      </div>

      {/* Archive Entries Table */}
      <div className="flex-1 overflow-auto bg-slate-950 scrollbar-thin">
        <table className="w-full border-collapse text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-slate-900/95 border-b border-slate-800 text-slate-400 text-[10px] z-10 backdrop-blur">
            <tr>
              <th className="px-3 py-1.5 font-semibold">Name / Path</th>
              <th className="px-3 py-1.5 font-semibold text-right">Extracted</th>
              <th className="px-3 py-1.5 font-semibold text-right">Compressed</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry, idx) => (
              <tr
                key={idx}
                className={`border-b border-slate-900 hover:bg-slate-900/50 transition-colors ${
                  idx % 2 === 0 ? "bg-slate-950" : "bg-slate-900/20"
                }`}
              >
                <td className="px-3 py-1 text-slate-300 flex items-center space-x-1.5 truncate max-w-[280px]">
                  {entry.is_dir ? (
                    <Folder className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                  ) : (
                    <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate" title={entry.name}>
                    {entry.name}
                  </span>
                </td>
                <td className="px-3 py-1 text-right text-slate-400 text-[10px]">
                  {entry.is_dir ? "-" : formatBytes(entry.size)}
                </td>
                <td className="px-3 py-1 text-right text-slate-500 text-[10px]">
                  {entry.is_dir ? "-" : formatBytes(entry.compressed_size)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>Instant Central Directory stream (zero file extraction)</span>
        <span className="font-mono text-purple-400/80">ZIP Archive</span>
      </div>
    </div>
  );
};
