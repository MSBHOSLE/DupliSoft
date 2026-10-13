use image::imageops::FilterType;
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageQuality {
    pub sharpness_score: f64,
    pub is_blurry: bool,
    pub width: u32,
    pub height: u32,
    pub resolution: String,
    pub quality_rating: u32, // 0 - 100 composite score
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarPhotoMatch {
    pub path_a: String,
    pub path_b: String,
    pub hamming_distance: u32,
    pub similarity_percentage: f64,
}

// =========================================================================
// 1. PERCEPTUAL HASHING (dHash - Difference Hash)
// =========================================================================
// Pure math: Resizes image to 9x8 grayscale, computes relative horizontal
// gradients, and packs the resulting 64 comparisons into a single 64-bit integer.
// Invariant to resolution changes, JPEG compression, and minor color grading.
pub fn compute_image_dhash(path: &Path) -> Result<u64, String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
    
    // Fast downscale to 9 columns x 8 rows in grayscale
    let gray_small = img.resize_exact(9, 8, FilterType::Nearest).to_luma8();
    
    let mut hash: u64 = 0;
    let mut bit_index = 0;

    for y in 0..8 {
        for x in 0..8 {
            let left = gray_small.get_pixel(x, y)[0];
            let right = gray_small.get_pixel(x + 1, y)[0];
            if left > right {
                hash |= 1 << bit_index;
            }
            bit_index += 1;
        }
    }

    Ok(hash)
}

/// Computes the Hamming distance (number of differing bits) between two 64-bit perceptual hashes.
/// Single CPU instruction (`popcnt`). 0 distance = 100% identical visual structure.
pub fn hamming_distance(hash1: u64, hash2: u64) -> u32 {
    (hash1 ^ hash2).count_ones()
}

// =========================================================================
// 2. LAPLACIAN BLUR VARIANCE & IMAGE QUALITY SCORING
// =========================================================================
// Pure math: Convolves image with a 2D discrete Laplacian kernel:
// [ 0,  1,  0 ]
// [ 1, -4,  1 ]
// [ 0,  1,  0 ]
// Calculates edge variance. High variance = crisp, distinct edges.
// Low variance = blurry, motion-blurred, or out-of-focus photo.
pub fn compute_image_quality(path: &Path) -> Result<ImageQuality, String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
    let (width, height) = img.dimensions();

    // Fast 256x256 grayscale sample for microsecond variance computation
    let sample = img.resize(256, 256, FilterType::Nearest).to_luma8();
    let (sw, sh) = sample.dimensions();

    if sw < 3 || sh < 3 {
        return Ok(ImageQuality {
            sharpness_score: 50.0,
            is_blurry: false,
            width,
            height,
            resolution: format!("{}x{}", width, height),
            quality_rating: 50,
        });
    }

    let mut laplacian_values = Vec::with_capacity(((sw - 2) * (sh - 2)) as usize);

    for y in 1..(sh - 1) {
        for x in 1..(sw - 1) {
            let center = sample.get_pixel(x, y)[0] as f64;
            let top = sample.get_pixel(x, y - 1)[0] as f64;
            let bottom = sample.get_pixel(x, y + 1)[0] as f64;
            let left = sample.get_pixel(x - 1, y)[0] as f64;
            let right = sample.get_pixel(x + 1, y)[0] as f64;

            let lap = top + bottom + left + right - (4.0 * center);
            laplacian_values.push(lap);
        }
    }

    let n = laplacian_values.len() as f64;
    let mean = laplacian_values.iter().sum::<f64>() / n;
    let variance = laplacian_values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;

    // Threshold: variance < 80 is blurry, > 250 is very crisp
    let is_blurry = variance < 80.0;
    
    // Normalize sharpness score to 0 - 100 scale
    let normalized_sharpness = (variance / 5.0).min(100.0);

    // Composite quality rating: 60% sharpness + 40% resolution weight
    let total_megapixels = (width as f64 * height as f64) / 1_000_000.0;
    let res_score = (total_megapixels * 5.0).min(100.0);
    let quality_rating = ((normalized_sharpness * 0.6) + (res_score * 0.4)).round() as u32;

    Ok(ImageQuality {
        sharpness_score: (normalized_sharpness * 10.0).round() / 10.0,
        is_blurry,
        width,
        height,
        resolution: format!("{}x{}", width, height),
        quality_rating: quality_rating.min(100),
    })
}

// =========================================================================
// 3. MINHASH & JACCARD N-GRAM SIMILARITY FOR DOCUMENTS
// =========================================================================
// Pure math: Tokenizes plain text into word shingles (3-grams) and computes
// the Jaccard similarity coefficient: |A ∩ B| / |A ∪ B|.
// Runs in microseconds without any machine learning runtime.
pub fn compute_jaccard_similarity(text_a: &str, text_b: &str) -> f64 {
    let shingles_a = create_word_shingles(text_a, 3);
    let shingles_b = create_word_shingles(text_b, 3);

    if shingles_a.is_empty() && shingles_b.is_empty() {
        return 1.0;
    }
    if shingles_a.is_empty() || shingles_b.is_empty() {
        return 0.0;
    }

    let intersection_count = shingles_a.intersection(&shingles_b).count();
    let union_count = shingles_a.union(&shingles_b).count();

    if union_count == 0 {
        return 0.0;
    }

    (intersection_count as f64) / (union_count as f64)
}

fn create_word_shingles(text: &str, n: usize) -> HashSet<String> {
    let words: Vec<&str> = text
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()))
        .filter(|w| !w.is_empty())
        .collect();

    let mut shingles = HashSet::new();
    if words.len() < n {
        if !words.is_empty() {
            shingles.insert(words.join(" ").to_lowercase());
        }
        return shingles;
    }

    for i in 0..=(words.len() - n) {
        let shingle = words[i..i + n].join(" ").to_lowercase();
        shingles.insert(shingle);
    }

    shingles
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jaccard_identical_text() {
        let text1 = "This is a contract between Party A and Party B for software development.";
        let text2 = "This is a contract between Party A and Party B for software development.";
        let sim = compute_jaccard_similarity(text1, text2);
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_jaccard_near_identical_text() {
        let text1 = "This is a contract between Party A and Party B signed on October 10 2026.";
        let text2 = "This is a contract between Party A and Party B signed on October 13 2026.";
        let sim = compute_jaccard_similarity(text1, text2);
        assert!(sim > 0.65);
    }
}
