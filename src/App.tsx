import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { save } from "@tauri-apps/plugin-dialog";
import { FolderDown, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ProgressBanner } from "./components/ProgressBanner";
import { SmartSelectBar } from "./components/SmartSelectBar";
import { DuplicateList } from "./components/DuplicateList";
import { PreviewModal } from "./components/PreviewModal";
import { TrashConfirmModal } from "./components/TrashConfirmModal";
import {
  DuplicateGroup,
  FileCategory,
  ScanOptions,
  ScanProgress,
  ScanResult,
  TrashRequestItem,
  TrashResult,
} from "./types";
import { formatBytes } from "./utils/formatters";
import "./App.css";

interface StatusNotice {
  kind: "success" | "warning" | "error" | "info";
  title: string;
  detail?: string;
}

export const App: React.FC = () => {
  const [directories, setDirectories] = useState<string[]>([]);
  const [options, setOptions] = useState<ScanOptions>({
    directories: [],
    min_size: 0,
    exclude_patterns: [],
    check_hidden: false,
    ignore_empty_files: true,
    verify_byte_for_byte: false,
    skip_symlinks: true,
    deduplicate_hardlinks: true,
  });

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progress, setProgress] = useState<ScanProgress>({
    phase: "indexing",
    files_scanned: 0,
    total_candidates: 0,
    current_file: "",
    duplicate_groups_found: 0,
    potential_savings: 0,
  });

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<FileCategory>("all");
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);

  // Modal states
  const [previewGroup, setPreviewGroup] = useState<DuplicateGroup | null>(null);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const handleAddDroppedPaths = async (rawPaths: string[]) => {
    if (!rawPaths || rawPaths.length === 0) return;
    try {
      const validDirs = await invoke<string[]>("normalize_dropped_paths", {
        paths: rawPaths,
      });
      if (validDirs.length > 0) {
        setDirectories((prev) => Array.from(new Set([...prev, ...validDirs])));
      }
    } catch (err) {
      console.error("Failed to normalize dropped paths:", err);
      setDirectories((prev) => Array.from(new Set([...prev, ...rawPaths])));
    }
  };

  // 1. Native Tauri Window Drag-and-Drop Handler (works on macOS, Windows, Linux)
  useEffect(() => {
    let unlistenDragDrop: (() => void) | undefined;

    getCurrentWebviewWindow()
      .onDragDropEvent(async (event) => {
        if (event.payload.type === "over" || event.payload.type === "enter") {
          setIsDragOver(true);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);
          await handleAddDroppedPaths(event.payload.paths);
        } else {
          setIsDragOver(false);
        }
      })
      .then((un) => {
        unlistenDragDrop = un;
      })
      .catch((err) => {
        console.warn("Native drag-drop listener not registered:", err);
      });

    return () => {
      if (unlistenDragDrop) unlistenDragDrop();
    };
  }, []);

  // 2. HTML5 Drag-and-Drop Fallback Handler
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!e.relatedTarget || (e.clientX <= 0 && e.clientY <= 0)) {
        setIsDragOver(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const filePaths: string[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i] as File & { path?: string };
          if (f.path) filePaths.push(f.path);
        }
        if (filePaths.length > 0) {
          await handleAddDroppedPaths(filePaths);
        }
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // Listen to Tauri scan-progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<ScanProgress>("scan-progress", (event) => {
      setProgress(event.payload);
    }).then((un) => {
      unlisten = un;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleStartScan = async () => {
    if (directories.length === 0) return;

    setIsScanning(true);
    setSelectedFilePaths(new Set());
    setScanResult(null);
    setStatusNotice(null);

    const scanOptions: ScanOptions = {
      ...options,
      directories,
    };

    try {
      const result = await invoke<ScanResult>("start_scan", {
        options: scanOptions,
      });
      setScanResult(result);

      const skippedCount = result.skipped_files_count ?? 0;
      const emptyIgnored = result.empty_files_ignored ?? 0;
      const hardlinksSkipped = result.hardlinks_skipped ?? 0;

      if (skippedCount > 0) {
        setStatusNotice({
          kind: "warning",
          title: `Scan finished (${result.scan_duration_ms}ms) — ${skippedCount} unreadable file(s) skipped`,
          detail: result.skipped_files_sample
            ?.slice(0, 2)
            .map(([p, reason]) => `${p}: ${reason}`)
            .join(" | "),
        });
      } else if (emptyIgnored > 0 || hardlinksSkipped > 0) {
        setStatusNotice({
          kind: "info",
          title: `Scan verified ${result.total_files_scanned.toLocaleString()} files in ${result.scan_duration_ms}ms`,
          detail: `Safely skipped ${emptyIgnored} empty marker file(s) and ${hardlinksSkipped} hardlink alias(es).`,
        });
      }
    } catch (err) {
      const msg = String(err);
      setStatusNotice({
        kind: msg.toLowerCase().includes("cancel") ? "info" : "error",
        title: msg.toLowerCase().includes("cancel") ? "Scan Cancelled" : "Scan Error",
        detail: msg,
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCancelScan = async () => {
    try {
      await invoke("cancel_scan");
    } catch (err) {
      console.error("Failed to cancel scan:", err);
    }
  };

  const handleToggleSelect = (path: string) => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleRevealFile = async (path: string) => {
    try {
      await invoke("reveal_file", { path });
    } catch (err) {
      setStatusNotice({
        kind: "error",
        title: "Unable to open file in Explorer / Finder",
        detail: String(err),
      });
    }
  };

  // Calculate selected files, reclaimable bytes, and check last-copy safety
  const {
    selectedCount,
    selectedWastedBytes,
    selectedPathsList,
    selectedTrashItems,
    unsafeAllSelectedGroupsCount,
  } = useMemo(() => {
    if (!scanResult) {
      return {
        selectedCount: 0,
        selectedWastedBytes: 0,
        selectedPathsList: [],
        selectedTrashItems: [],
        unsafeAllSelectedGroupsCount: 0,
      };
    }

    let count = 0;
    let bytes = 0;
    let unsafeGroups = 0;
    const paths: string[] = [];
    const items: TrashRequestItem[] = [];

    for (const group of scanResult.groups) {
      let groupSelected = 0;
      for (const file of group.files) {
        if (selectedFilePaths.has(file.path)) {
          count++;
          groupSelected++;
          bytes += file.size;
          paths.push(file.path);
          items.push({
            path: file.path,
            expected_size: file.size,
            expected_hash: group.hash,
          });
        }
      }
      if (groupSelected >= group.files.length && group.files.length > 0) {
        unsafeGroups++;
      }
    }

    return {
      selectedCount: count,
      selectedWastedBytes: bytes,
      selectedPathsList: paths,
      selectedTrashItems: items,
      unsafeAllSelectedGroupsCount: unsafeGroups,
    };
  }, [scanResult, selectedFilePaths]);

  const handleConfirmTrash = async () => {
    if (selectedTrashItems.length === 0 || unsafeAllSelectedGroupsCount > 0) return;
    setIsDeleting(true);

    try {
      const res = await invoke<TrashResult>("trash_files_verified", {
        items: selectedTrashItems,
      });

      const deletedSet = new Set(res.successful);

      if (scanResult) {
        const updatedGroups: DuplicateGroup[] = [];

        for (const group of scanResult.groups) {
          const remainingFiles = group.files.filter((f) => !deletedSet.has(f.path));
          if (remainingFiles.length > 1) {
            const wasted = (remainingFiles.length - 1) * group.size;
            updatedGroups.push({
              ...group,
              files: remainingFiles,
              wasted_bytes: wasted,
            });
          }
        }

        const totalDuplicates = updatedGroups.reduce((acc, g) => acc + (g.files.length - 1), 0);
        const totalWasted = updatedGroups.reduce((acc, g) => acc + g.wasted_bytes, 0);

        setScanResult({
          ...scanResult,
          groups: updatedGroups,
          total_duplicates_found: totalDuplicates,
          total_wasted_bytes: totalWasted,
        });
      }

      setSelectedFilePaths((prev) => {
        const next = new Set(prev);
        deletedSet.forEach((p) => next.delete(p));
        return next;
      });

      if (res.failed.length > 0) {
        setStatusNotice({
          kind: "warning",
          title: `Moved ${res.successful.length} file(s) to Trash; ${res.failed.length} skipped/failed`,
          detail: res.failed
            .slice(0, 3)
            .map(([p, reason]) => `${p}: ${reason}`)
            .join(" | "),
        });
      } else {
        setStatusNotice({
          kind: "success",
          title: `Safely moved ${res.successful.length} duplicate(s) to Trash`,
          detail: `Reclaimed ${formatBytes(res.total_freed_bytes)} of disk space.`,
        });
      }

      setIsTrashModalOpen(false);
    } catch (err) {
      setStatusNotice({
        kind: "error",
        title: "Trash operation failed",
        detail: String(err),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportReport = async () => {
    if (!scanResult || scanResult.groups.length === 0) return;

    try {
      const targetPath = await save({
        title: "Export DupliSoft Audit Report",
        defaultPath: "duplisoft-duplicates-report.csv",
        filters: [
          { name: "CSV Spreadsheet", extensions: ["csv"] },
          { name: "JSON Report", extensions: ["json"] },
        ],
      });

      if (!targetPath) return;

      let content = "";
      if (targetPath.toLowerCase().endsWith(".json")) {
        content = JSON.stringify(scanResult, null, 2);
      } else {
        const rows = [
          [
            "GroupID",
            "Hash",
            "ByteVerified",
            "FileSizeBytes",
            "Status",
            "Filename",
            "Directory",
            "FullPath",
          ].join(","),
        ];
        const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

        for (const g of scanResult.groups) {
          for (const f of g.files) {
            const status = selectedFilePaths.has(f.path) ? "MarkedForTrash" : "Kept";
            rows.push(
              [
                escapeCsv(g.id),
                escapeCsv(g.hash),
                String(Boolean(g.byte_verified)),
                String(f.size),
                status,
                escapeCsv(f.filename),
                escapeCsv(f.directory),
                escapeCsv(f.path),
              ].join(",")
            );
          }
        }
        content = rows.join("\n");
      }

      await invoke("save_text_file", { path: targetPath, content });
      setStatusNotice({
        kind: "success",
        title: "Audit report exported",
        detail: targetPath,
      });
    } catch (err) {
      setStatusNotice({
        kind: "error",
        title: "Failed to export report",
        detail: String(err),
      });
    }
  };

  const handleResetScan = () => {
    setScanResult(null);
    setSelectedFilePaths(new Set());
    setStatusNotice(null);
    setProgress({
      phase: "indexing",
      files_scanned: 0,
      total_candidates: 0,
      current_file: "",
      duplicate_groups_found: 0,
      potential_savings: 0,
    });
  };

  return (
    <div className="relative h-screen w-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Full-Window Drag & Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 pointer-events-none bg-slate-950/85 backdrop-blur-md border-4 border-dashed border-indigo-500 m-4 rounded-3xl flex flex-col items-center justify-center shadow-2xl transition-all duration-200 select-none">
          <div className="p-6 rounded-3xl bg-indigo-600/25 text-indigo-400 mb-4 border border-indigo-500/40 shadow-xl shadow-indigo-500/10 animate-bounce">
            <FolderDown className="w-16 h-16" />
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
            Drop Folders or Drives to Queue Scan
          </h3>
          <p className="text-sm text-slate-300 max-w-md text-center">
            Release to add folders directly to Target Directories for duplicate inspection
          </p>
        </div>
      )}

      {/* Top Header */}
      <Header
        totalScanned={scanResult?.total_files_scanned || progress.files_scanned}
        duplicateCount={scanResult?.total_duplicates_found || 0}
        totalWastedBytes={scanResult?.total_wasted_bytes || 0}
        selectedCount={selectedCount}
        selectedWastedBytes={selectedWastedBytes}
        isScanning={isScanning}
        hasResults={Boolean(scanResult && scanResult.groups.length > 0)}
        onOpenTrashConfirm={() => setIsTrashModalOpen(true)}
        onResetScan={handleResetScan}
        onExportReport={handleExportReport}
      />

      {/* Real-time Progress Bar */}
      <ProgressBanner progress={progress} isScanning={isScanning} />

      {/* Main Workspace Layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          directories={directories}
          setDirectories={setDirectories}
          options={options}
          setOptions={setOptions}
          isScanning={isScanning}
          onStartScan={handleStartScan}
          onCancelScan={handleCancelScan}
        />

        {/* Center Content & Results View */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-slate-950 overflow-hidden">
          {/* Status / Error / Safety Notification Banner */}
          {statusNotice && (
            <div
              className={`px-5 py-2.5 border-b flex items-center justify-between gap-3 text-xs shrink-0 ${
                statusNotice.kind === "error"
                  ? "bg-rose-950/50 border-rose-500/30 text-rose-200"
                  : statusNotice.kind === "warning"
                  ? "bg-amber-950/40 border-amber-500/30 text-amber-200"
                  : statusNotice.kind === "success"
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                  : "bg-indigo-950/40 border-indigo-500/30 text-indigo-200"
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                {statusNotice.kind === "error" || statusNotice.kind === "warning" ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : statusNotice.kind === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <Info className="w-4 h-4 shrink-0 text-indigo-400" />
                )}
                <div className="min-w-0">
                  <span className="font-semibold">{statusNotice.title}</span>
                  {statusNotice.detail && (
                    <span className="ml-2 text-[11px] opacity-80 truncate select-text">
                      {statusNotice.detail}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setStatusNotice(null)}
                className="p-1 hover:bg-white/10 rounded transition cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {scanResult && scanResult.groups.length > 0 && (
            <SmartSelectBar
              groups={scanResult.groups}
              selectedFilePaths={selectedFilePaths}
              setSelectedFilePaths={setSelectedFilePaths}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
            />
          )}

          <DuplicateList
            groups={scanResult?.groups || []}
            selectedFilePaths={selectedFilePaths}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            onToggleSelect={handleToggleSelect}
            onOpenPreview={(group) => setPreviewGroup(group)}
            onRevealFile={handleRevealFile}
          />
        </main>
      </div>

      {/* Interactive Preview Modal */}
      {previewGroup && (
        <PreviewModal
          group={previewGroup}
          selectedFilePaths={selectedFilePaths}
          onToggleSelect={handleToggleSelect}
          onRevealFile={handleRevealFile}
          onClose={() => setPreviewGroup(null)}
        />
      )}

      {/* Safe Verified Move-to-Trash Confirmation Dialog */}
      {isTrashModalOpen && (
        <TrashConfirmModal
          selectedCount={selectedCount}
          selectedBytes={selectedWastedBytes}
          selectedPaths={selectedPathsList}
          unsafeAllSelectedGroupsCount={unsafeAllSelectedGroupsCount}
          isDeleting={isDeleting}
          onConfirm={handleConfirmTrash}
          onClose={() => setIsTrashModalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
