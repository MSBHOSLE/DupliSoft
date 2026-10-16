use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub modified: u64,
    pub extension: String,
    pub directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub id: String,
    pub hash: String,
    pub size: u64,
    pub wasted_bytes: u64,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanOptions {
    pub directories: Vec<String>,
    pub min_size: u64,
    pub max_size: Option<u64>,
    pub exclude_patterns: Vec<String>,
    pub check_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub phase: String, // "indexing" | "chunk_hashing" | "full_hashing" | "completed"
    pub files_scanned: u64,
    pub total_candidates: u64,
    pub current_file: String,
    pub duplicate_groups_found: usize,
    pub potential_savings: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub groups: Vec<DuplicateGroup>,
    pub total_files_scanned: u64,
    pub total_duplicates_found: usize,
    pub total_wasted_bytes: u64,
    pub scan_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashResult {
    pub successful: Vec<String>,
    pub failed: Vec<(String, String)>,
    pub total_freed_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SheetPreview {
    pub sheet_name: String,
    pub total_rows: usize,
    pub total_cols: usize,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpreadsheetPreview {
    pub file_path: String,
    pub format: String,
    pub total_sheets: usize,
    pub sheets: Vec<SheetPreview>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextPreview {
    pub file_path: String,
    pub total_lines: usize,
    pub total_words: usize,
    pub total_chars: usize,
    pub lines: Vec<String>,
    pub is_truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocParagraph {
    pub is_heading: bool,
    pub heading_level: u8,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocxPreview {
    pub file_path: String,
    pub title: Option<String>,
    pub author: Option<String>,
    pub total_paragraphs: usize,
    pub total_words: usize,
    pub paragraphs: Vec<DocParagraph>,
    pub is_truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideInfo {
    pub slide_number: usize,
    pub title: Option<String>,
    pub text_snippets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PptxPreview {
    pub file_path: String,
    pub slide_count: usize,
    pub title: Option<String>,
    pub thumbnail_base64: Option<String>,
    pub slides: Vec<SlideInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveEntry {
    pub name: String,
    pub size: u64,
    pub compressed_size: u64,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivePreview {
    pub file_path: String,
    pub total_entries: usize,
    pub total_uncompressed_bytes: u64,
    pub total_compressed_bytes: u64,
    pub entries: Vec<ArchiveEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookCell {
    pub cell_type: String,
    pub execution_count: Option<i64>,
    pub source: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookPreview {
    pub file_path: String,
    pub kernel_name: Option<String>,
    pub language: Option<String>,
    pub total_cells: usize,
    pub code_cells_count: usize,
    pub markdown_cells_count: usize,
    pub cells: Vec<NotebookCell>,
    pub is_truncated: bool,
}

