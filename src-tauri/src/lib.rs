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
    SpreadsheetPreview, TextPreview, TrashResult,
};
use scanner::{run_scan, ScannerState};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
async fn start_scan(
    app: AppHandle,
    state: State<'_, Arc<ScannerState>>,
    options: ScanOptions,
) -> Result<ScanResult, String> {
    let is_running = state.is_running.clone();
    // Run CPU-heavy scan in a separate thread so Tauri async loop stays responsive
    tauri::async_runtime::spawn_blocking(move || run_scan(app, options, is_running))
        .await
        .map_err(|e| format!("Task execution error: {}", e))?
}

#[tauri::command]
fn cancel_scan(state: State<'_, Arc<ScannerState>>) {
    state.cancel();
}

#[tauri::command]
fn trash_files(paths: Vec<String>) -> TrashResult {
    trash::delete_to_trash(paths)
}

#[tauri::command]
fn reveal_file(path: String) -> Result<(), String> {
    trash::show_in_file_manager(&path)
}

#[tauri::command]
fn get_image_quality(path: String) -> Result<ImageQuality, String> {
    compute_image_quality(Path::new(&path))
}

#[tauri::command]
fn compare_images_dhash(path_a: String, path_b: String) -> Result<SimilarPhotoMatch, String> {
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
}

#[tauri::command]
fn compare_documents_text(text_a: String, text_b: String) -> f64 {
    compute_jaccard_similarity(&text_a, &text_b)
}

#[tauri::command]
fn read_spreadsheet_preview(
    path: String,
    max_rows: Option<usize>,
) -> Result<SpreadsheetPreview, String> {
    spreadsheet::load_spreadsheet_preview(&path, max_rows)
}

#[tauri::command]
fn read_text_preview(path: String, max_lines: Option<usize>) -> Result<TextPreview, String> {
    document_preview::load_text_preview(&path, max_lines)
}

#[tauri::command]
fn read_docx_preview(
    path: String,
    max_paragraphs: Option<usize>,
) -> Result<DocxPreview, String> {
    document_preview::load_docx_preview(&path, max_paragraphs)
}

#[tauri::command]
fn read_pptx_preview(path: String) -> Result<PptxPreview, String> {
    document_preview::load_pptx_preview(&path)
}

#[tauri::command]
fn read_archive_preview(
    path: String,
    max_entries: Option<usize>,
) -> Result<ArchivePreview, String> {
    document_preview::load_archive_preview(&path, max_entries)
}

#[tauri::command]
fn read_notebook_preview(
    path: String,
    max_cells: Option<usize>,
) -> Result<NotebookPreview, String> {
    document_preview::load_notebook_preview(&path, max_cells)
}

fn clean_path_string(raw: &str) -> String {
    let stripped = raw.strip_prefix("file://").unwrap_or(raw);
    let mut result = String::with_capacity(stripped.len());
    let bytes = stripped.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte_val) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..=i + 2]).unwrap_or(""),
                16,
            ) {
                result.push(byte_val as char);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i] as char);
        i += 1;
    }
    result
}

#[tauri::command]
fn normalize_dropped_paths(paths: Vec<String>) -> Vec<String> {
    let mut resolved = Vec::new();
    for raw in paths {
        let cleaned = clean_path_string(&raw);
        let path = Path::new(&cleaned);
        if path.is_dir() {
            resolved.push(cleaned);
        } else if path.is_file() {
            if let Some(parent) = path.parent() {
                resolved.push(parent.to_string_lossy().to_string());
            }
        }
    }
    resolved.sort();
    resolved.dedup();
    resolved
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
        assert_eq!(clean_path_string("/path/to/folder"), "/path/to/folder");
        assert_eq!(clean_path_string("file:///path/to/folder"), "/path/to/folder");
        assert_eq!(
            clean_path_string("file:///Users/john/My%20Documents"),
            "/Users/john/My Documents"
        );
    }

    #[test]
    fn test_normalize_dropped_paths() {
        let temp_dir = std::env::temp_dir();
        let sub_dir = temp_dir.join("duplisoft_drag_test_dir");
        let _ = std::fs::create_dir_all(&sub_dir);
        let test_file = sub_dir.join("sample.txt");
        let _ = std::fs::write(&test_file, b"test");

        let input = vec![
            sub_dir.to_string_lossy().to_string(),
            test_file.to_string_lossy().to_string(),
            format!("file://{}", sub_dir.to_string_lossy()),
        ];
        let normalized = normalize_dropped_paths(input);
        assert_eq!(normalized.len(), 1);
        assert_eq!(normalized[0], sub_dir.to_string_lossy().to_string());

        let _ = std::fs::remove_file(test_file);
        let _ = std::fs::remove_dir(sub_dir);
    }
}


