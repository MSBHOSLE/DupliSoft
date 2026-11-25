import React, { useState, useEffect } from "react";
import {
  FolderPlus,
  Trash,
  Trash2,
  Play,
  Square,
  Settings,
  Folder,
  FolderDown,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { ScanOptions } from "../types";

interface SidebarProps {
  directories: string[];
  setDirectories: React.Dispatch<React.SetStateAction<string[]>>;
  options: ScanOptions;
  setOptions: React.Dispatch<React.SetStateAction<ScanOptions>>;
  isScanning: boolean;
  onStartScan: () => void;
  onCancelScan: () => void;
}

const SYSTEM_PREFIXES = [
  "/system",
  "/library",
  "/usr",
  "/bin",
  "/sbin",
  "/etc",
  "/var",
  "/private/var",
  "c:/windows",
  "c:/program files",
  "c:/program files (x86)",
];

function isSystemDirectory(dir: string): boolean {
  const norm = dir.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  if (norm === "" || norm === "/" || norm === "c:") {
    return true;
  }
  return SYSTEM_PREFIXES.some((prefix) => norm === prefix || norm.startsWith(`${prefix}/`));
}

export const Sidebar: React.FC<SidebarProps> = ({
  directories,
  setDirectories,
  options,
  setOptions,
  isScanning,
  onStartScan,
  onCancelScan,
}) => {
  const [excludeInput, setExcludeInput] = useState<string>(
    options.exclude_patterns.join(", ")
  );

  useEffect(() => {
    const parsed = excludeInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setOptions((prev) => ({ ...prev, exclude_patterns: parsed }));
  }, [excludeInput, setOptions]);

  const handleAddFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select Folders to Scan for Duplicates",
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        setDirectories((prev) => Array.from(new Set([...prev, ...paths])));
      }
    } catch (err) {
      console.error("Failed to open directory dialog:", err);
    }
  };

  const handleRemoveDir = (dirToRemove: string) => {
    setDirectories((prev) => prev.filter((d) => d !== dirToRemove));
  };

  const handleClearAllDirs = () => {
    setDirectories([]);
  };

  const minSizeOptions = [
    { label: "All sizes", bytes: 0 },
    { label: "> 100 KB", bytes: 100 * 1024 },
    { label: "> 1 MB", bytes: 1024 * 1024 },
    { label: "> 10 MB", bytes: 10 * 1024 * 1024 },
    { label: "> 100 MB", bytes: 100 * 1024 * 1024 },
  ];

  const maxSizeOptions = [
    { label: "No upper limit", bytes: 0 },
    { label: "< 1 MB", bytes: 1024 * 1024 },
    { label: "< 10 MB", bytes: 10 * 1024 * 1024 },
    { label: "< 100 MB", bytes: 100 * 1024 * 1024 },
    { label: "< 1 GB", bytes: 1024 * 1024 * 1024 },
  ];

  const hasSystemDir = directories.some(isSystemDirectory);

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-[calc(100vh-4rem)] p-4 select-none shrink-0">
      {/* Folder Selection Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center space-x-1.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Target Directories
          </h2>
          {directories.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {directories.length}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1.5">
          {directories.length > 0 && (
            <button
              onClick={handleClearAllDirs}
              disabled={isScanning}
              className="flex items-center space-x-1 text-xs px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear all target directories (100% safe, does not delete files)"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          )}
          <button
            onClick={handleAddFolder}
            disabled={isScanning}
            className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition cursor-pointer disabled:opacity-40"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* System Directory Safety Warning */}
      {hasSystemDir && (
        <div className="mb-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start space-x-2 text-[11px] text-amber-300 shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>System directory queued. Review deletions carefully before confirming.</span>
        </div>
      )}

      {/* Folders List Container */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mb-3 pr-1">
        {directories.length === 0 ? (
          <div
            onClick={handleAddFolder}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 group bg-slate-950/30 hover:bg-indigo-500/5"
          >
            <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-indigo-600/20 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition shadow-inner">
              <FolderDown className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-200 font-semibold">Drop Folders Here</p>
            <p className="text-[11px] text-slate-500">or click to browse drives & folders</p>
          </div>
        ) : (
          <>
            {directories.map((dir) => {
              const isSys = isSystemDirectory(dir);
              return (
                <div
                  key={dir}
                  className={`group rounded-xl p-2.5 flex items-center justify-between text-xs transition border ${
                    isSys
                      ? "bg-amber-950/20 border-amber-500/30"
                      : "bg-slate-800/40 hover:bg-slate-800/80 border-slate-800"
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate flex-1 pr-2">
                    <Folder
                      className={`w-4 h-4 shrink-0 ${isSys ? "text-amber-400" : "text-indigo-400"}`}
                    />
                    <span
                      className="font-mono text-slate-200 truncate text-[11px] select-text"
                      title={dir}
                    >
                      {dir}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveDir(dir)}
                    disabled={isScanning}
                    className="opacity-70 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                    title="Remove folder"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={handleAddFolder}
              disabled={isScanning}
              className="w-full py-2 border border-dashed border-slate-800 hover:border-indigo-500/40 rounded-xl text-[11px] text-slate-500 hover:text-indigo-300 transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span>Drop more folders or click to add</span>
            </button>
          </>
        )}
      </div>

      {/* Filter & Scan Settings Section */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5 mb-3 text-xs shrink-0">
        <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>Accuracy & Guardrails</span>
          </div>
          {options.verify_byte_for_byte && (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-mono normal-case">
              <ShieldCheck className="w-2.5 h-2.5" />
              Bit-Exact
            </span>
          )}
        </div>

        {/* Min / Max Size Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 mb-1 block">Min Size</label>
            <select
              value={options.min_size}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, min_size: Number(e.target.value) }))
              }
              disabled={isScanning}
              className="w-full bg-slate-800 border border-slate-700 text-[11px] text-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
            >
              {minSizeOptions.map((opt) => (
                <option key={opt.bytes} value={opt.bytes}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 mb-1 block">Max Size</label>
            <select
              value={options.max_size ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setOptions((prev) => ({ ...prev, max_size: v > 0 ? v : undefined }));
              }}
              disabled={isScanning}
              className="w-full bg-slate-800 border border-slate-700 text-[11px] text-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
            >
              {maxSizeOptions.map((opt) => (
                <option key={opt.bytes} value={opt.bytes}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Exclude Wildcard Patterns */}
        <div>
          <label className="text-[10px] text-slate-400 mb-1 block">
            Exclude Globs (comma separated)
          </label>
          <input
            type="text"
            value={excludeInput}
            onChange={(e) => setExcludeInput(e.target.value)}
            disabled={isScanning}
            placeholder="e.g. *.tmp, *.bak, dist/*"
            className="w-full bg-slate-800 border border-slate-700 text-[11px] text-slate-200 placeholder-slate-500 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {/* Precision & Safety Toggles */}
        <div className="space-y-1.5 pt-0.5 text-[11px]">
          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={options.verify_byte_for_byte}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, verify_byte_for_byte: e.target.checked }))
              }
              disabled={isScanning}
              className="rounded border-slate-700 text-emerald-600 focus:ring-0 bg-slate-800"
            />
            <span>100% Byte-for-Byte Final Verify</span>
          </label>

          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={options.ignore_empty_files}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, ignore_empty_files: e.target.checked }))
              }
              disabled={isScanning}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-800"
            />
            <span>Ignore 0-byte empty marker files</span>
          </label>

          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={options.deduplicate_hardlinks && options.skip_symlinks}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  deduplicate_hardlinks: e.target.checked,
                  skip_symlinks: e.target.checked,
                }))
              }
              disabled={isScanning}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-800"
            />
            <span>Skip symlinks & hardlink aliases</span>
          </label>

          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={options.check_hidden}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, check_hidden: e.target.checked }))
              }
              disabled={isScanning}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-800"
            />
            <span>Include Hidden Files (.files)</span>
          </label>
        </div>
      </div>

      {/* Main Action Scan / Cancel Button */}
      {isScanning ? (
        <button
          onClick={onCancelScan}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-amber-600/20 transition active:scale-95 cursor-pointer shrink-0"
        >
          <Square className="w-4 h-4 fill-white" />
          <span>Stop Scanning</span>
        </button>
      ) : (
        <button
          onClick={onStartScan}
          disabled={directories.length === 0}
          className={`w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-semibold text-xs shadow-lg transition active:scale-95 shrink-0 ${
            directories.length > 0
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer"
              : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
          }`}
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Start Verified Scan</span>
        </button>
      )}
    </aside>
  );
};
