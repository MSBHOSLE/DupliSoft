use crate::hasher::{hash_file_chunks, hash_file_full};
use crate::models::{DuplicateGroup, FileEntry, ScanOptions, ScanProgress, ScanResult};
use rayon::prelude::*;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Instant, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

pub struct ScannerState {
    pub is_running: Arc<AtomicBool>,
}

impl ScannerState {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}

pub fn run_scan(
    app: AppHandle,
    options: ScanOptions,
    is_running: Arc<AtomicBool>,
) -> Result<ScanResult, String> {
    let start_time = Instant::now();
    is_running.store(true, Ordering::SeqCst);

    let default_excludes = vec![
        ".git".to_string(),
        ".svn".to_string(),
        "node_modules".to_string(),
        "target".to_string(),
        ".DS_Store".to_string(),
        "$RECYCLE.BIN".to_string(),
        ".Trash".to_string(),
    ];

    let mut all_excludes = default_excludes;
    all_excludes.extend(options.exclude_patterns.clone());

    // -------------------------------------------------------------
    // STAGE 1: Discovery & Size Grouping (O(N), Zero byte reads)
    // -------------------------------------------------------------
    let _ = app.emit(
        "scan-progress",
        ScanProgress {
            phase: "indexing".to_string(),
            files_scanned: 0,
            total_candidates: 0,
            current_file: "Scanning directories...".to_string(),
            duplicate_groups_found: 0,
            potential_savings: 0,
        },
    );

    let mut size_map: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    let mut total_files_scanned = 0u64;

    for dir_str in &options.directories {
        let dir_path = Path::new(dir_str);
        if !dir_path.exists() {
            continue;
        }

        let walker = WalkDir::new(dir_path).into_iter().filter_entry(|e| {
            let file_name = e.file_name().to_string_lossy();

            // Skip hidden files if not enabled
            if !options.check_hidden && file_name.starts_with('.') && file_name != "." {
                return false;
            }

            // Skip common system / exclude patterns
            for pat in &all_excludes {
                if file_name.eq_ignore_ascii_case(pat) {
                    return false;
                }
            }
            true
        });

        for entry in walker.flatten() {
            if !is_running.load(Ordering::SeqCst) {
                return Err("Scan was cancelled by user".to_string());
            }

            if entry.file_type().is_file() {
                total_files_scanned += 1;

                if let Ok(metadata) = entry.metadata() {
                    let size = metadata.len();

                    // Check minimum and maximum file size filters
                    if size < options.min_size {
                        continue;
                    }
                    if let Some(max_size) = options.max_size {
                        if size > max_size {
                            continue;
                        }
                    }

                    size_map.entry(size).or_default().push(entry.into_path());
                }

                if total_files_scanned % 500 == 0 {
                    let _ = app.emit(
                        "scan-progress",
                        ScanProgress {
                            phase: "indexing".to_string(),
                            files_scanned: total_files_scanned,
                            total_candidates: 0,
                            current_file: dir_str.clone(),
                            duplicate_groups_found: 0,
                            potential_savings: 0,
                        },
                    );
                }
            }
        }
    }

    // Keep only buckets with 2 or more files (eliminated ~90-95% of unique files!)
    let candidate_groups: Vec<(u64, Vec<PathBuf>)> = size_map
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .collect();

    let total_candidates: u64 = candidate_groups
        .iter()
        .map(|(_, files)| files.len() as u64)
        .sum();

    // -------------------------------------------------------------
    // STAGE 2: Chunk Hashing (First 16KB + Last 16KB BLAKE3)
    // -------------------------------------------------------------
    let _ = app.emit(
        "scan-progress",
        ScanProgress {
            phase: "chunk_hashing".to_string(),
            files_scanned: total_files_scanned,
            total_candidates,
            current_file: "Verifying candidate headers and trailers...".to_string(),
            duplicate_groups_found: 0,
            potential_savings: 0,
        },
    );

    // Group files by (size, chunk_hash)
    let mut chunk_hash_map: HashMap<(u64, [u8; 32]), Vec<PathBuf>> = HashMap::new();

    for (size, files) in candidate_groups {
        if !is_running.load(Ordering::SeqCst) {
            return Err("Scan was cancelled by user".to_string());
        }

        for path in files {
            if let Ok(chunk_hash) = hash_file_chunks(&path, size) {
                chunk_hash_map
                    .entry((size, chunk_hash))
                    .or_default()
                    .push(path);
            }
        }
    }

    // Filter to groups that still have 2 or more files after chunk hashing
    let full_hash_candidates: Vec<(u64, Vec<PathBuf>)> = chunk_hash_map
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .map(|((size, _), files)| (size, files))
        .collect();

    // -------------------------------------------------------------
    // STAGE 3: Full Hashing (SIMD Parallel Streams via Rayon)
    // -------------------------------------------------------------
    let _ = app.emit(
        "scan-progress",
        ScanProgress {
            phase: "full_hashing".to_string(),
            files_scanned: total_files_scanned,
            total_candidates: full_hash_candidates
                .iter()
                .map(|(_, f)| f.len() as u64)
                .sum(),
            current_file: "Computing full cryptographic hashes...".to_string(),
            duplicate_groups_found: 0,
            potential_savings: 0,
        },
    );

    // For groups with identical chunk hashes, compute full BLAKE3 hash in parallel
    let mut final_duplicate_groups: Vec<DuplicateGroup> = Vec::new();

    for (size, paths) in full_hash_candidates {
        if !is_running.load(Ordering::SeqCst) {
            return Err("Scan was cancelled by user".to_string());
        }

        // Parallel hash calculation with Rayon
        let hashed_files: Vec<(String, PathBuf)> = paths
            .into_par_iter()
            .filter_map(|path| {
                if !is_running.load(Ordering::Relaxed) {
                    return None;
                }
                hash_file_full(&path).ok().map(|hash| (hash, path))
            })
            .collect();

        // Group by full hash
        let mut full_hash_buckets: HashMap<String, Vec<PathBuf>> = HashMap::new();
        for (hash, path) in hashed_files {
            full_hash_buckets.entry(hash).or_default().push(path);
        }

        for (hash, group_paths) in full_hash_buckets {
            if group_paths.len() > 1 {
                let mut entries: Vec<FileEntry> = Vec::new();

                for path in group_paths {
                    let filename = path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let extension = path
                        .extension()
                        .map(|e| e.to_string_lossy().to_string().to_lowercase())
                        .unwrap_or_default();
                    let directory = path
                        .parent()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let modified = fs::metadata(&path)
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    entries.push(FileEntry {
                        path: path.to_string_lossy().to_string(),
                        filename,
                        size,
                        modified,
                        extension,
                        directory,
                    });
                }

                let count = entries.len() as u64;
                let wasted = (count - 1) * size;
                let group_id = format!("{}_{}", &hash[..8], size);

                final_duplicate_groups.push(DuplicateGroup {
                    id: group_id,
                    hash,
                    size,
                    wasted_bytes: wasted,
                    files: entries,
                });
            }
        }
    }

    // Sort duplicate groups by wasted bytes descending (biggest space wasters first!)
    final_duplicate_groups.sort_by(|a, b| b.wasted_bytes.cmp(&a.wasted_bytes));

    let total_duplicates_found: usize = final_duplicate_groups
        .iter()
        .map(|g| g.files.len() - 1)
        .sum();
    let total_wasted_bytes: u64 = final_duplicate_groups.iter().map(|g| g.wasted_bytes).sum();
    let scan_duration_ms = start_time.elapsed().as_millis() as u64;

    is_running.store(false, Ordering::SeqCst);

    let _ = app.emit(
        "scan-progress",
        ScanProgress {
            phase: "completed".to_string(),
            files_scanned: total_files_scanned,
            total_candidates: 0,
            current_file: "Completed".to_string(),
            duplicate_groups_found: final_duplicate_groups.len(),
            potential_savings: total_wasted_bytes,
        },
    );

    Ok(ScanResult {
        groups: final_duplicate_groups,
        total_files_scanned,
        total_duplicates_found,
        total_wasted_bytes,
        scan_duration_ms,
    })
}
