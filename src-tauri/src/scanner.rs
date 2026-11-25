use crate::hasher::{
    hash_file_chunks, hash_file_full, verify_files_byte_identical, CHUNK_SIZE,
};
use crate::models::{DuplicateGroup, FileEntry, ScanOptions, ScanProgress, ScanResult};
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Instant, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

const MAX_SKIPPED_SAMPLE: usize = 25;

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

/// Ensures `is_running` is always reset on exit, cancellation, or panic.
struct RunningGuard(Arc<AtomicBool>);

impl Drop for RunningGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

pub fn strip_windows_verbatim(path: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let s = path.to_string_lossy();
        if let Some(stripped) = s.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
    }
    path.to_path_buf()
}

/// Normalizes queued directories: resolves canonical paths and removes nested subdirectories
/// when an ancestor directory is already included, preventing false self-duplicates.
pub fn normalize_scan_directories(dirs: &[String], skip_symlinks: bool) -> Vec<(PathBuf, PathBuf)> {
    let mut candidates: Vec<(PathBuf, PathBuf)> = Vec::new();

    for raw in dirs {
        let p = Path::new(raw);
        if !p.exists() || !p.is_dir() {
            continue;
        }
        if skip_symlinks && p.is_symlink() {
            continue;
        }
        let canon = fs::canonicalize(p)
            .map(|c| strip_windows_verbatim(&c))
            .unwrap_or_else(|_| strip_windows_verbatim(p));
        let display = strip_windows_verbatim(p);
        candidates.push((canon, display));
    }

    // Sort shortest/shallowest canonical paths first so parents always precede children
    candidates.sort_by(|a, b| {
        a.0.components()
            .count()
            .cmp(&b.0.components().count())
            .then_with(|| a.0.cmp(&b.0))
    });

    let mut accepted: Vec<(PathBuf, PathBuf)> = Vec::new();
    for (canon, display) in candidates {
        let is_nested = accepted.iter().any(|(parent_canon, _)| canon.starts_with(parent_canon));
        if !is_nested {
            accepted.push((canon, display));
        }
    }

    accepted
}

/// Case-insensitive Unicode-safe wildcard matcher supporting `*` and `?`.
pub fn matches_glob(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.to_lowercase().chars().collect();
    let t: Vec<char> = text.to_lowercase().chars().collect();
    let (mut pi, mut ti) = (0usize, 0usize);
    let mut star_idx: Option<usize> = None;
    let mut match_idx = 0usize;

    while ti < t.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == t[ti]) {
            pi += 1;
            ti += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star_idx = Some(pi);
            match_idx = ti;
            pi += 1;
        } else if let Some(si) = star_idx {
            pi = si + 1;
            match_idx += 1;
            ti = match_idx;
        } else {
            return false;
        }
    }

    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }

    pi == p.len()
}

fn is_excluded(file_name: &str, full_path: &Path, patterns: &[String]) -> bool {
    let norm_path = full_path.to_string_lossy().replace('\\', "/");
    for raw_pat in patterns {
        let pat = raw_pat.trim();
        if pat.is_empty() {
            continue;
        }
        let norm_pat = pat.replace('\\', "/");
        if norm_pat.contains('/') {
            let trimmed = norm_pat.trim_start_matches('/');
            if matches_glob(&norm_pat, &norm_path)
                || matches_glob(&format!("*/{}", trimmed), &norm_path)
            {
                return true;
            }
        } else if matches_glob(&norm_pat, file_name) {
            return true;
        }
    }
    false
}

fn get_physical_file_key(path: &Path, meta: &fs::Metadata) -> String {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        // Guard against exotic FUSE/network filesystems that report inode 0 for all entries
        if meta.ino() != 0 {
            return format!("unix:{}:{}", meta.dev(), meta.ino());
        }
    }
    #[cfg(any(not(unix), unix))]
    {
        let _ = meta;
        fs::canonicalize(path)
            .map(|p| {
                let s = strip_windows_verbatim(&p).to_string_lossy().to_string();
                #[cfg(target_os = "windows")]
                {
                    return format!("path:{}", s.to_lowercase());
                }
                #[cfg(not(target_os = "windows"))]
                {
                    return format!("path:{}", s);
                }
            })
            .unwrap_or_else(|_| format!("path:{}", path.to_string_lossy()))
    }
}

