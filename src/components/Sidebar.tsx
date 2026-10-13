import React from "react";
import { FolderPlus, Trash, Play, Square, Settings, Folder } from "lucide-react";
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

export const Sidebar: React.FC<SidebarProps> = ({
  directories,
  setDirectories,
  options,
  setOptions,
  isScanning,
  onStartScan,
  onCancelScan,
}) => {
  const handleAddFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select Folders to Scan for Duplicates",
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        setDirectories((prev) => {
          const set = new Set([...prev, ...paths]);
          return Array.from(set);
        });
      }
    } catch (err) {
      console.error("Failed to open directory dialog:", err);
    }
  };

  const handleRemoveDir = (dirToRemove: string) => {
    setDirectories((prev) => prev.filter((d) => d !== dirToRemove));
  };

  const minSizeOptions = [
    { label: "All sizes", bytes: 0 },
    { label: "> 100 KB", bytes: 100 * 1024 },
    { label: "> 1 MB", bytes: 1024 * 1024 },
    { label: "> 10 MB", bytes: 10 * 1024 * 1024 },
    { label: "> 100 MB", bytes: 100 * 1024 * 1024 },
  ];

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-[calc(100vh-4rem)] p-4 select-none">
      {/* Folder Selection Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Target Directories
        </h2>
        <button
          onClick={handleAddFolder}
          disabled={isScanning}
          className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>Add Folder</span>
        </button>
      </div>

      {/* Folders List Container */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
        {directories.length === 0 ? (
          <div
            onClick={handleAddFolder}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-indigo-600/20 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition">
              <FolderPlus className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-300 font-medium">Click to Add Folders</p>
            <p className="text-[11px] text-slate-500">Select any drive, folder, or volume</p>
          </div>
        ) : (
          directories.map((dir) => (
            <div
              key={dir}
              className="group bg-slate-850 hover:bg-slate-800/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs transition"
            >
              <div className="flex items-center space-x-2.5 truncate flex-1 pr-2">
                <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-mono text-slate-200 truncate text-[11px]" title={dir}>
                  {dir}
                </span>
              </div>
              <button
                onClick={() => handleRemoveDir(dir)}
                disabled={isScanning}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                title="Remove folder"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Filter & Scan Settings Section */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3 mb-4 text-xs">
        <div className="flex items-center space-x-2 text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
          <Settings className="w-3.5 h-3.5 text-indigo-400" />
          <span>Scan Guardrails</span>
        </div>

        {/* Min Size */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Minimum File Size</label>
          <select
            value={options.min_size}
            onChange={(e) =>
              setOptions((prev) => ({ ...prev, min_size: Number(e.target.value) }))
            }
            disabled={isScanning}
            className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
          >
            {minSizeOptions.map((opt) => (
              <option key={opt.bytes} value={opt.bytes}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Hidden Files Toggle */}
        <label className="flex items-center space-x-2 text-slate-300 cursor-pointer text-xs">
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

      {/* Main Action Scan / Cancel Button */}
      {isScanning ? (
        <button
          onClick={onCancelScan}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-amber-600/20 transition active:scale-95 cursor-pointer"
        >
          <Square className="w-4 h-4 fill-white" />
          <span>Stop Scanning</span>
        </button>
      ) : (
        <button
          onClick={onStartScan}
          disabled={directories.length === 0}
          className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-semibold text-xs shadow-lg transition active:scale-95 ${
            directories.length > 0
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer"
              : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
          }`}
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Start High-Speed Scan</span>
        </button>
      )}
    </aside>
  );
};
