import React, { useState, useMemo } from "react";
import {
  DuplicateGroup,
  FileCategory,
  FileEntry,
} from "../types";
import {
  formatBytes,
  formatDate,
  getFileCategory,
  isImage,
  isVideo,
  isPdf,
  isAudio,
} from "../utils/formatters";
import {
  Search,
  Image,
  Film,
  FileText,
  Music,
  Archive,
  File,
  Eye,
  ExternalLink,
  FolderOpen,
  CheckSquare,
  Square,
} from "lucide-react";

interface DuplicateListProps {
  groups: DuplicateGroup[];
  selectedFilePaths: Set<string>;
  onToggleSelect: (path: string) => void;
  onOpenPreview: (group: DuplicateGroup) => void;
  onRevealFile: (path: string) => void;
}

export const DuplicateList: React.FC<DuplicateListProps> = ({
  groups,
  selectedFilePaths,
  onToggleSelect,
  onOpenPreview,
  onRevealFile,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FileCategory>("all");

  const categories: { key: FileCategory; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All Types", icon: <File className="w-3.5 h-3.5" /> },
    { key: "images", label: "Images", icon: <Image className="w-3.5 h-3.5" /> },
    { key: "videos", label: "Videos", icon: <Film className="w-3.5 h-3.5" /> },
    { key: "documents", label: "PDFs & Docs", icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "audio", label: "Audio", icon: <Music className="w-3.5 h-3.5" /> },
    { key: "archives", label: "Archives", icon: <Archive className="w-3.5 h-3.5" /> },
  ];

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const firstFile = g.files[0];
      const cat = getFileCategory(firstFile?.extension || "");

      // Category filter
      if (categoryFilter !== "all" && cat !== categoryFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = g.files.some(
          (f) => f.filename.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [groups, categoryFilter, searchQuery]);

  const getCategoryIcon = (ext: string) => {
    if (isImage(ext)) return <Image className="w-4 h-4 text-emerald-400" />;
    if (isVideo(ext)) return <Film className="w-4 h-4 text-purple-400" />;
    if (isPdf(ext)) return <FileText className="w-4 h-4 text-rose-400" />;
    if (isAudio(ext)) return <Music className="w-4 h-4 text-amber-400" />;
    return <File className="w-4 h-4 text-slate-400" />;
  };

  const handleKeepOnlyInGroup = (group: DuplicateGroup, keepFile: FileEntry) => {
    group.files.forEach((f) => {
      if (f.path === keepFile.path) {
        if (selectedFilePaths.has(f.path)) onToggleSelect(f.path);
      } else {
        if (!selectedFilePaths.has(f.path)) onToggleSelect(f.path);
      }
    });
  };

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
          <FolderOpen className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-300">Ready to Scan</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Select folders on the left and click "Start High-Speed Scan" to find duplicate files with zero cloud upload.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-6.5rem)] overflow-hidden">
      {/* Search and Category Filter Toolbar */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-4 select-none">
        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                categoryFilter === cat.key
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name or path..."
            className="w-full bg-slate-850 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Duplicate Groups List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No duplicate files match your search filter.
          </div>
        ) : (
          filteredGroups.map((group, groupIdx) => {
            const firstFile = group.files[0];
            const ext = firstFile?.extension || "";
            const isInspectable = isImage(ext) || isVideo(ext) || isPdf(ext) || isAudio(ext);

            return (
              <div
                key={group.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition hover:border-slate-700/80"
              >
                {/* Group Card Header */}
                <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="p-2 rounded-lg bg-slate-800 border border-slate-700/60">
                      {getCategoryIcon(ext)}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white font-mono">
                          Group #{groupIdx + 1}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-300 font-medium">
                          {formatBytes(group.size)} per file
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                          {group.files.length} Copies
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Hash: {group.hash.slice(0, 16)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                      +{formatBytes(group.wasted_bytes)} Wasted
                    </span>

                    {/* Inspect / Side-by-Side Preview Button */}
                    <button
                      onClick={() => onOpenPreview(group)}
                      className="flex items-center space-x-1.5 text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer"
                      title="Open Side-by-Side Zoom & Video Preview Inspector"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isInspectable ? "Preview & Compare" : "Compare"}</span>
                    </button>
                  </div>
                </div>

                {/* Files in this Duplicate Group */}
                <div className="divide-y divide-slate-800/60">
                  {group.files.map((file, fileIdx) => {
                    const isSelected = selectedFilePaths.has(file.path);

                    return (
                      <div
                        key={file.path}
                        className={`px-4 py-2.5 flex items-center justify-between text-xs transition ${
                          isSelected
                            ? "bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
                            : "hover:bg-slate-850/60"
                        }`}
                      >
                        {/* Checkbox and File Details */}
                        <div className="flex items-center space-x-3 flex-1 truncate pr-4">
                          <button
                            onClick={() => onToggleSelect(file.path)}
                            className="text-slate-400 hover:text-white transition cursor-pointer"
                            title={isSelected ? "Uncheck (keep file)" : "Check (mark for trash)"}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </button>

                          <div className="truncate flex-1">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`font-medium truncate ${
                                  isSelected
                                    ? "text-rose-300 line-through decoration-rose-500/60"
                                    : "text-slate-200"
                                }`}
                              >
                                {file.filename}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Copy #{fileIdx + 1}
                              </span>
                            </div>
                            <p
                              className="text-[11px] font-mono text-slate-500 truncate"
                              title={file.path}
                            >
                              {file.path}
                            </p>
                          </div>
                        </div>

                        {/* File Metadata & Quick Actions */}
                        <div className="flex items-center space-x-4 shrink-0">
                          <span className="text-[11px] text-slate-400">
                            {formatDate(file.modified)}
                          </span>

                          <button
                            onClick={() => onRevealFile(file.path)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                            title="Show in Finder / File Explorer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleKeepOnlyInGroup(group, file)}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600/20 hover:text-emerald-300 text-slate-400 border border-slate-700/60 transition"
                            title="Keep only this copy and select all other duplicates in this group for deletion"
                          >
                            Keep Only This
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
