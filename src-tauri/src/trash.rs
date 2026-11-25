use crate::hasher::hash_file_full;
use crate::models::{TrashRequestItem, TrashResult};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

/// Safely moves verified duplicate files to the operating system's Trash / Recycle Bin.
/// Re-verifies size and cryptographic BLAKE3 hash immediately before trashing to guard against TOCTOU races.
pub fn delete_to_trash_verified(items: Vec<TrashRequestItem>) -> TrashResult {
    let mut successful = Vec::new();
    let mut failed = Vec::new();
    let mut total_freed_bytes = 0u64;
    let mut seen_paths: HashSet<String> = HashSet::new();

    for item in items {
        let path_str = item.path;
        let path = Path::new(&path_str);

        let dedup_key = fs::canonicalize(path)
            .map(|p| {
                let s = p.to_string_lossy().to_string();
                #[cfg(target_os = "windows")]
                {
                    return s.to_lowercase();
                }
                #[cfg(not(target_os = "windows"))]
                {
                    return s;
                }
            })
            .unwrap_or_else(|_| path_str.clone());

        if !seen_paths.insert(dedup_key) {
            continue;
        }

        if !path.exists() {
            failed.push((path_str, "File does not exist".to_string()));
            continue;
        }

        let meta = match fs::metadata(path) {
            Ok(m) => m,
            Err(e) => {
                failed.push((path_str, format!("Cannot read metadata: {}", e)));
                continue;
            }
        };

        let file_size = meta.len();

        // Guard 1: Verify file size has not changed since scan
        if let Some(expected_size) = item.expected_size {
            if file_size != expected_size {
                failed.push((
                    path_str,
                    format!(
                        "File modified after scan (size changed {} -> {} bytes) — skipped for safety",
                        expected_size, file_size
                    ),
                ));
                continue;
            }
        }

        // Guard 2: Verify BLAKE3 cryptographic hash has not changed since scan
        if let Some(ref expected_hash) = item.expected_hash {
            match hash_file_full(path) {
                Ok(current_hash) => {
                    if &current_hash != expected_hash {
                        failed.push((
                            path_str,
                            "File content changed after scan (hash mismatch) — skipped for safety"
                                .to_string(),
                        ));
                        continue;
                    }
                }
                Err(e) => {
                    failed.push((
                        path_str,
                        format!("Failed pre-trash integrity hash check: {}", e),
                    ));
                    continue;
                }
            }
        }

        match trash::delete(path) {
            Ok(_) => {
                total_freed_bytes += file_size;
                successful.push(path_str);
            }
            Err(e) => {
                failed.push((path_str, e.to_string()));
            }
        }
    }

    TrashResult {
        successful,
        failed,
        total_freed_bytes,
    }
}

/// Legacy compatibility wrapper for trashing raw path strings.
pub fn delete_to_trash(paths: Vec<String>) -> TrashResult {
    let items = paths
        .into_iter()
        .map(|path| TrashRequestItem {
            path,
            expected_size: None,
            expected_hash: None,
        })
        .collect();
    delete_to_trash_verified(items)
}

/// Reveals and selects a file in macOS Finder, Windows Explorer, or Linux File Manager.
pub fn show_in_file_manager(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let win_path = path_str.replace('/', "\\");
        let sanitized = win_path.strip_prefix(r"\\?\").unwrap_or(&win_path);
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", sanitized))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try highlighting the exact file over Freedesktop FileManager1 DBus first
        let abs = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        let file_uri = format!("file://{}", abs.to_string_lossy());
        let dbus_ok = std::process::Command::new("dbus-send")
            .args([
                "--session",
                "--dest=org.freedesktop.FileManager1",
                "--type=method_call",
                "/org/freedesktop/FileManager1",
                "org.freedesktop.FileManager1.ShowItems",
                &format!("array:string:{}", file_uri),
                "string:",
            ])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if !dbus_ok {
            let target = path.parent().unwrap_or(path);
            std::process::Command::new("xdg-open")
                .arg(target)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verified_trash_blocks_modified_file() {
        let temp_dir = std::env::temp_dir().join("duplisoft_test_toctou");
        let _ = std::fs::create_dir_all(&temp_dir);
        let file_path = temp_dir.join("guarded.txt");
        std::fs::write(&file_path, b"original content").unwrap();

        let original_hash = hash_file_full(&file_path).unwrap();

        // Simulate file edited after scan before user hits Delete
        std::fs::write(&file_path, b"modified after scan!").unwrap();

        let res = delete_to_trash_verified(vec![TrashRequestItem {
            path: file_path.to_string_lossy().to_string(),
            expected_size: Some(b"original content".len() as u64),
            expected_hash: Some(original_hash),
        }]);

        assert!(res.successful.is_empty());
        assert_eq!(res.failed.len(), 1);
        assert!(file_path.exists());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
