pub mod algorithms;
pub mod document_preview;
pub mod hasher;
pub mod models;
pub mod scanner;
pub mod spreadsheet;
pub mod trash;

use algorithms::{
    compute_image_dhash, compute_image_quality, compute_jaccard_similarity, hamming_distance,
    ImageQuality, SimilarPhotoMatch,
};
use models::{
    ArchivePreview, DocxPreview, NotebookPreview, PptxPreview, ScanOptions, ScanResult,
    SpreadsheetPreview, TextPreview, TrashRequestItem, TrashResult,
};
use scanner::{run_scan, strip_windows_verbatim, ScannerState};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
async fn start_scan(
    app: AppHandle,
    state: State<'_, Arc<ScannerState>>,
    options: ScanOptions,
) -> Result<ScanResult, String> {
    let is_running = state.is_running.clone();
    tauri::async_runtime::spawn_blocking(move || run_scan(app, options, is_running))
        .await
        .map_err(|e| format!("Task execution error: {}", e))?
}

#[tauri::command]
fn cancel_scan(state: State<'_, Arc<ScannerState>>) {
    state.cancel();
}

#[tauri::command]
async fn trash_files(paths: Vec<String>) -> Result<TrashResult, String> {
    tauri::async_runtime::spawn_blocking(move || trash::delete_to_trash(paths))
        .await
        .map_err(|e| format!("Trash task error: {}", e))
}

#[tauri::command]
async fn trash_files_verified(items: Vec<TrashRequestItem>) -> Result<TrashResult, String> {
    tauri::async_runtime::spawn_blocking(move || trash::delete_to_trash_verified(items))
        .await
        .map_err(|e| format!("Verified trash task error: {}", e))
}

#[tauri::command]
fn reveal_file(path: String) -> Result<(), String> {
    trash::show_in_file_manager(&path)
}

#[tauri::command]
async fn get_image_quality(path: String) -> Result<ImageQuality, String> {
    tauri::async_runtime::spawn_blocking(move || compute_image_quality(Path::new(&path)))
        .await
        .map_err(|e| format!("Image quality task error: {}", e))?
}

#[tauri::command]
async fn compare_images_dhash(path_a: String, path_b: String) -> Result<SimilarPhotoMatch, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hash_a = compute_image_dhash(Path::new(&path_a))?;
        let hash_b = compute_image_dhash(Path::new(&path_b))?;
        let distance = hamming_distance(hash_a, hash_b);
        let similarity_percentage = ((64.0 - distance as f64) / 64.0) * 100.0;

        Ok(SimilarPhotoMatch {
            path_a,
            path_b,
            hamming_distance: distance,
            similarity_percentage: (similarity_percentage * 10.0).round() / 10.0,
        })
    })
    .await
    .map_err(|e| format!("dHash comparison task error: {}", e))?
}

#[tauri::command]
fn compare_documents_text(text_a: String, text_b: String) -> f64 {
    compute_jaccard_similarity(&text_a, &text_b)
}

#[tauri::command]
async fn read_spreadsheet_preview(
    path: String,
    max_rows: Option<usize>,
) -> Result<SpreadsheetPreview, String> {
    tauri::async_runtime::spawn_blocking(move || {
        spreadsheet::load_spreadsheet_preview(&path, max_rows)
    })
    .await
    .map_err(|e| format!("Spreadsheet preview task error: {}", e))?
}

#[tauri::command]
async fn read_text_preview(path: String, max_lines: Option<usize>) -> Result<TextPreview, String> {
    tauri::async_runtime::spawn_blocking(move || document_preview::load_text_preview(&path, max_lines))
        .await
        .map_err(|e| format!("Text preview task error: {}", e))?
}

#[tauri::command]
async fn read_docx_preview(
    path: String,
    max_paragraphs: Option<usize>,
) -> Result<DocxPreview, String> {
    tauri::async_runtime::spawn_blocking(move || {
        document_preview::load_docx_preview(&path, max_paragraphs)
    })
    .await
    .map_err(|e| format!("Docx preview task error: {}", e))?
}

#[tauri::command]
async fn read_pptx_preview(path: String) -> Result<PptxPreview, String> {
    tauri::async_runtime::spawn_blocking(move || document_preview::load_pptx_preview(&path))
        .await
        .map_err(|e| format!("Pptx preview task error: {}", e))?
}

#[tauri::command]
async fn read_archive_preview(
    path: String,
    max_entries: Option<usize>,
) -> Result<ArchivePreview, String> {
    tauri::async_runtime::spawn_blocking(move || {
        document_preview::load_archive_preview(&path, max_entries)
    })
    .await
    .map_err(|e| format!("Archive preview task error: {}", e))?
}

#[tauri::command]
async fn read_notebook_preview(
    path: String,
    max_cells: Option<usize>,
) -> Result<NotebookPreview, String> {
    tauri::async_runtime::spawn_blocking(move || {
        document_preview::load_notebook_preview(&path, max_cells)
    })
    .await
    .map_err(|e| format!("Notebook preview task error: {}", e))?
}

#[tauri::command]
async fn save_text_file(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        fs::write(&path, content.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))
    })
    .await
    .map_err(|e| format!("Save file task error: {}", e))?
}

