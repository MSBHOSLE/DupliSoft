import React from "react";
import { Square, History, Sparkles, FolderTree } from "lucide-react";
import { DuplicateGroup } from "../types";

interface SmartSelectBarProps {
  groups: DuplicateGroup[];
  setSelectedFilePaths: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const SmartSelectBar: React.FC<SmartSelectBarProps> = ({
  groups,
  setSelectedFilePaths,
}) => {
  // Keep oldest: In each group, find the one with the smallest modified timestamp, keep it, mark all others for deletion
  const handleKeepOldest = () => {
    const nextSet = new Set<string>();
    for (const group of groups) {
      if (group.files.length < 2) continue;
      // Sort ascending by modified time
      const sorted = [...group.files].sort((a, b) => a.modified - b.modified);
      // Keep index 0, mark the rest
      for (let i = 1; i < sorted.length; i++) {
        nextSet.add(sorted[i].path);
      }
    }
    setSelectedFilePaths(nextSet);
  };

  // Keep newest: In each group, find the one with the largest modified timestamp, keep it, mark all others
  const handleKeepNewest = () => {
    const nextSet = new Set<string>();
    for (const group of groups) {
      if (group.files.length < 2) continue;
      // Sort descending by modified time
      const sorted = [...group.files].sort((a, b) => b.modified - a.modified);
      // Keep index 0, mark the rest
      for (let i = 1; i < sorted.length; i++) {
        nextSet.add(sorted[i].path);
      }
    }
    setSelectedFilePaths(nextSet);
  };

  // Keep shortest path: keeps the one closest to root directory
  const handleKeepShortestPath = () => {
    const nextSet = new Set<string>();
    for (const group of groups) {
      if (group.files.length < 2) continue;
      const sorted = [...group.files].sort((a, b) => a.path.length - b.path.length);
      for (let i = 1; i < sorted.length; i++) {
        nextSet.add(sorted[i].path);
      }
    }
    setSelectedFilePaths(nextSet);
  };

  const handleDeselectAll = () => {
    setSelectedFilePaths(new Set());
  };

  if (groups.length === 0) return null;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between text-xs select-none">
      <div className="flex items-center space-x-2 text-slate-300">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <span className="font-semibold text-slate-200">Smart Auto-Select:</span>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={handleKeepOldest}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg transition"
          title="Keep original/earliest file in each group, mark newer copies for trash"
        >
          <History className="w-3.5 h-3.5 text-blue-400" />
          <span>Keep Oldest Copy</span>
        </button>

        <button
          onClick={handleKeepNewest}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg transition"
          title="Keep most recently modified file in each group, mark older copies for trash"
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>Keep Newest Copy</span>
        </button>

        <button
          onClick={handleKeepShortestPath}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg transition"
          title="Keep files with cleanest/shortest folder paths"
        >
          <FolderTree className="w-3.5 h-3.5 text-amber-400" />
          <span>Keep Shortest Path</span>
        </button>

        <button
          onClick={handleDeselectAll}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-lg transition"
        >
          <Square className="w-3.5 h-3.5" />
          <span>Clear Selection</span>
        </button>
      </div>
    </div>
  );
};
