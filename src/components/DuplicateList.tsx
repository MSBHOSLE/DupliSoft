import React, { useState, useMemo, useEffect } from "react";
import { DuplicateGroup, FileCategory, FileEntry } from "../types";
import {
  formatBytes,
  formatDate,
  getFileCategory,
  isArchive,
  isAudio,
  isCode,
  isImage,
  isNotebook,
  isPdf,
  isPpt,
  isSpreadsheet,
  isTextDoc,
  isVideo,
  isWord,
} from "../utils/formatters";
import {
  Search,
  Image,
  Film,
  FileText,
  Music,
  Archive,
  File,
  Code2,
  Eye,
  ExternalLink,
  FolderOpen,
  CheckSquare,
  Square,
  FileSpreadsheet,
  BookOpen,
  Presentation,
  ShieldCheck,
  Lock,
} from "lucide-react";

const PAGE_SIZE = 100;

interface DuplicateListProps {
  groups: DuplicateGroup[];
  selectedFilePaths: Set<string>;
  categoryFilter: FileCategory;
  setCategoryFilter: (cat: FileCategory) => void;
  onToggleSelect: (path: string) => void;
  onOpenPreview: (group: DuplicateGroup) => void;
  onRevealFile: (path: string) => void;
}

export const DuplicateList: React.FC<DuplicateListProps> = ({
  groups,
  selectedFilePaths,
  categoryFilter,
  setCategoryFilter,
  onToggleSelect,
  onOpenPreview,
  onRevealFile,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [categoryFilter, searchQuery, groups]);

  const categories: { key: FileCategory; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All Types", icon: <File className="w-3.5 h-3.5" /> },
    { key: "images", label: "Images", icon: <Image className="w-3.5 h-3.5" /> },
    { key: "videos", label: "Videos", icon: <Film className="w-3.5 h-3.5" /> },
    { key: "documents", label: "PDFs & Docs", icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "code", label: "Code & Notebooks", icon: <Code2 className="w-3.5 h-3.5" /> },
    { key: "audio", label: "Audio", icon: <Music className="w-3.5 h-3.5" /> },
    { key: "archives", label: "Archives", icon: <Archive className="w-3.5 h-3.5" /> },
  ];

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const firstFile = g.files[0];
      const cat = getFileCategory(firstFile?.extension || "");

      if (categoryFilter !== "all" && cat !== categoryFilter) {
        return false;
      }

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

  const visibleGroups = useMemo(
    () => filteredGroups.slice(0, visibleLimit),
    [filteredGroups, visibleLimit]
  );

  // Count selected files per category for badge indicators
  const categorySelectedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) {
      const cat = getFileCategory(g.files[0]?.extension || "");
      for (const f of g.files) {
        if (selectedFilePaths.has(f.path)) {
          counts[cat] = (counts[cat] || 0) + 1;
          counts["all"] = (counts["all"] || 0) + 1;
        }
      }
    }
    return counts;
  }, [groups, selectedFilePaths]);

  const getCategoryIcon = (ext: string) => {
    if (isImage(ext)) return <Image className="w-4 h-4 text-emerald-400" />;
    if (isVideo(ext)) return <Film className="w-4 h-4 text-purple-400" />;
    if (isPdf(ext)) return <FileText className="w-4 h-4 text-rose-400" />;
    if (isSpreadsheet(ext)) return <FileSpreadsheet className="w-4 h-4 text-emerald-300" />;
    if (isWord(ext)) return <BookOpen className="w-4 h-4 text-blue-400" />;
    if (isPpt(ext)) return <Presentation className="w-4 h-4 text-orange-400" />;
    if (isNotebook(ext)) return <BookOpen className="w-4 h-4 text-amber-400" />;
    if (isCode(ext)) return <Code2 className="w-4 h-4 text-indigo-400" />;
    if (isTextDoc(ext)) return <FileText className="w-4 h-4 text-cyan-400" />;
    if (isAudio(ext)) return <Music className="w-4 h-4 text-amber-400" />;
    if (isArchive(ext)) return <Archive className="w-4 h-4 text-purple-300" />;
    return <File className="w-4 h-4 text-slate-400" />;
  };

  const hasRichInspector = (ext: string) =>
    isImage(ext) ||
    isVideo(ext) ||
    isPdf(ext) ||
    isAudio(ext) ||
    isSpreadsheet(ext) ||
    isWord(ext) ||
    isPpt(ext) ||
    isNotebook(ext) ||
    isCode(ext) ||
    isTextDoc(ext) ||
    isArchive(ext);

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
          Drop folders into the window or add directories on the left, then click{" "}
          <strong className="text-slate-300">Start Verified Scan</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Search and Category Filter Toolbar */}
      <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between gap-4 select-none shrink-0">
        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {categories.map((cat) => {
            const selectedCount = categorySelectedCounts[cat.key] || 0;
            return (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  categoryFilter === cat.key
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
                {selectedCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded-full ${
                      categoryFilter === cat.key
                        ? "bg-white/25 text-white"
                        : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    }`}
                  >
                    {selectedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name or path..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Duplicate Groups List (Windowed for 10,000+ Groups) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No duplicate files match your search filter.
          </div>
        ) : (
          <>
            {visibleGroups.map((group, groupIdx) => {
              const firstFile = group.files[0];
              const ext = firstFile?.extension || "";
              const isInspectable = hasRichInspector(ext);
              const selectedInGroup = group.files.filter((f) => selectedFilePaths.has(f.path)).length;

              return (
                <div
                  key={group.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition hover:border-slate-700/80"
                >
                  {/* Group Card Header */}
                  <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="p-2 rounded-lg bg-slate-800 border border-slate-700/60 shrink-0">
                        {getCategoryIcon(ext)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-xs font-bold text-white font-mono">
                            Group #{groupIdx + 1}
                          </span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs text-slate-300 font-medium">
                            {formatBytes(group.size)} each
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            {group.files.length} Copies
                          </span>
                          {group.byte_verified && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-mono">
                              <ShieldCheck className="w-3 h-3" />
                              Byte-Verified
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono select-text">
                          BLAKE3: {group.hash.slice(0, 16)}...
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                        +{formatBytes(group.wasted_bytes)} Wasted
                      </span>

                      <button
                        onClick={() => onOpenPreview(group)}
                        className="flex items-center space-x-1.5 text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer"
                        title="Open Side-by-Side Inspector & Quality Comparison"
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
                      const isLastSafeCopy =
                        !isSelected && selectedInGroup >= group.files.length - 1;

                      return (
                        <div
                          key={file.path}
                          className={`px-4 py-2.5 flex items-center justify-between text-xs transition ${
                            isSelected
                              ? "bg-rose-500/[0.05] hover:bg-rose-500/[0.09]"
                              : "hover:bg-slate-800/50"
                          }`}
                        >
                          {/* Checkbox and File Details */}
                          <div className="flex items-center space-x-3 flex-1 truncate pr-4">
                            <button
                              onClick={() => {
                                if (!isLastSafeCopy) onToggleSelect(file.path);
                              }}
                              disabled={isLastSafeCopy}
                              className={`transition ${
                                isLastSafeCopy
                                  ? "text-emerald-400/80 cursor-not-allowed"
                                  : "text-slate-400 hover:text-white cursor-pointer"
                              }`}
                              title={
                                isLastSafeCopy
                                  ? "Last kept copy is protected — click 'Keep Only This' on another copy to swap"
                                  : isSelected
                                  ? "Uncheck (keep file)"
                                  : "Check (mark for trash)"
                              }
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                              ) : isLastSafeCopy ? (
                                <Lock className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500" />
                              )}
                            </button>

                            <div className="truncate flex-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`font-medium truncate select-text ${
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
                                {isLastSafeCopy && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                    Protected Copy
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-[11px] font-mono text-slate-500 truncate select-text"
                                title={file.path}
                              >
                                {file.path}
                              </p>
                            </div>
                          </div>

                          {/* File Metadata & Quick Actions */}
                          <div className="flex items-center space-x-3 shrink-0">
                            <span className="text-[11px] text-slate-400">
                              {formatDate(file.modified)}
                            </span>

                            <button
                              onClick={() => onRevealFile(file.path)}
                              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                              title="Show in Finder / File Explorer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleKeepOnlyInGroup(group, file)}
                              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-600/20 hover:text-emerald-300 text-slate-300 border border-slate-700/60 transition cursor-pointer"
                              title="Keep only this copy and mark all other copies in this group for trash"
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
            })}

            {filteredGroups.length > visibleLimit && (
              <div className="flex flex-col items-center py-4 space-y-2">
                <p className="text-xs text-slate-400">
                  Showing {visibleGroups.length.toLocaleString()} of{" "}
                  {filteredGroups.length.toLocaleString()} duplicate groups
                </p>
                <button
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Load Next {Math.min(PAGE_SIZE, filteredGroups.length - visibleLimit)} Groups
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
