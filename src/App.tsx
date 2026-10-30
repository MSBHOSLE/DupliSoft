import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { FolderDown } from "lucide-react";
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
  TrashResult,
} from "./types";
import "./App.css";

export const App: React.FC = () => {
  const [directories, setDirectories] = useState<string[]>([]);
  const [options, setOptions] = useState<ScanOptions>({
    directories: [],
    min_size: 0,
    exclude_patterns: [],
    check_hidden: false,
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

  // 1. Native Tauri Window Drag-and-Drop Handler
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
          const f = e.dataTransfer.files[i] as any;
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

    const scanOptions: ScanOptions = {
      ...options,
      directories,
    };

    try {
      const result = await invoke<ScanResult>("start_scan", {
        options: scanOptions,
      });
      setScanResult(result);
    } catch (err) {
      console.error("Scan error or cancelled:", err);
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
      console.error("Failed to reveal file in manager:", err);
    }
  };

  // Calculate selected files and reclaimable bytes
  const { selectedCount, selectedWastedBytes, selectedPathsList } = useMemo(() => {
    if (!scanResult) {
      return { selectedCount: 0, selectedWastedBytes: 0, selectedPathsList: [] };
    }

    let count = 0;
    let bytes = 0;
    const paths: string[] = [];

    for (const group of scanResult.groups) {
      for (const file of group.files) {
        if (selectedFilePaths.has(file.path)) {
          count++;
          bytes += file.size;
          paths.push(file.path);
        }
      }
    }

    return {
      selectedCount: count,
      selectedWastedBytes: bytes,
      selectedPathsList: paths,
    };
  }, [scanResult, selectedFilePaths]);

  const handleConfirmTrash = async () => {
    if (selectedPathsList.length === 0) return;
    setIsDeleting(true);

    try {
      const res = await invoke<TrashResult>("trash_files", {
        paths: selectedPathsList,
      });

      const deletedSet = new Set(res.successful);

      // Remove deleted files from state
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

      // Clear deleted from selection set
      setSelectedFilePaths((prev) => {
        const next = new Set(prev);
        deletedSet.forEach((p) => next.delete(p));
        return next;
      });

      setIsTrashModalOpen(false);
    } catch (err) {
      console.error("Failed to trash files:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetScan = () => {
    setScanResult(null);
    setSelectedFilePaths(new Set());
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
          <h3 className="text-2xl font-bold text-white tracking-tight mb-2">Drop Folders or Drives to Queue Scan</h3>
          <p className="text-sm text-slate-300 max-w-md text-center">
            Release to add folders directly to Target Directories for duplicate file inspection
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
        onOpenTrashConfirm={() => setIsTrashModalOpen(true)}
        onResetScan={handleResetScan}
      />

      {/* Real-time Progress Bar */}
      <ProgressBanner progress={progress} isScanning={isScanning} />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
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
        <main className="flex-1 flex flex-col bg-slate-920 overflow-hidden">
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

      {/* Interactive Preview Modal (Deep Zoom & Side-by-Side Video Player) */}
      {previewGroup && (
        <PreviewModal
          group={previewGroup}
          selectedFilePaths={selectedFilePaths}
          onToggleSelect={handleToggleSelect}
          onRevealFile={handleRevealFile}
          onClose={() => setPreviewGroup(null)}
        />
      )}

      {/* Safe Move-to-Trash Confirmation Dialog */}
      {isTrashModalOpen && (
        <TrashConfirmModal
          selectedCount={selectedCount}
          selectedBytes={selectedWastedBytes}
          selectedPaths={selectedPathsList}
          isDeleting={isDeleting}
          onConfirm={handleConfirmTrash}
          onClose={() => setIsTrashModalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
