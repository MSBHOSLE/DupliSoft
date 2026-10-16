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

export type FileCategory = "all" | "images" | "videos" | "documents" | "audio" | "archives" | "code" | "other";

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

export interface SheetPreview {
  sheet_name: string;
  total_rows: number;
  total_cols: number;
  headers: string[];
  rows: string[][];
}

export interface SpreadsheetPreview {
  file_path: string;
  format: string;
  total_sheets: number;
  sheets: SheetPreview[];
}

export interface TextPreview {
  file_path: string;
  total_lines: number;
  total_words: number;
  total_chars: number;
  lines: string[];
  is_truncated: boolean;
}

export interface DocParagraph {
  is_heading: boolean;
  heading_level: number;
  text: string;
}

export interface DocxPreview {
  file_path: string;
  title?: string;
  author?: string;
  total_paragraphs: number;
  total_words: number;
  paragraphs: DocParagraph[];
  is_truncated: boolean;
}

export interface SlideInfo {
  slide_number: number;
  title?: string;
  text_snippets: string[];
}

export interface PptxPreview {
  file_path: string;
  slide_count: number;
  title?: string;
  thumbnail_base64?: string;
  slides: SlideInfo[];
}

export interface ArchiveEntry {
  name: string;
  size: number;
  compressed_size: number;
  is_dir: boolean;
}

export interface ArchivePreview {
  file_path: string;
  total_entries: number;
  total_uncompressed_bytes: number;
  total_compressed_bytes: number;
  entries: ArchiveEntry[];
}

export interface NotebookCell {
  cell_type: string;
  execution_count?: number | null;
  source: string[];
}

export interface NotebookPreview {
  file_path: string;
  kernel_name?: string | null;
  language?: string | null;
  total_cells: number;
  code_cells_count: number;
  markdown_cells_count: number;
  cells: NotebookCell[];
  is_truncated: boolean;
}

