import React from "react";
import { Trash2, X, ShieldCheck, AlertTriangle } from "lucide-react";
import { formatBytes } from "../utils/formatters";

interface TrashConfirmModalProps {
  selectedCount: number;
  selectedBytes: number;
  selectedPaths: string[];
  unsafeAllSelectedGroupsCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const TrashConfirmModal: React.FC<TrashConfirmModalProps> = ({
  selectedCount,
  selectedBytes,
  selectedPaths,
  unsafeAllSelectedGroupsCount,
  isDeleting,
  onConfirm,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Confirm Verified Move to Trash</h3>
              <p className="text-xs text-slate-400">
                You are about to reclaim{" "}
                <strong className="text-emerald-400">{formatBytes(selectedBytes)}</strong> of disk space
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {unsafeAllSelectedGroupsCount > 0 ? (
            <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-semibold text-rose-300">
                  Safety Lock: {unsafeAllSelectedGroupsCount} group(s) have ALL copies selected!
                </p>
                <p className="text-[11px] text-rose-200/80 mt-0.5">
                  At least 1 copy must remain kept in every duplicate group. Deselect one copy in those groups before continuing.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-emerald-200">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-300">
                  Pre-Trash Cryptographic Guard + Reversible OS Trash
                </p>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  Every file's size and BLAKE3 hash is re-verified right before deletion, and moved safely to Finder Trash / Recycle Bin (never permanently wiped).
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium">
              Files to be moved ({selectedCount}):
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 text-[11px] font-mono text-slate-300 select-text">
              {selectedPaths.slice(0, 50).map((path) => (
                <div key={path} className="truncate text-slate-400 hover:text-slate-200">
                  {path}
                </div>
              ))}
              {selectedPaths.length > 50 && (
                <div className="text-slate-500 text-[10px] pt-1">
                  ... and {selectedPaths.length - 50} more files
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={isDeleting || unsafeAllSelectedGroupsCount > 0}
            className="flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl shadow-lg shadow-rose-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isDeleting ? "Verifying & Moving..." : `Move ${selectedCount} Files to Trash`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
