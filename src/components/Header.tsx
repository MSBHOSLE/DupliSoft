import React from "react";
import { Shield, Trash2, HardDrive, Layers, RefreshCw, Download } from "lucide-react";
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
  hasResults: boolean;
  onOpenTrashConfirm: () => void;
  onResetScan: () => void;
  onExportReport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalScanned,
  duplicateCount,
  totalWastedBytes,
  selectedCount,
  selectedWastedBytes,
  isScanning,
  hasResults,
  onOpenTrashConfirm,
  onResetScan,
  onExportReport,
}) => {
  return (
    <header className="h-16 px-5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-4 select-none shrink-0">
      {/* Brand & Privacy Badge */}
      <div className="flex items-center space-x-3 min-w-0">
        <img
          src={logoImg}
          alt="DupliSoft Logo"
          className="w-10 h-10 rounded-xl object-contain drop-shadow-lg shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-base tracking-tight text-white">DupliSoft</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
              {APP_VERSION}
            </span>
            <span className="hidden sm:inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              <Shield className="w-3 h-3" />
              <span>100% Offline</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            Cryptographic duplicate finder & multi-format inspector
          </p>
        </div>
      </div>

      {/* Metrics Center */}
      <div className="hidden lg:flex items-center space-x-5 text-xs shrink-0">
        <div className="flex items-center space-x-2 text-slate-400">
          <Layers className="w-4 h-4 text-slate-500" />
          <span>
            Scanned: <strong className="text-slate-200">{totalScanned.toLocaleString()}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <HardDrive className="w-4 h-4 text-slate-500" />
          <span>
            Duplicates: <strong className="text-amber-400">{duplicateCount.toLocaleString()}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span>
            Reclaimable:{" "}
            <strong className="text-rose-400 font-semibold">{formatBytes(totalWastedBytes)}</strong>
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2.5 shrink-0">
        {hasResults && !isScanning && (
          <button
            onClick={onExportReport}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition cursor-pointer"
            title="Export scan results to CSV or JSON report"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}

        {totalScanned > 0 && !isScanning && (
          <button
            onClick={onResetScan}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition cursor-pointer"
            title="Reset Scan Results"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}

        <button
          onClick={onOpenTrashConfirm}
          disabled={selectedCount === 0 || isScanning}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition ${
            selectedCount > 0 && !isScanning
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 cursor-pointer active:scale-95"
              : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>
            Trash {selectedCount > 0 ? `${selectedCount} Selected` : "Selected"}
          </span>
          {selectedCount > 0 && (
            <span className="bg-rose-700 px-1.5 py-0.5 rounded text-[10px] text-rose-100 font-mono">
              {formatBytes(selectedWastedBytes)}
            </span>
          )}
        </button>

        {/* Developer Credit */}
        <div className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs shadow-sm">
          <span className="text-slate-400 text-[11px]">Dev:</span>
          <span className="font-semibold text-indigo-300 tracking-tight">Mahesh S. Bhosle</span>
        </div>
      </div>
    </header>
  );
};
