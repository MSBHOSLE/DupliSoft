export interface FileEntry {
  path: string;
  filename: string;
  size: u64;
  modified: u64;
  extension: string;
  directory: string;
}

export type u64 = number;

export interface DuplicateGroup {
  id: string;
  hash: string;
  size: u64;
  wasted_bytes: u64;
  files: FileEntry[];
}

export interface ScanOptions {
  directories: string[];
  min_size: u64;
  max_size?: u64;
  exclude_patterns: string[];
  check_hidden: boolean;
}

export interface ScanProgress {
  phase: "indexing" | "chunk_hashing" | "full_hashing" | "completed";
  files_scanned: u64;
  total_candidates: u64;
  current_file: string;
  duplicate_groups_found: number;
  potential_savings: u64;
}

export interface ScanResult {
  groups: DuplicateGroup[];
  total_files_scanned: u64;
  total_duplicates_found: number;
  total_wasted_bytes: u64;
  scan_duration_ms: u64;
}

export interface TrashResult {
  successful: string[];
  failed: [string, string][];
  total_freed_bytes: u64;
}

export type FileCategory = "all" | "images" | "videos" | "documents" | "audio" | "archives" | "other";

export interface ImageQuality {
  sharpness_score: number;
  is_blurry: boolean;
  width: number;
  height: number;
  resolution: string;
  quality_rating: number;
}

export interface SimilarPhotoMatch {
  path_a: string;
  path_b: string;
  hamming_distance: number;
  similarity_percentage: number;
}
