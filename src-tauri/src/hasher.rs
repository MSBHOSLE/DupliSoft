use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const CHUNK_SIZE: usize = 16 * 1024; // 16 KB prefix and suffix
const BUFFER_SIZE: usize = 64 * 1024; // 64 KB buffer for streaming full hash

/// Computes a fast chunk hash by reading the first 16KB and last 16KB of a file.
/// If the file is smaller than 32KB, it reads the whole file.
pub fn hash_file_chunks(path: &Path, file_size: u64) -> Result<[u8; 32], std::io::Error> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();

    if file_size <= (CHUNK_SIZE * 2) as u64 {
        // File is small enough, read it completely
        let mut buffer = Vec::with_capacity(file_size as usize);
        file.read_to_end(&mut buffer)?;
        hasher.update(&buffer);
    } else {
        // Read prefix (first 16KB)
        let mut prefix_buf = [0u8; CHUNK_SIZE];
        let bytes_read = file.read(&mut prefix_buf)?;
        hasher.update(&prefix_buf[..bytes_read]);

        // Read suffix (last 16KB)
        file.seek(SeekFrom::End(-(CHUNK_SIZE as i64)))?;
        let mut suffix_buf = [0u8; CHUNK_SIZE];
        let bytes_read = file.read(&mut suffix_buf)?;
        hasher.update(&suffix_buf[..bytes_read]);
    }

    Ok(*hasher.finalize().as_bytes())
}

/// Computes the full BLAKE3 cryptographic hash of a file using buffered streaming.
pub fn hash_file_full(path: &Path) -> Result<String, std::io::Error> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0u8; BUFFER_SIZE];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identical_files_produce_identical_hashes() {
        let temp_dir = std::env::temp_dir().join("duplisoft_test_identical");
        let _ = std::fs::create_dir_all(&temp_dir);

        let file_a = temp_dir.join("file_a.bin");
        let file_b = temp_dir.join("file_b.bin");

        let test_data = vec![42u8; 100 * 1024]; // 100 KB
        std::fs::write(&file_a, &test_data).unwrap();
        std::fs::write(&file_b, &test_data).unwrap();

        let chunk_a = hash_file_chunks(&file_a, test_data.len() as u64).unwrap();
        let chunk_b = hash_file_chunks(&file_b, test_data.len() as u64).unwrap();
        assert_eq!(chunk_a, chunk_b);

        let full_a = hash_file_full(&file_a).unwrap();
        let full_b = hash_file_full(&file_b).unwrap();
        assert_eq!(full_a, full_b);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_different_files_same_size_produce_different_hashes() {
        let temp_dir = std::env::temp_dir().join("duplisoft_test_different");
        let _ = std::fs::create_dir_all(&temp_dir);

        let file_a = temp_dir.join("file_a.bin");
        let file_b = temp_dir.join("file_b.bin");

        let data_a = vec![1u8; 100 * 1024];
        let mut data_b = vec![1u8; 100 * 1024];
        data_b[500] = 99; // modify byte in prefix

        std::fs::write(&file_a, &data_a).unwrap();
        std::fs::write(&file_b, &data_b).unwrap();

        let chunk_a = hash_file_chunks(&file_a, data_a.len() as u64).unwrap();
        let chunk_b = hash_file_chunks(&file_b, data_b.len() as u64).unwrap();
        assert_ne!(chunk_a, chunk_b);

        let full_a = hash_file_full(&file_a).unwrap();
        let full_b = hash_file_full(&file_b).unwrap();
        assert_ne!(full_a, full_b);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
