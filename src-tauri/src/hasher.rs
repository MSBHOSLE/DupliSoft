use std::fs::File;
use std::io::{ErrorKind, Read, Seek, SeekFrom};
use std::path::Path;

pub const CHUNK_SIZE: usize = 16 * 1024; // 16 KB prefix and suffix
const BUFFER_SIZE: usize = 64 * 1024; // 64 KB buffer for streaming full hash & byte compare

/// Reads into `buf` until either the buffer is completely filled or EOF is reached.
/// Safely retries on `ErrorKind::Interrupted` and handles partial reads on SMB/NAS/FUSE mounts.
fn read_exact_or_eof(file: &mut File, buf: &mut [u8]) -> Result<usize, std::io::Error> {
    let mut total_read = 0;
    while total_read < buf.len() {
        match file.read(&mut buf[total_read..]) {
            Ok(0) => break,
            Ok(n) => total_read += n,
            Err(e) if e.kind() == ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        }
    }
    Ok(total_read)
}

/// Computes a fast chunk hash by reading the first 16KB and last 16KB of a file.
/// If the file is `<= 32KB`, hashes the complete file in one pass.
pub fn hash_file_chunks(path: &Path, file_size: u64) -> Result<[u8; 32], std::io::Error> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();

    if file_size <= (CHUNK_SIZE * 2) as u64 {
        let mut buffer = Vec::with_capacity(file_size as usize);
        file.read_to_end(&mut buffer)?;
        hasher.update(&buffer);
    } else {
        // Read prefix (exact first 16KB)
        let mut prefix_buf = [0u8; CHUNK_SIZE];
        let prefix_read = read_exact_or_eof(&mut file, &mut prefix_buf)?;
        hasher.update(&prefix_buf[..prefix_read]);

        // Read suffix (exact last 16KB)
        file.seek(SeekFrom::End(-(CHUNK_SIZE as i64)))?;
        let mut suffix_buf = [0u8; CHUNK_SIZE];
        let suffix_read = read_exact_or_eof(&mut file, &mut suffix_buf)?;
        hasher.update(&suffix_buf[..suffix_read]);
    }

    Ok(*hasher.finalize().as_bytes())
}

/// Computes the full BLAKE3 cryptographic hash of a file using buffered streaming.
pub fn hash_file_full(path: &Path) -> Result<String, std::io::Error> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0u8; BUFFER_SIZE];

    loop {
        match file.read(&mut buffer) {
            Ok(0) => break,
            Ok(bytes_read) => {
                hasher.update(&buffer[..bytes_read]);
            }
            Err(e) if e.kind() == ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        }
    }

    Ok(hasher.finalize().to_hex().to_string())
}

/// Performs a strict 100% byte-for-byte streaming comparison between two files.
/// Zero risk of cryptographic collision or transient read mismatch.
pub fn verify_files_byte_identical(path_a: &Path, path_b: &Path) -> Result<bool, std::io::Error> {
    let mut file_a = File::open(path_a)?;
    let mut file_b = File::open(path_b)?;

    if file_a.metadata()?.len() != file_b.metadata()?.len() {
        return Ok(false);
    }

    let mut buf_a = [0u8; BUFFER_SIZE];
    let mut buf_b = [0u8; BUFFER_SIZE];

    loop {
        let read_a = read_exact_or_eof(&mut file_a, &mut buf_a)?;
        let read_b = read_exact_or_eof(&mut file_b, &mut buf_b)?;

        if read_a != read_b || buf_a[..read_a] != buf_b[..read_b] {
            return Ok(false);
        }
        if read_a == 0 {
            return Ok(true);
        }
    }
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
        assert!(verify_files_byte_identical(&file_a, &file_b).unwrap());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_different_files_same_size_produce_different_hashes() {
        let temp_dir = std::env::temp_dir().join("duplisoft_test_different");
        let _ = std::fs::create_dir_all(&temp_dir);

        let file_a = temp_dir.join("file_a.bin");
        let file_b = temp_dir.join("file_b.bin");
        let file_c = temp_dir.join("file_c.bin");

        let data_a = vec![1u8; 100 * 1024];
        let mut data_b = vec![1u8; 100 * 1024];
        data_b[500] = 99; // modify byte in prefix
        let mut data_c = vec![1u8; 100 * 1024];
        data_c[50 * 1024] = 88; // modify byte in middle (outside prefix/suffix)

        std::fs::write(&file_a, &data_a).unwrap();
        std::fs::write(&file_b, &data_b).unwrap();
        std::fs::write(&file_c, &data_c).unwrap();

        let chunk_a = hash_file_chunks(&file_a, data_a.len() as u64).unwrap();
        let chunk_b = hash_file_chunks(&file_b, data_b.len() as u64).unwrap();
        assert_ne!(chunk_a, chunk_b);

        let full_a = hash_file_full(&file_a).unwrap();
        let full_c = hash_file_full(&file_c).unwrap();
        assert_ne!(full_a, full_c);
        assert!(!verify_files_byte_identical(&file_a, &file_c).unwrap());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
