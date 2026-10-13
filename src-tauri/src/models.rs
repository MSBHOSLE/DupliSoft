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
