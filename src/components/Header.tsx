import React from "react";
import { Shield, Trash2, HardDrive, Layers, RefreshCw } from "lucide-react";
import { formatBytes } from "../utils/formatters";

import { APP_VERSION } from "../version";
import logoImg from "../assets/DupliSoft_Logo.png";

interface HeaderProps {
  totalScanned: number;
  duplicateCount: number;
  totalWastedBytes: number;
  selectedCount: number;
  selectedWastedBytes: number;
  isScanning: boolean;
  onOpenTrashConfirm: () => void;
  onResetScan: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalScanned,
  duplicateCount,
  totalWastedBytes,
  selectedCount,
  selectedWastedBytes,
  isScanning,
  onOpenTrashConfirm,
  onResetScan,
}) => {
  return (
    <header className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between select-none">
      {/* Brand & Privacy Badge */}
      <div className="flex items-center space-x-3.5">
        <img
          src={logoImg}
          alt="DupliSoft Logo"
          className="w-11 h-11 rounded-xl object-contain drop-shadow-lg"
        />
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-base tracking-tight text-white">DupliSoft</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
              ({APP_VERSION})
            </span>
            <span className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              <Shield className="w-3 h-3" />
              <span>100% Local & Offline</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Zero-latency duplicate file finder & inspector</p>
        </div>
      </div>

      {/* Metrics Center */}
      <div className="hidden md:flex items-center space-x-6 text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <Layers className="w-4 h-4 text-slate-500" />
          <span>
            Scanned: <strong className="text-slate-200">{totalScanned.toLocaleString()}</strong> files
          </span>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <HardDrive className="w-4 h-4 text-slate-500" />
          <span>
            Duplicates: <strong className="text-amber-400">{duplicateCount}</strong> files
          </span>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span>
            Wasted Space:{" "}
            <strong className="text-rose-400 font-semibold">{formatBytes(totalWastedBytes)}</strong>
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        {totalScanned > 0 && !isScanning && (
          <button
            onClick={onResetScan}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Start New Scan"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}

        <button
          onClick={onOpenTrashConfirm}
          disabled={selectedCount === 0 || isScanning}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition ${
            selectedCount > 0 && !isScanning
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 cursor-pointer active:scale-95"
              : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>
            Move {selectedCount > 0 ? `${selectedCount} Selected` : "Selected"} to Trash
          </span>
          {selectedCount > 0 && (
            <span className="bg-rose-700 px-1.5 py-0.5 rounded text-[10px] text-rose-100 font-mono">
              {formatBytes(selectedWastedBytes)}
            </span>
          )}
        </button>

        {/* Developer Credit in Top Right Corner */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs shadow-sm">
          <span className="text-slate-400 text-[11px]">Developer:</span>
          <span className="font-semibold text-indigo-300 tracking-tight">Mahesh Sanjayrao Bhosle</span>
        </div>
      </div>
    </header>
  );
};
