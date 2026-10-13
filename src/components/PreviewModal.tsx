import React, { useState, useRef, useEffect } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { DuplicateGroup, FileEntry, ImageQuality, SimilarPhotoMatch } from "../types";
import { formatBytes, formatDate, isImage, isVideo, isPdf, isAudio } from "../utils/formatters";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Pause,
  ExternalLink,
  ShieldCheck,
  Columns,
  CheckCircle,
  Sparkles,
  Camera,
} from "lucide-react";

interface PreviewModalProps {
  group: DuplicateGroup;
  selectedFilePaths: Set<string>;
  onToggleSelect: (path: string) => void;
  onRevealFile: (path: string) => void;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  group,
  selectedFilePaths,
  onToggleSelect,
  onRevealFile,
  onClose,
}) => {
  // If group has 2+ files, default compare File 0 and File 1
  const [fileAIndex, setFileAIndex] = useState<number>(0);
  const [fileBIndex, setFileBIndex] = useState<number>(group.files.length > 1 ? 1 : 0);
  const [isSideBySide, setIsSideBySide] = useState<boolean>(group.files.length > 1);

  // Zoom state for images & PDFs
  const [zoomA, setZoomA] = useState<number>(100);
  const [zoomB, setZoomB] = useState<number>(100);
  const [syncZoom] = useState<boolean>(true);

  // Video sync playback
  const [isPlayingSync, setIsPlayingSync] = useState<boolean>(false);
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);

  const fileA = group.files[fileAIndex] || group.files[0];
  const fileB = group.files[fileBIndex] || group.files[0];

  const ext = fileA.extension.toLowerCase();
  const isImg = isImage(ext);
  const isVid = isVideo(ext);
  const isDocPdf = isPdf(ext);
  const isAud = isAudio(ext);

  const urlA = convertFileSrc(fileA.path);
  const urlB = convertFileSrc(fileB.path);

  // Pure math algorithms: Image Quality (Laplacian Blur) & Perceptual dHash
  const [qualityA, setQualityA] = useState<ImageQuality | null>(null);
  const [qualityB, setQualityB] = useState<ImageQuality | null>(null);
  const [dhashMatch, setDhashMatch] = useState<SimilarPhotoMatch | null>(null);

  useEffect(() => {
    if (isImg && fileA) {
      invoke<ImageQuality>("get_image_quality", { path: fileA.path })
        .then(setQualityA)
        .catch(() => setQualityA(null));
    } else {
      setQualityA(null);
    }

    if (isImg && fileB) {
      invoke<ImageQuality>("get_image_quality", { path: fileB.path })
        .then(setQualityB)
        .catch(() => setQualityB(null));
    } else {
      setQualityB(null);
    }

    if (isImg && fileA && fileB && fileA.path !== fileB.path) {
      invoke<SimilarPhotoMatch>("compare_images_dhash", {
        pathA: fileA.path,
        pathB: fileB.path,
      })
        .then(setDhashMatch)
        .catch(() => setDhashMatch(null));
    } else {
      setDhashMatch(null);
    }
  }, [fileAIndex, fileBIndex, isImg, fileA.path, fileB.path]);

  const handleZoomChange = (newZoom: number, target: "A" | "B") => {
    const clamped = Math.max(50, Math.min(600, newZoom));
    if (syncZoom) {
      setZoomA(clamped);
      setZoomB(clamped);
    } else {
      if (target === "A") setZoomA(clamped);
      else setZoomB(clamped);
    }
  };

  const handleToggleSyncPlay = () => {
    if (videoRefA.current && videoRefB.current) {
      if (isPlayingSync) {
        videoRefA.current.pause();
        videoRefB.current.pause();
        setIsPlayingSync(false);
      } else {
        videoRefB.current.currentTime = videoRefA.current.currentTime;
        videoRefA.current.play();
        videoRefB.current.play();
        setIsPlayingSync(true);
      }
    }
  };

  // Keep single file selection action
  const handleKeepOnly = (keepFile: FileEntry) => {
    group.files.forEach((f) => {
      if (f.path === keepFile.path) {
        if (selectedFilePaths.has(f.path)) onToggleSelect(f.path); // keep unselected
      } else {
        if (!selectedFilePaths.has(f.path)) onToggleSelect(f.path); // mark for deletion
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Columns className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-lg text-white">Side-by-Side File Inspector</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Identical Hash: {group.hash.slice(0, 12)}...
                </span>
                {dhashMatch && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1 font-mono">
                    <Camera className="w-3.5 h-3.5" />
                    dHash: {dhashMatch.similarity_percentage}% Visual Match (Distance: {dhashMatch.hamming_distance})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Compare files visually before deleting. Size: {formatBytes(group.size)} each •{" "}
                {group.files.length} duplicate copies found
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            {group.files.length > 1 && (
              <button
                onClick={() => setIsSideBySide(!isSideBySide)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isSideBySide
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                <Columns className="w-4 h-4" />
                <span>{isSideBySide ? "Side-by-Side Mode" : "Single View Mode"}</span>
              </button>
            )}

            {/* Zoom Controls for Images & PDFs */}
            {(isImg || isDocPdf) && (
              <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700 space-x-2">
                <button
                  onClick={() => handleZoomChange(zoomA - 25, "A")}
                  className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-medium text-slate-300 w-12 text-center">
                  {zoomA}%
                </span>
                <button
                  onClick={() => handleZoomChange(zoomA + 25, "A")}
                  className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setZoomA(100);
                    setZoomB(100);
                  }}
                  className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  title="Reset Zoom (100%)"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Video Sync Play Toggle */}
            {isVid && isSideBySide && (
              <button
                onClick={handleToggleSyncPlay}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition"
              >
                {isPlayingSync ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlayingSync ? "Pause Both" : "Sync Play Both"}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* File A View */}
          <div className={`flex-1 flex flex-col border-r border-slate-800 overflow-hidden`}>
            {/* File A Sub-Header */}
            <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  File A
                </span>
                <select
                  value={fileAIndex}
                  onChange={(e) => setFileAIndex(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 outline-none max-w-xs truncate"
                >
                  {group.files.map((f, i) => (
                    <option key={f.path} value={i}>
                      Copy {i + 1}: {f.filename}
                    </option>
                  ))}
                </select>
                {qualityA && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1 ${
                      qualityA.is_blurry
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                    title="Laplacian Edge Variance Blur Analysis"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>
                      Sharpness: {qualityA.sharpness_score}/100 ({qualityA.is_blurry ? "Blurry" : "Crisp"}) • {qualityA.resolution}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onRevealFile(fileA.path)}
                  className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2 py-1 hover:bg-slate-800 rounded transition"
                  title="Show in Finder / Explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Reveal</span>
                </button>
                <button
                  onClick={() => handleKeepOnly(fileA)}
                  className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded font-medium transition"
                  title="Keep this file and mark all other duplicates in this group for deletion"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Keep This Copy</span>
                </button>
              </div>
            </div>

            {/* File A Viewer Stage */}
            <div className="flex-1 bg-slate-950/90 relative overflow-auto flex items-center justify-center p-4">
              {isImg && (
                <div
                  className="transition-transform duration-100 ease-out flex items-center justify-center"
                  style={{ transform: `scale(${zoomA / 100})`, transformOrigin: "center center" }}
                >
                  <img
                    src={urlA}
                    alt={fileA.filename}
                    className="max-h-[68vh] max-w-full object-contain rounded shadow-lg select-none"
                    draggable={false}
                  />
                </div>
              )}

              {isDocPdf && (
                <iframe
                  src={urlA}
                  title={fileA.filename}
                  className="w-full h-full rounded border border-slate-800 bg-white"
                />
              )}

              {isVid && (
                <video
                  ref={videoRefA}
                  src={urlA}
                  controls
                  className="max-h-[68vh] max-w-full rounded shadow-xl bg-black"
                />
              )}

              {isAud && (
                <div className="w-full max-w-md p-6 bg-slate-850 rounded-xl border border-slate-700/60 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
                    <Play className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-2">{fileA.filename}</h4>
                  <audio controls src={urlA} className="w-full mt-2" />
                </div>
              )}

              {!isImg && !isDocPdf && !isVid && !isAud && (
                <div className="text-center p-8 text-slate-400">
                  <p className="text-sm">Preview not directly supported for .{fileA.extension} files.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Both files share the exact same 256-bit BLAKE3 hash and byte length.
                  </p>
                </div>
              )}
            </div>

            {/* File A Metadata Footer */}
            <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-300 truncate max-w-md" title={fileA.path}>
                  {fileA.path}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    selectedFilePaths.has(fileA.path)
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {selectedFilePaths.has(fileA.path) ? "Marked for Trash" : "Will Be Kept"}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-slate-500 text-[11px]">
                <span>Modified: {formatDate(fileA.modified)}</span>
                <span>Size: {formatBytes(fileA.size)}</span>
              </div>
            </div>
          </div>

          {/* File B View (Side-by-Side) */}
          {isSideBySide && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* File B Sub-Header */}
              <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    File B
                  </span>
                  <select
                    value={fileBIndex}
                    onChange={(e) => setFileBIndex(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 outline-none max-w-xs truncate"
                  >
                    {group.files.map((f, i) => (
                      <option key={f.path} value={i}>
                        Copy {i + 1}: {f.filename}
                      </option>
                    ))}
                  </select>
                  {qualityB && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1 ${
                        qualityB.is_blurry
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                      title="Laplacian Edge Variance Blur Analysis"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>
                        Sharpness: {qualityB.sharpness_score}/100 ({qualityB.is_blurry ? "Blurry" : "Crisp"}) • {qualityB.resolution}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onRevealFile(fileB.path)}
                    className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2 py-1 hover:bg-slate-800 rounded transition"
                    title="Show in Finder / Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Reveal</span>
                  </button>
                  <button
                    onClick={() => handleKeepOnly(fileB)}
                    className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded font-medium transition"
                    title="Keep this file and mark all other duplicates in this group for deletion"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Keep This Copy</span>
                  </button>
                </div>
              </div>

              {/* File B Viewer Stage */}
              <div className="flex-1 bg-slate-950/90 relative overflow-auto flex items-center justify-center p-4">
                {isImg && (
                  <div
                    className="transition-transform duration-100 ease-out flex items-center justify-center"
                    style={{ transform: `scale(${zoomB / 100})`, transformOrigin: "center center" }}
                  >
                    <img
                      src={urlB}
                      alt={fileB.filename}
                      className="max-h-[68vh] max-w-full object-contain rounded shadow-lg select-none"
                      draggable={false}
                    />
                  </div>
                )}

                {isDocPdf && (
                  <iframe
                    src={urlB}
                    title={fileB.filename}
                    className="w-full h-full rounded border border-slate-800 bg-white"
                  />
                )}

                {isVid && (
                  <video
                    ref={videoRefB}
                    src={urlB}
                    controls
                    className="max-h-[68vh] max-w-full rounded shadow-xl bg-black"
                  />
                )}

                {isAud && (
                  <div className="w-full max-w-md p-6 bg-slate-850 rounded-xl border border-slate-700/60 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4">
                      <Play className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-2">{fileB.filename}</h4>
                    <audio controls src={urlB} className="w-full mt-2" />
                  </div>
                )}

                {!isImg && !isDocPdf && !isVid && !isAud && (
                  <div className="text-center p-8 text-slate-400">
                    <p className="text-sm">Preview not directly supported for .{fileB.extension} files.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Both files share the exact same 256-bit BLAKE3 hash and byte length.
                    </p>
                  </div>
                )}
              </div>

              {/* File B Metadata Footer */}
              <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-300 truncate max-w-md" title={fileB.path}>
                    {fileB.path}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      selectedFilePaths.has(fileB.path)
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {selectedFilePaths.has(fileB.path) ? "Marked for Trash" : "Will Be Kept"}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-slate-500 text-[11px]">
                  <span>Modified: {formatDate(fileB.modified)}</span>
                  <span>Size: {formatBytes(fileB.size)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