fn record_skip(
    count: &mut usize,
    sample: &mut Vec<(String, String)>,
    path: &Path,
    reason: String,
) {
    *count += 1;
    if sample.len() < MAX_SKIPPED_SAMPLE {
        sample.push((path.to_string_lossy().to_string(), reason));
    }
}

pub fn run_scan(
    app: AppHandle,
    options: ScanOptions,
    is_running: Arc<AtomicBool>,
) -> Result<ScanResult, String> {
    run_scan_with_progress(options, is_running, |progress| {
        let _ = app.emit("scan-progress", progress);
    })
}

pub fn run_scan_with_progress<F>(
    options: ScanOptions,
    is_running: Arc<AtomicBool>,
    emit_progress: F,
) -> Result<ScanResult, String>
where
    F: Fn(ScanProgress) + Send + Sync,
{
    if is_running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("A scan is already running".to_string());
    }
    let _guard = RunningGuard(is_running.clone());

    let start_time = Instant::now();

    let default_excludes = vec![
        ".git".to_string(),
        ".svn".to_string(),
        "node_modules".to_string(),
        "target".to_string(),
        ".DS_Store".to_string(),
        "$RECYCLE.BIN".to_string(),
        "System Volume Information".to_string(),
        ".Trash".to_string(),
        ".Trashes".to_string(),
        ".Spotlight-V100".to_string(),
        ".fseventsd".to_string(),
    ];

    let mut all_excludes = default_excludes;
    all_excludes.extend(options.exclude_patterns.clone());

    let normalized_dirs = normalize_scan_directories(&options.directories, options.skip_symlinks);

    // -------------------------------------------------------------
    // STAGE 1: Discovery & File Size Grouping (O(N), Zero byte reads)
    // -------------------------------------------------------------
    emit_progress(ScanProgress {
        phase: "indexing".to_string(),
        files_scanned: 0,
        total_candidates: 0,
        current_file: "Scanning directories...".to_string(),
        duplicate_groups_found: 0,
        potential_savings: 0,
    });

    let mut size_map: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    let mut seen_canon_paths: HashSet<String> = HashSet::new();
    let mut seen_physical_ids: HashSet<String> = HashSet::new();
    let mut total_files_scanned = 0u64;
    let mut skipped_files_count = 0usize;
    let mut skipped_files_sample: Vec<(String, String)> = Vec::new();
    let mut hardlinks_skipped = 0usize;
    let mut empty_files_ignored = 0usize;

    for (_canon_dir, dir_path) in &normalized_dirs {
        let dir_label = dir_path.to_string_lossy().to_string();
        let walker = WalkDir::new(dir_path)
            .follow_links(!options.skip_symlinks)
            .into_iter()
            .filter_entry(|e| {
                if options.skip_symlinks && e.path_is_symlink() {
                    return false;
                }
                let file_name = e.file_name().to_string_lossy();
                if !options.check_hidden && file_name.starts_with('.') && file_name != "." && e.depth() > 0 {
                    return false;
                }
                if e.depth() > 0 && is_excluded(&file_name, e.path(), &all_excludes) {
                    return false;
                }
                true
            });

        for entry_res in walker {
            if !is_running.load(Ordering::SeqCst) {
                return Err("Scan was cancelled by user".to_string());
            }

            let entry = match entry_res {
                Ok(e) => e,
                Err(err) => {
                    let err_path = err.path().unwrap_or_else(|| Path::new("")).to_path_buf();
                    record_skip(
                        &mut skipped_files_count,
                        &mut skipped_files_sample,
                        &err_path,
                        err.to_string(),
                    );
                    continue;
                }
            };

            if options.skip_symlinks && entry.path_is_symlink() {
                continue;
            }

            if entry.file_type().is_file() {
                total_files_scanned += 1;

                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(err) => {
                        record_skip(
                            &mut skipped_files_count,
                            &mut skipped_files_sample,
                            entry.path(),
                            err.to_string(),
                        );
                        continue;
                    }
                };

                let size = metadata.len();

                if size == 0 && options.ignore_empty_files {
                    empty_files_ignored += 1;
                    continue;
                }

                if size < options.min_size {
                    continue;
                }
                if let Some(max_size) = options.max_size {
                    if size > max_size {
                        continue;
                    }
                }

                let file_path = strip_windows_verbatim(entry.path());
                let canon_key = fs::canonicalize(&file_path)
                    .map(|p| {
                        let s = strip_windows_verbatim(&p).to_string_lossy().to_string();
                        #[cfg(target_os = "windows")]
                        {
                            return s.to_lowercase();
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            return s;
                        }
                    })
                    .unwrap_or_else(|_| file_path.to_string_lossy().to_string());

                if !seen_canon_paths.insert(canon_key) {
                    continue;
                }

                if options.deduplicate_hardlinks {
                    let phys_key = get_physical_file_key(&file_path, &metadata);
                    if !seen_physical_ids.insert(phys_key) {
                        hardlinks_skipped += 1;
                        continue;
                    }
                }

                size_map.entry(size).or_default().push(file_path);

                if total_files_scanned % 500 == 0 {
                    emit_progress(ScanProgress {
                        phase: "indexing".to_string(),
                        files_scanned: total_files_scanned,
                        total_candidates: 0,
                        current_file: dir_label.clone(),
                        duplicate_groups_found: 0,
                        potential_savings: 0,
                    });
                }
            }
        }
    }

    let candidate_groups: Vec<(u64, Vec<PathBuf>)> = size_map
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .collect();

    let small_limit = (CHUNK_SIZE * 2) as u64;
    let mut small_candidates: Vec<(u64, Vec<PathBuf>)> = Vec::new();
    let mut large_candidates: Vec<(u64, Vec<PathBuf>)> = Vec::new();

    for (size, files) in candidate_groups {
        if size <= small_limit {
            small_candidates.push((size, files));
        } else {
            large_candidates.push((size, files));
        }
    }

    let total_candidates: u64 = small_candidates
        .iter()
        .chain(large_candidates.iter())
        .map(|(_, files)| files.len() as u64)
        .sum();

    // -------------------------------------------------------------
    // STAGE 2: Parallel Chunk Hashing + Direct Hashing for <= 32KB
    // -------------------------------------------------------------
    emit_progress(ScanProgress {
        phase: "chunk_hashing".to_string(),
        files_scanned: total_files_scanned,
        total_candidates,
        current_file: "Hashing candidate headers, trailers & small files in parallel..."
            .to_string(),
        duplicate_groups_found: 0,
        potential_savings: 0,
    });

    let mut hash_buckets: HashMap<(u64, String), Vec<PathBuf>> = HashMap::new();

    // Small files (<= 32KB) are hashed completely once here — never read twice!
    if !small_candidates.is_empty() {
        let small_items: Vec<(u64, PathBuf)> = small_candidates
            .into_iter()
            .flat_map(|(s, paths)| paths.into_iter().map(move |p| (s, p)))
            .collect();

        let hashed_small: Vec<Result<(u64, String, PathBuf), (PathBuf, String)>> = small_items
            .into_par_iter()
            .filter_map(|(expected_size, path)| {
                if !is_running.load(Ordering::Relaxed) {
                    return None;
                }
                match fs::metadata(&path) {
                    Ok(m) if m.len() != expected_size => {
                        Some(Err((path, "Size changed during scan".to_string())))
                    }
                    Err(e) => Some(Err((path, e.to_string()))),
                    Ok(_) => match hash_file_full(&path) {
                        Ok(hash) => Some(Ok((expected_size, hash, path))),
                        Err(e) => Some(Err((path, e.to_string()))),
                    },
                }
            })
            .collect();

        if !is_running.load(Ordering::SeqCst) {
            return Err("Scan was cancelled by user".to_string());
        }

        for item in hashed_small {
            match item {
                Ok((size, hash, path)) => {
                    hash_buckets.entry((size, hash)).or_default().push(path);
                }
                Err((path, reason)) => {
                    record_skip(
                        &mut skipped_files_count,
                        &mut skipped_files_sample,
                        &path,
                        reason,
                    );
                }
            }
        }
    }

    // Large files (> 32KB) pass through parallel 32KB prefix/suffix elimination first
    let mut full_hash_candidates: Vec<(u64, Vec<PathBuf>)> = Vec::new();
    if !large_candidates.is_empty() {
        let large_items: Vec<(u64, PathBuf)> = large_candidates
            .into_iter()
            .flat_map(|(s, paths)| paths.into_iter().map(move |p| (s, p)))
            .collect();

        let chunked: Vec<Result<(u64, [u8; 32], PathBuf), (PathBuf, String)>> = large_items
            .into_par_iter()
            .filter_map(|(size, path)| {
                if !is_running.load(Ordering::Relaxed) {
                    return None;
                }
                match hash_file_chunks(&path, size) {
                    Ok(chunk_hash) => Some(Ok((size, chunk_hash, path))),
                    Err(e) => Some(Err((path, e.to_string()))),
                }
            })
            .collect();

        if !is_running.load(Ordering::SeqCst) {
            return Err("Scan was cancelled by user".to_string());
        }

        let mut chunk_hash_map: HashMap<(u64, [u8; 32]), Vec<PathBuf>> = HashMap::new();
        for item in chunked {
            match item {
                Ok((size, chunk_hash, path)) => {
                    chunk_hash_map
                        .entry((size, chunk_hash))
                        .or_default()
                        .push(path);
                }
                Err((path, reason)) => {
                    record_skip(
                        &mut skipped_files_count,
                        &mut skipped_files_sample,
                        &path,
                        reason,
                    );
                }
            }
        }

        full_hash_candidates = chunk_hash_map
            .into_iter()
            .filter(|(_, files)| files.len() > 1)
            .map(|((size, _), files)| (size, files))
            .collect();
    }

    // -------------------------------------------------------------
    // STAGE 3: Full Multithreaded BLAKE3 Hashing for Large Candidates
    // -------------------------------------------------------------
    if !full_hash_candidates.is_empty() {
        let stage3_total: u64 = full_hash_candidates
            .iter()
            .map(|(_, f)| f.len() as u64)
            .sum();

        emit_progress(ScanProgress {
            phase: "full_hashing".to_string(),
            files_scanned: total_files_scanned,
            total_candidates: stage3_total,
            current_file: "Computing full cryptographic BLAKE3 hashes...".to_string(),
            duplicate_groups_found: 0,
            potential_savings: 0,
        });

        let full_items: Vec<(u64, PathBuf)> = full_hash_candidates
            .into_iter()
            .flat_map(|(s, paths)| paths.into_iter().map(move |p| (s, p)))
            .collect();

        let hashed_large: Vec<Result<(u64, String, PathBuf), (PathBuf, String)>> = full_items
            .into_par_iter()
            .filter_map(|(expected_size, path)| {
                if !is_running.load(Ordering::Relaxed) {
                    return None;
                }
                match fs::metadata(&path) {
                    Ok(m) if m.len() != expected_size => {
                        Some(Err((path, "Size changed during scan".to_string())))
                    }
                    Err(e) => Some(Err((path, e.to_string()))),
                    Ok(_) => match hash_file_full(&path) {
                        Ok(hash) => Some(Ok((expected_size, hash, path))),
                        Err(e) => Some(Err((path, e.to_string()))),
                    },
                }
            })
            .collect();

        if !is_running.load(Ordering::SeqCst) {
            return Err("Scan was cancelled by user".to_string());
        }

        for item in hashed_large {
            match item {
                Ok((size, hash, path)) => {
                    hash_buckets.entry((size, hash)).or_default().push(path);
                }
                Err((path, reason)) => {
                    record_skip(
                        &mut skipped_files_count,
                        &mut skipped_files_sample,
                        &path,
                        reason,
                    );
                }
            }
        }
    }

    // Filter down to groups with >= 2 copies
    let mut matched_buckets: Vec<(u64, String, Vec<PathBuf>)> = hash_buckets
        .into_iter()
        .filter(|(_, paths)| paths.len() > 1)
        .map(|((size, hash), paths)| (size, hash, paths))
        .collect();

    // -------------------------------------------------------------
    // OPTIONAL STAGE 4: Strict 100% Byte-for-Byte Streaming Verification
    // -------------------------------------------------------------
    let mut verified_buckets: Vec<(u64, String, bool, Vec<PathBuf>)> = Vec::new();
    if options.verify_byte_for_byte && !matched_buckets.is_empty() {
        let verify_total: u64 = matched_buckets.iter().map(|(_, _, p)| p.len() as u64).sum();
        emit_progress(ScanProgress {
            phase: "byte_verifying".to_string(),
            files_scanned: total_files_scanned,
            total_candidates: verify_total,
            current_file: "Running 100% byte-for-byte safety confirmation...".to_string(),
            duplicate_groups_found: 0,
            potential_savings: 0,
        });

        for (size, hash, paths) in matched_buckets.drain(..) {
            if !is_running.load(Ordering::SeqCst) {
                return Err("Scan was cancelled by user".to_string());
            }

            let mut clusters: Vec<Vec<PathBuf>> = Vec::new();
            for p in paths {
                let mut matched_cluster = false;
                for cluster in &mut clusters {
                    match verify_files_byte_identical(&cluster[0], &p) {
                        Ok(true) => {
                            cluster.push(p.clone());
                            matched_cluster = true;
                            break;
                        }
                        Ok(false) => continue,
                        Err(e) => {
                            record_skip(
                                &mut skipped_files_count,
                                &mut skipped_files_sample,
                                &p,
                                e.to_string(),
                            );
                            matched_cluster = true; // exclude unreadable file from clusters
                            break;
                        }
                    }
                }
                if !matched_cluster {
                    clusters.push(vec![p]);
                }
            }

            for cluster in clusters {
                if cluster.len() > 1 {
                    verified_buckets.push((size, hash.clone(), true, cluster));
                }
            }
        }
    } else {
        for (size, hash, paths) in matched_buckets {
            verified_buckets.push((size, hash, false, paths));
        }
    }

    // Build final sorted DuplicateGroup objects
    let mut final_duplicate_groups: Vec<DuplicateGroup> = Vec::new();
    for (cluster_idx, (size, hash, byte_verified, mut group_paths)) in
        verified_buckets.into_iter().enumerate()
    {
        group_paths.sort();

        let mut entries: Vec<FileEntry> = Vec::with_capacity(group_paths.len());
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

            let (modified, modified_ms) = fs::metadata(&path)
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| (d.as_secs(), d.as_millis().min(u64::MAX as u128) as u64))
                .unwrap_or((0, 0));

            entries.push(FileEntry {
                path: path.to_string_lossy().to_string(),
                filename,
                size,
                modified,
                modified_ms,
                extension,
                directory,
            });
        }

        let count = entries.len() as u64;
        let wasted = (count - 1) * size;
        let prefix = &hash[..hash.len().min(8)];
        let group_id = format!("{}_{}_{}", prefix, size, cluster_idx);

        final_duplicate_groups.push(DuplicateGroup {
            id: group_id,
            hash,
            size,
            wasted_bytes: wasted,
            byte_verified,
            files: entries,
        });
    }

    final_duplicate_groups.sort_by(|a, b| {
        b.wasted_bytes
            .cmp(&a.wasted_bytes)
            .then_with(|| a.id.cmp(&b.id))
    });

    let total_duplicates_found: usize = final_duplicate_groups
        .iter()
        .map(|g| g.files.len() - 1)
        .sum();
    let total_wasted_bytes: u64 = final_duplicate_groups.iter().map(|g| g.wasted_bytes).sum();
    let scan_duration_ms = start_time.elapsed().as_millis() as u64;

    emit_progress(ScanProgress {
        phase: "completed".to_string(),
        files_scanned: total_files_scanned,
        total_candidates: 0,
        current_file: "Completed".to_string(),
        duplicate_groups_found: final_duplicate_groups.len(),
        potential_savings: total_wasted_bytes,
    });

    Ok(ScanResult {
        groups: final_duplicate_groups,
        total_files_scanned,
        total_duplicates_found,
        total_wasted_bytes,
        scan_duration_ms,
        skipped_files_count,
        skipped_files_sample,
        hardlinks_skipped,
        empty_files_ignored,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_matches_glob_wildcards() {
        assert!(matches_glob("*.tmp", "cache_123.TMP"));
        assert!(matches_glob("backup_?.zip", "backup_a.zip"));
        assert!(!matches_glob("backup_?.zip", "backup_ab.zip"));
        assert!(matches_glob("*/node_modules/*", "/Users/dev/project/node_modules/pkg"));
        assert!(matches_glob("Thumbs.db", "thumbs.db"));
    }

    #[test]
    fn test_nested_directories_do_not_self_duplicate() {
        let root = std::env::temp_dir().join("duplisoft_test_nested_dirs");
        let sub = root.join("nested");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&sub).unwrap();

        let f1 = sub.join("unique_photo.jpg");
        std::fs::write(&f1, vec![7u8; 4096]).unwrap();

        // Queue BOTH root AND root/nested
        let options = ScanOptions {
            directories: vec![
                root.to_string_lossy().to_string(),
                sub.to_string_lossy().to_string(),
            ],
            min_size: 0,
            max_size: None,
            exclude_patterns: vec![],
            check_hidden: true,
            ignore_empty_files: true,
            verify_byte_for_byte: true,
            skip_symlinks: true,
            deduplicate_hardlinks: true,
        };

        let result =
            run_scan_with_progress(options, Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        assert_eq!(result.groups.len(), 0);
        assert_eq!(result.total_duplicates_found, 0);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn test_small_and_large_duplicates_byte_verified() {
        let root = std::env::temp_dir().join("duplisoft_test_small_large");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();

        // Empty 0-byte duplicates (should be ignored by ignore_empty_files)
        std::fs::write(root.join(".gitkeep"), b"").unwrap();
        std::fs::write(root.join("empty2"), b"").unwrap();

        // Small duplicates (<= 32KB)
        std::fs::write(root.join("small_a.txt"), b"hello duplisoft").unwrap();
        std::fs::write(root.join("small_b.txt"), b"hello duplisoft").unwrap();

        // Large duplicates (> 32KB)
        let big_payload = vec![55u8; 80 * 1024];
        std::fs::write(root.join("large_a.bin"), &big_payload).unwrap();
        std::fs::write(root.join("large_b.bin"), &big_payload).unwrap();

        // Excluded glob file
        std::fs::write(root.join("ignored_a.tmp"), &big_payload).unwrap();
        std::fs::write(root.join("ignored_b.tmp"), &big_payload).unwrap();

        let options = ScanOptions {
            directories: vec![root.to_string_lossy().to_string()],
            min_size: 0,
            max_size: None,
            exclude_patterns: vec!["*.tmp".to_string()],
            check_hidden: true,
            ignore_empty_files: true,
            verify_byte_for_byte: true,
            skip_symlinks: true,
            deduplicate_hardlinks: true,
        };

        let result =
            run_scan_with_progress(options, Arc::new(AtomicBool::new(false)), |_| {}).unwrap();

        assert_eq!(result.empty_files_ignored, 2);
        assert_eq!(result.groups.len(), 2);
        assert!(result.groups.iter().all(|g| g.byte_verified));
        assert_eq!(result.total_duplicates_found, 2);

        let _ = std::fs::remove_dir_all(&root);
    }
}
