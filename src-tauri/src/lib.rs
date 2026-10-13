pub mod algorithms;
pub mod hasher;
pub mod models;
pub mod scanner;
pub mod trash;

use algorithms::{
    compute_image_dhash, compute_image_quality, compute_jaccard_similarity, hamming_distance,
    ImageQuality, SimilarPhotoMatch,
};
use models::{ScanOptions, ScanResult, TrashResult};
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
            compare_documents_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
