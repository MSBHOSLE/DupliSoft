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
            read_notebook_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

