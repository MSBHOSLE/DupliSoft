import React, { useMemo } from "react";
import { Sparkles, History, FolderTree, RotateCcw, XCircle } from "lucide-react";
import { DuplicateGroup, FileCategory } from "../types";
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

export const SmartSelectBar: React.FC<SmartSelectBarProps> = ({
  groups,
  selectedFilePaths,
  setSelectedFilePaths,
  categoryFilter,
}) => {
  // Filter groups according to the active category
  const activeGroups = useMemo(() => {
    if (categoryFilter === "all") return groups;
    return groups.filter((g) => {
      const firstFile = g.files[0];
      return getFileCategory(firstFile?.extension || "") === categoryFilter;
    });
  }, [groups, categoryFilter]);

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

  // How many selected files are in the active category
  const selectedInActiveCategory = useMemo(() => {
    let count = 0;
    for (const path of selectedFilePaths) {
      if (activeCategoryPaths.has(path)) count++;
    }
    return count;
  }, [selectedFilePaths, activeCategoryPaths]);

  // How many selected files are in other categories
  const selectedInOtherCategories = useMemo(() => {
    if (categoryFilter === "all") return 0;
    return selectedFilePaths.size - selectedInActiveCategory;
  }, [selectedFilePaths.size, selectedInActiveCategory, categoryFilter]);

  // 1. Keep Oldest: For activeGroups only, keep earliest modified file, mark newer copies
  const handleKeepOldest = () => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      for (const path of activeCategoryPaths) {
        next.delete(path);
      }
      for (const group of activeGroups) {
        if (group.files.length < 2) continue;
        const sorted = [...group.files].sort((a, b) => a.modified - b.modified);
        for (let i = 1; i < sorted.length; i++) {
          next.add(sorted[i].path);
        }
      }
      return next;
    });
  };

  // 2. Keep Newest: For activeGroups only, keep newest modified file, mark older copies
  const handleKeepNewest = () => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      for (const path of activeCategoryPaths) {
        next.delete(path);
      }
      for (const group of activeGroups) {
        if (group.files.length < 2) continue;
        const sorted = [...group.files].sort((a, b) => b.modified - a.modified);
        for (let i = 1; i < sorted.length; i++) {
          next.add(sorted[i].path);
        }
      }
      return next;
    });
  };

  // 3. Keep Shortest: For activeGroups only, keep shortest file path, mark others
  const handleKeepShortestPath = () => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      for (const path of activeCategoryPaths) {
        next.delete(path);
      }
      for (const group of activeGroups) {
        if (group.files.length < 2) continue;
        const sorted = [...group.files].sort((a, b) => a.path.length - b.path.length);
        for (let i = 1; i < sorted.length; i++) {
          next.add(sorted[i].path);
        }
      }
      return next;
    });
  };

  // 4. Deselect Category: Deselect only files in the active category without clearing other categories
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

  // 5. Global Deselect All: Clear all categories
  const handleDeselectAll = () => {
    setSelectedFilePaths(new Set());
  };

  if (groups.length === 0) return null;

  const currentCategoryName = CATEGORY_NAMES[categoryFilter] || "All Types";
  const isFiltered = categoryFilter !== "all";

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 px-5 py-2.5 flex items-center justify-between text-xs select-none">
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
          <span className="text-[10px] font-mono text-slate-400 px-1 py-0.2 rounded bg-slate-900 border border-slate-800">
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
      <div className="flex items-center space-x-2">
        <button
          onClick={handleKeepOldest}
          disabled={activeGroups.length === 0}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={`Keep oldest file in each ${currentCategoryName} duplicate group, mark newer copies for deletion`}
        >
          <History className="w-3.5 h-3.5 text-blue-400" />
          <span>Keep Oldest Copy</span>
        </button>

        <button
          onClick={handleKeepNewest}
          disabled={activeGroups.length === 0}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={`Keep most recently modified file in each ${currentCategoryName} duplicate group, mark older copies for deletion`}
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>Keep Newest Copy</span>
        </button>

        <button
          onClick={handleKeepShortestPath}
          disabled={activeGroups.length === 0}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={`Keep files with cleanest/shortest folder paths in ${currentCategoryName}`}
        >
          <FolderTree className="w-3.5 h-3.5 text-amber-400" />
          <span>Keep Shortest Path</span>
        </button>

        {/* Deselect only this category */}
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
              {isFiltered ? `Clear ${currentCategoryName} (${selectedInActiveCategory})` : "Deselect All"}
            </span>
          </button>
        )}

        {/* If filtered and selections exist in other categories, offer option to clear all */}
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