/// Decodes file:// URLs, Windows drive prefixes, and full UTF-8 percent-encoded sequences cleanly.
fn clean_path_string(raw: &str) -> String {
    let trimmed = raw.trim_matches(|c| c == '\r' || c == '\n');
    let is_file_url = trimmed.starts_with("file://");
    let stripped = trimmed
        .strip_prefix("file://localhost")
        .or_else(|| trimmed.strip_prefix("file://"))
        .unwrap_or(trimmed);

    let bytes = stripped.as_bytes();
    let mut decoded_bytes = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..=i + 2]) {
                if let Ok(byte_val) = u8::from_str_radix(hex, 16) {
                    decoded_bytes.push(byte_val);
                    i += 3;
                    continue;
                }
            }
        }
        decoded_bytes.push(bytes[i]);
        i += 1;
    }

    let mut out = String::from_utf8_lossy(&decoded_bytes).into_owned();

    // Handle Windows file:///C:/... style paths cleanly across OSes
    let out_bytes = out.as_bytes();
    if is_file_url
        && out_bytes.len() >= 3
        && out_bytes[0] == b'/'
        && out_bytes[1].is_ascii_alphabetic()
        && out_bytes[2] == b':'
    {
        out = out[1..].to_string();
    }

    #[cfg(target_os = "windows")]
    {
        out = out.replace('/', "\\");
        if let Some(s) = out.strip_prefix(r"\\?\") {
            out = s.to_string();
        }
    }

    out
}

#[tauri::command]
fn normalize_dropped_paths(paths: Vec<String>) -> Vec<String> {
    let mut candidates: Vec<(PathBuf, String)> = Vec::new();

    for raw in paths {
        let cleaned = clean_path_string(&raw);
        let path = Path::new(&cleaned);
        let target_dir = if path.is_dir() {
            Some(strip_windows_verbatim(path))
        } else if path.is_file() {
            path.parent().map(strip_windows_verbatim)
        } else {
            None
        };

        if let Some(dir_buf) = target_dir {
            let canon = fs::canonicalize(&dir_buf)
                .map(|c| strip_windows_verbatim(&c))
                .unwrap_or_else(|_| dir_buf.clone());
            candidates.push((canon, dir_buf.to_string_lossy().to_string()));
        }
    }

    // Prefer shallowest paths first, then deduplicate overlapping/nested dropped subfolders
    candidates.sort_by(|a, b| {
        a.0.components()
            .count()
            .cmp(&b.0.components().count())
            .then_with(|| a.0.cmp(&b.0))
    });

    let mut accepted: Vec<(PathBuf, String)> = Vec::new();
    for (canon, display) in candidates {
        let covered_by_parent = accepted.iter().any(|(parent_canon, _)| canon.starts_with(parent_canon));
        if !covered_by_parent {
            accepted.push((canon, display));
        }
    }

    accepted.into_iter().map(|(_, display)| display).collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let scanner_state = Arc::new(ScannerState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(scanner_state)
        .invoke_handler(tauri::generate_handler![
            start_scan,
            cancel_scan,
            trash_files,
            trash_files_verified,
            reveal_file,
            get_image_quality,
            compare_images_dhash,
            compare_documents_text,
            read_spreadsheet_preview,
            read_text_preview,
            read_docx_preview,
            read_pptx_preview,
            read_archive_preview,
            read_notebook_preview,
            save_text_file,
            normalize_dropped_paths
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_path_string() {
        #[cfg(not(target_os = "windows"))]
        {
            assert_eq!(clean_path_string("/path/to/folder"), "/path/to/folder");
            assert_eq!(clean_path_string("file:///path/to/folder"), "/path/to/folder");
            assert_eq!(
                clean_path_string("file://localhost/Users/john/My%20Documents"),
                "/Users/john/My Documents"
            );
            assert_eq!(
                clean_path_string("file:///Users/jos%C3%A9/Caf%C3%A9"),
                "/Users/josé/Café"
            );
            assert_eq!(
                clean_path_string("file:///C:/Users/Alice/Docs"),
                "C:/Users/Alice/Docs"
            );
        }

        #[cfg(target_os = "windows")]
        {
            assert_eq!(clean_path_string(r"C:\path\to\folder"), r"C:\path\to\folder");
            assert_eq!(clean_path_string("file:///C:/path/to/folder"), r"C:\path\to\folder");
            assert_eq!(
                clean_path_string("file:///C:/Users/john/My%20Documents"),
                r"C:\Users\john\My Documents"
            );
            assert_eq!(
                clean_path_string("file:///C:/Users/jos%C3%A9/Caf%C3%A9"),
                r"C:\Users\josé\Café"
            );
            assert_eq!(
                clean_path_string("file:///C:/Users/Alice/Docs"),
                r"C:\Users\Alice\Docs"
            );
        }
    }

    #[test]
    fn test_normalize_dropped_paths() {
        let temp_dir = std::env::temp_dir();
        let sub_dir = temp_dir.join("duplisoft_drag_test_dir");
        let nested_dir = sub_dir.join("inner_child");
        let _ = std::fs::create_dir_all(&nested_dir);
        let test_file = nested_dir.join("sample.txt");
        let _ = std::fs::write(&test_file, b"test");

        let input = vec![
            sub_dir.to_string_lossy().to_string(),
            nested_dir.to_string_lossy().to_string(),
            test_file.to_string_lossy().to_string(),
            format!("file://{}", sub_dir.to_string_lossy()),
        ];
        let normalized = normalize_dropped_paths(input);
        assert_eq!(normalized.len(), 1);
        assert_eq!(normalized[0], sub_dir.to_string_lossy().to_string());

        let _ = std::fs::remove_dir_all(sub_dir);
    }
}
