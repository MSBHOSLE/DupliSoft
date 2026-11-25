import React, { useMemo, useState } from "react";
import { Sparkles, History, FolderTree, RotateCcw, XCircle, ShieldCheck } from "lucide-react";
import { DuplicateGroup, FileCategory, FileEntry } from "../types";
import { getFileCategory } from "../utils/formatters";

interface SmartSelectBarProps {
  groups: DuplicateGroup[];
  selectedFilePaths: Set<string>;
  setSelectedFilePaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  categoryFilter: FileCategory;
  setCategoryFilter: (cat: FileCategory) => void;
}

const CATEGORY_NAMES: Record<FileCategory, string> = {
  all: "All Types",
  images: "Images",
  videos: "Videos",
  documents: "PDFs & Docs",
  code: "Code & Notebooks",
  audio: "Audio",
  archives: "Archives",
  other: "Other Files",
};

function getTimeMs(f: FileEntry): number {
  return f.modified_ms ?? f.modified * 1000;
}

function normFolderPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export const SmartSelectBar: React.FC<SmartSelectBarProps> = ({
  groups,
  selectedFilePaths,
  setSelectedFilePaths,
  categoryFilter,
}) => {
  const [protectedFolder, setProtectedFolder] = useState<string>("");

  // Filter groups according to the active category
  const activeGroups = useMemo(() => {
    if (categoryFilter === "all") return groups;
    return groups.filter((g) => {
      const firstFile = g.files[0];
      return getFileCategory(firstFile?.extension || "") === categoryFilter;
    });
  }, [groups, categoryFilter]);

  // Unique folders present in active groups for "Protect Folder" quick rule
  const availableFolders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of activeGroups) {
      const seenInGroup = new Set<string>();
      for (const f of g.files) {
        if (f.directory && !seenInGroup.has(f.directory)) {
          seenInGroup.add(f.directory);
          counts.set(f.directory, (counts.get(f.directory) || 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 30);
  }, [activeGroups]);

  // All file paths belonging to the active category
  const activeCategoryPaths = useMemo(() => {
    const set = new Set<string>();
    for (const group of activeGroups) {
      for (const f of group.files) {
        set.add(f.path);
      }
    }
    return set;
  }, [activeGroups]);

  const selectedInActiveCategory = useMemo(() => {
    let count = 0;
    for (const path of selectedFilePaths) {
      if (activeCategoryPaths.has(path)) count++;
    }
    return count;
  }, [selectedFilePaths, activeCategoryPaths]);

  const selectedInOtherCategories = useMemo(() => {
    if (categoryFilter === "all") return 0;
    return selectedFilePaths.size - selectedInActiveCategory;
  }, [selectedFilePaths.size, selectedInActiveCategory, categoryFilter]);

  // Helper applying a deterministic keeper rule while guaranteeing >= 1 copy stays kept per group
  const applySmartRule = (comparator: (a: FileEntry, b: FileEntry) => number) => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      for (const path of activeCategoryPaths) {
        next.delete(path);
      }
      for (const group of activeGroups) {
        if (group.files.length < 2) continue;
        const sorted = [...group.files].sort(comparator);
        for (let i = 1; i < sorted.length; i++) {
          next.add(sorted[i].path);
        }
      }
      return next;
    });
  };

  // 1. Keep Oldest (millisecond precision + path length tie-breaker)
  const handleKeepOldest = () => {
    applySmartRule(
      (a, b) =>
        getTimeMs(a) - getTimeMs(b) ||
        a.path.length - b.path.length ||
        a.path.localeCompare(b.path)
    );
  };

  // 2. Keep Newest (millisecond precision + path length tie-breaker)
  const handleKeepNewest = () => {
    applySmartRule(
      (a, b) =>
        getTimeMs(b) - getTimeMs(a) ||
        a.path.length - b.path.length ||
        a.path.localeCompare(b.path)
    );
  };

  // 3. Keep Shortest Path (cleanest hierarchy + oldest timestamp tie-breaker)
  const handleKeepShortestPath = () => {
    applySmartRule(
      (a, b) =>
        a.path.length - b.path.length ||
        getTimeMs(a) - getTimeMs(b) ||
        a.path.localeCompare(b.path)
    );
  };

  // 4. Keep In Protected Folder (only selects outside copies in groups that have a copy inside protectedFolder)
  const handleProtectFolder = (folderPath: string) => {
    setProtectedFolder(folderPath);
    if (!folderPath) return;

    const targetNorm = normFolderPath(folderPath);
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      for (const group of activeGroups) {
        if (group.files.length < 2) continue;
        const inside: FileEntry[] = [];
        const outside: FileEntry[] = [];

        for (const f of group.files) {
          const dirNorm = normFolderPath(f.directory);
          if (dirNorm === targetNorm || dirNorm.startsWith(`${targetNorm}/`)) {
            inside.push(f);
          } else {
            outside.push(f);
          }
        }

        // Only act on groups that actually have at least one copy safely inside protectedFolder
        if (inside.length > 0 && outside.length > 0) {
          for (const f of group.files) {
            next.delete(f.path);
          }
          for (const f of outside) {
            next.add(f.path);
          }
        }
      }
      return next;
    });
  };

  // 5. Deselect Category without touching other tabs
  const handleDeselectCategory = () => {
    if (categoryFilter === "all") {
      setSelectedFilePaths(new Set());
    } else {
      setSelectedFilePaths((prev) => {
        const next = new Set(prev);
        for (const path of activeCategoryPaths) {
          next.delete(path);
        }
        return next;
      });
    }
  };

  const handleDeselectAll = () => {
    setSelectedFilePaths(new Set());
  };

  if (groups.length === 0) return null;

  const currentCategoryName = CATEGORY_NAMES[categoryFilter] || "All Types";
  const isFiltered = categoryFilter !== "all";

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 px-5 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs select-none shrink-0">
      {/* Left: Scope Info */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-1.5 text-indigo-400">
          <Sparkles className="w-4 h-4" />
          <span className="font-semibold text-slate-200">Auto-Select:</span>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
          <span className="text-slate-400 text-[11px]">Scope:</span>
          <span
            className={`font-semibold text-[11px] ${
              isFiltered ? "text-indigo-300" : "text-slate-200"
            }`}
          >
            {currentCategoryName}
          </span>
          <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
            {activeGroups.length} {activeGroups.length === 1 ? "group" : "groups"}
          </span>
          {isFiltered && selectedInOtherCategories > 0 && (
            <span
              className="text-[10px] text-emerald-400 font-mono pl-1"
              title={`${selectedInOtherCategories} items preserved in other categories`}
            >
              • {selectedInOtherCategories} in other tabs
            </span>
          )}
        </div>
      </div>

      {/* Right: Smart Actions */}
      <div className="flex items-center flex-wrap gap-2">
        <button
          onClick={handleKeepOldest}
          disabled={activeGroups.length === 0}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={`Keep earliest file in each ${currentCategoryName} group`}
        >
          <History className="w-3.5 h-3.5 text-blue-400" />
          <span>Keep Oldest</span>
        </button>

        <button
          onClick={handleKeepNewest}
          disabled={activeGroups.length === 0}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={`Keep latest file in each ${currentCategoryName} group`}
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>Keep Newest</span>
        </button>

        <button
          onClick={handleKeepShortestPath}
          disabled={activeGroups.length === 0}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={`Keep cleanest/shortest folder path in ${currentCategoryName}`}
        >
          <FolderTree className="w-3.5 h-3.5 text-amber-400" />
          <span>Keep Shortest Path</span>
        </button>

        {availableFolders.length > 1 && (
          <div className="flex items-center space-x-1 bg-slate-800 border border-slate-700/60 rounded-lg px-2 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={protectedFolder}
              onChange={(e) => handleProtectFolder(e.target.value)}
              className="bg-transparent text-[11px] text-slate-300 outline-none max-w-[165px] cursor-pointer"
              title="Keep copies inside this master folder and mark external copies for trash"
            >
              <option value="" className="bg-slate-900">
                Protect Master Folder...
              </option>
              {availableFolders.map(([dir, cnt]) => (
                <option key={dir} value={dir} className="bg-slate-900">
                  Keep in {dir.split(/[/\\]/).filter(Boolean).pop() || dir} ({cnt})
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedInActiveCategory > 0 && (
          <button
            onClick={handleDeselectCategory}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg transition cursor-pointer"
            title={
              isFiltered
                ? `Deselect only ${currentCategoryName} (${selectedInActiveCategory}), keep other categories selected`
                : "Deselect all files"
            }
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {isFiltered
                ? `Clear ${currentCategoryName} (${selectedInActiveCategory})`
                : "Deselect All"}
            </span>
          </button>
        )}

        {isFiltered && selectedInOtherCategories > 0 && (
          <button
            onClick={handleDeselectAll}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer text-[11px]"
            title={`Clear all ${selectedFilePaths.size} selections across every category`}
          >
            <XCircle className="w-3 h-3" />
            <span>Clear All ({selectedFilePaths.size})</span>
          </button>
        )}
      </div>
    </div>
  );
};
