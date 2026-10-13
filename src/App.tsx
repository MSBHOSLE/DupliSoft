import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ProgressBanner } from "./components/ProgressBanner";
import { SmartSelectBar } from "./components/SmartSelectBar";
import { DuplicateList } from "./components/DuplicateList";
import { PreviewModal } from "./components/PreviewModal";
import { TrashConfirmModal } from "./components/TrashConfirmModal";
import {
  DuplicateGroup,
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

  // Modal states
  const [previewGroup, setPreviewGroup] = useState<DuplicateGroup | null>(null);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">
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
              setSelectedFilePaths={setSelectedFilePaths}
            />
          )}

          <DuplicateList
            groups={scanResult?.groups || []}
            selectedFilePaths={selectedFilePaths}
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
