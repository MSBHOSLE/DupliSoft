use crate::models::TrashResult;
use std::fs;
use std::path::Path;

/// Safely moves the specified files to the operating system's Trash / Recycle Bin.
pub fn delete_to_trash(paths: Vec<String>) -> TrashResult {
    let mut successful = Vec::new();
    let mut failed = Vec::new();
    let mut total_freed_bytes = 0u64;

    for path_str in paths {
        let path = Path::new(&path_str);
        if !path.exists() {
            failed.push((path_str, "File does not exist".to_string()));
            continue;
        }

        let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);

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

/// Reveals a file in macOS Finder or Windows Explorer.
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
        std::process::Command::new("explorer")
            .arg(format!("/select,\"{}\"", path_str))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
