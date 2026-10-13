import { FileCategory } from "../types";

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatDate(timestampSec: number): string {
  if (!timestampSec) return "Unknown";
  const date = new Date(timestampSec * 1000);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

export const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "tiff", "avif"]);
export const VIDEO_EXTS = new Set(["mp4", "mkv", "mov", "avi", "webm", "m4v", "wmv", "flv", "mpg", "mpeg"]);
export const AUDIO_EXTS = new Set(["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma", "aiff"]);
export const DOC_EXTS = new Set(["pdf", "doc", "docx", "txt", "md", "csv", "xlsx", "xls", "pptx", "rtf"]);
export const ARCHIVE_EXTS = new Set(["zip", "tar", "gz", "rar", "7z", "bz2", "xz"]);

export function isImage(ext: string): boolean {
  return IMAGE_EXTS.has(ext.toLowerCase());
}

export function isVideo(ext: string): boolean {
  return VIDEO_EXTS.has(ext.toLowerCase());
}

export function isPdf(ext: string): boolean {
  return ext.toLowerCase() === "pdf";
}

export function isAudio(ext: string): boolean {
  return AUDIO_EXTS.has(ext.toLowerCase());
}

export function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.has(e)) return "images";
  if (VIDEO_EXTS.has(e)) return "videos";
  if (DOC_EXTS.has(e)) return "documents";
  if (AUDIO_EXTS.has(e)) return "audio";
  if (ARCHIVE_EXTS.has(e)) return "archives";
  return "other";
}
