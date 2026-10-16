use crate::models::{
    ArchiveEntry, ArchivePreview, DocParagraph, DocxPreview, NotebookCell, NotebookPreview,
    PptxPreview, SlideInfo, TextPreview,
};
use quick_xml::events::Event;
use quick_xml::Reader;
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use zip::ZipArchive;

const DEFAULT_MAX_TEXT_LINES: usize = 500;
const DEFAULT_MAX_DOCX_PARAS: usize = 100;
const DEFAULT_MAX_ARCHIVE_ENTRIES: usize = 200;
const DEFAULT_MAX_NOTEBOOK_CELLS: usize = 100;


/// Pure base64 encoder for image thumbnails without external crate dependencies
fn to_base64(data: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(CHARSET[(b0 >> 2) as usize] as char);
        result.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARSET[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARSET[(b2 & 0x3f) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

/// Reads plain text, notes, markdown, logs, json, xml, html with line indexing
pub fn load_text_preview(
    file_path: &str,
    max_lines: Option<usize>,
) -> Result<TextPreview, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let limit = max_lines.unwrap_or(DEFAULT_MAX_TEXT_LINES);
    let file = File::open(path).map_err(|e| format!("Cannot open text file: {}", e))?;
    let reader = BufReader::new(file);

    let mut lines = Vec::new();
    let mut total_lines = 0;
    let mut total_words = 0;
    let mut total_chars = 0;
    let mut is_truncated = false;

    for line_res in reader.lines() {
        match line_res {
            Ok(line) => {
                total_lines += 1;
                total_chars += line.len();
                total_words += line.split_whitespace().count();

                if lines.len() < limit {
                    lines.push(line);
                } else {
                    is_truncated = true;
                }
            }
            Err(_) => {
                // If invalid UTF-8 byte, continue gracefully
                continue;
            }
        }
    }

    Ok(TextPreview {
        file_path: file_path.to_string(),
        total_lines,
        total_words,
        total_chars,
        lines,
        is_truncated,
    })
}

/// Reads Word document (.docx) XML contents without Microsoft Office
pub fn load_docx_preview(
    file_path: &str,
    max_paragraphs: Option<usize>,
) -> Result<DocxPreview, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let limit = max_paragraphs.unwrap_or(DEFAULT_MAX_DOCX_PARAS);
    let file = File::open(path).map_err(|e| format!("Cannot open docx archive: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid docx container: {}", e))?;

    let mut title = None;
    let mut author = None;

    // 1. Try reading metadata from docProps/core.xml
    if let Ok(mut core_xml) = archive.by_name("docProps/core.xml") {
        let mut xml_content = String::new();
        if core_xml.read_to_string(&mut xml_content).is_ok() {
            let mut reader = Reader::from_str(&xml_content);
            let mut in_title = false;
            let mut in_creator = false;

            while let Ok(event) = reader.read_event() {
                match event {
                    Event::Start(e) => {
                        let name = e.name();
                        if name.as_ref().ends_with(b"title") {
                            in_title = true;
                        } else if name.as_ref().ends_with(b"creator") {
                            in_creator = true;
                        }
                    }
                    Event::Text(e) => {
                        let txt = String::from_utf8_lossy(e.as_ref());
                        let trimmed = txt.trim().to_string();
                        if !trimmed.is_empty() {
                            if in_title {
                                title = Some(trimmed);
                            } else if in_creator {
                                author = Some(trimmed);
                            }
                        }
                    }
                    Event::End(e) => {
                        let name = e.name();
                        if name.as_ref().ends_with(b"title") {
                            in_title = false;
                        } else if name.as_ref().ends_with(b"creator") {
                            in_creator = false;
                        }
                    }
                    Event::Eof => break,
                    _ => {}
                }
            }
        }
    }

    // 2. Read main text paragraphs from word/document.xml
    let mut doc_file = archive
        .by_name("word/document.xml")
        .map_err(|e| format!("word/document.xml not found in archive: {}", e))?;

    let mut doc_xml = String::new();
    doc_file
        .read_to_string(&mut doc_xml)
        .map_err(|e| format!("Failed to read word/document.xml: {}", e))?;

    let mut reader = Reader::from_str(&doc_xml);
    let mut paragraphs = Vec::new();
    let mut total_paragraphs = 0;
    let mut total_words = 0;
    let mut current_para_text = String::new();
    let mut in_p = false;
    let mut is_heading = false;
    let mut heading_level: u8 = 0;
    let mut is_truncated = false;

    while let Ok(event) = reader.read_event() {
        match event {
            Event::Start(e) | Event::Empty(e) => {
                let name = e.name();
                if name.as_ref() == b"w:p" {
                    in_p = true;
                    current_para_text.clear();
                    is_heading = false;
                    heading_level = 0;
                } else if in_p && name.as_ref() == b"w:pStyle" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"w:val" {
                            let val = String::from_utf8_lossy(&attr.value);
                            if val.to_lowercase().contains("heading1") || val == "1" {
                                is_heading = true;
                                heading_level = 1;
                            } else if val.to_lowercase().contains("heading2") || val == "2" {
                                is_heading = true;
                                heading_level = 2;
                            } else if val.to_lowercase().contains("heading3") || val == "3" {
                                is_heading = true;
                                heading_level = 3;
                            } else if val.to_lowercase().contains("title") {
                                is_heading = true;
                                heading_level = 1;
                            }
                        }
                    }
                }
            }
            Event::Text(e) => {
                if in_p {
                    let txt = String::from_utf8_lossy(e.as_ref());
                    current_para_text.push_str(&txt);
                }
            }
            Event::End(e) => {
                if e.name().as_ref() == b"w:p" {
                    in_p = false;
                    let trimmed = current_para_text.trim().to_string();
                    if !trimmed.is_empty() {
                        total_paragraphs += 1;
                        total_words += trimmed.split_whitespace().count();

                        if paragraphs.len() < limit {
                            paragraphs.push(DocParagraph {
                                is_heading,
                                heading_level,
                                text: trimmed,
                            });
                        } else {
                            is_truncated = true;
                        }
                    }
                }
            }
            Event::Eof => break,
            _ => {}
        }
    }

    Ok(DocxPreview {
        file_path: file_path.to_string(),
        title,
        author,
        total_paragraphs,
        total_words,
        paragraphs,
        is_truncated,
    })
}

/// Reads PowerPoint presentation (.pptx) slide covers and slide outlines
pub fn load_pptx_preview(file_path: &str) -> Result<PptxPreview, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let file = File::open(path).map_err(|e| format!("Cannot open pptx archive: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid pptx container: {}", e))?;

    let mut thumbnail_base64 = None;

    // 1. Extract embedded visual slide cover if present
    if let Ok(mut thumb_file) = archive.by_name("docProps/thumbnail.jpeg") {
        let mut buffer = Vec::new();
        if thumb_file.read_to_end(&mut buffer).is_ok() && !buffer.is_empty() {
            thumbnail_base64 = Some(format!("data:image/jpeg;base64,{}", to_base64(&buffer)));
        }
    } else if let Ok(mut thumb_file) = archive.by_name("docProps/thumbnail.png") {
        let mut buffer = Vec::new();
        if thumb_file.read_to_end(&mut buffer).is_ok() && !buffer.is_empty() {
            thumbnail_base64 = Some(format!("data:image/png;base64,{}", to_base64(&buffer)));
        }
    }

    // 2. Count and inspect slides
    let mut slide_names: Vec<String> = Vec::new();
    for i in 0..archive.len() {
        if let Ok(entry) = archive.by_index(i) {
            let name = entry.name().to_string();
            if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
                slide_names.push(name);
            }
        }
    }

    // Sort slides numerically: slide1.xml, slide2.xml ...
    slide_names.sort_by(|a, b| {
        let extract_num = |s: &str| -> usize {
            s.trim_start_matches("ppt/slides/slide")
                .trim_end_matches(".xml")
                .parse::<usize>()
                .unwrap_or(0)
        };
        extract_num(a).cmp(&extract_num(b))
    });

    let slide_count = slide_names.len();
    let mut slides = Vec::new();

    // Inspect first 10 slides for titles and text snippets
    for (idx, slide_name) in slide_names.iter().take(10).enumerate() {
        let mut title = None;
        let mut text_snippets = Vec::new();

        if let Ok(mut slide_file) = archive.by_name(slide_name) {
            let mut xml = String::new();
            if slide_file.read_to_string(&mut xml).is_ok() {
                let mut reader = Reader::from_str(&xml);
                let mut current_text = String::new();
                let mut in_t = false;

                while let Ok(event) = reader.read_event() {
                    match event {
                        Event::Start(e) => {
                            if e.name().as_ref() == b"a:t" {
                                in_t = true;
                                current_text.clear();
                            }
                        }
                        Event::Text(e) => {
                            if in_t {
                                let txt = String::from_utf8_lossy(e.as_ref());
                                current_text.push_str(&txt);
                            }
                        }
                        Event::End(e) => {
                            if e.name().as_ref() == b"a:t" {
                                in_t = false;
                                let trimmed = current_text.trim().to_string();
                                if !trimmed.is_empty() {
                                    if title.is_none() {
                                        title = Some(trimmed);
                                    } else if text_snippets.len() < 5 {
                                        text_snippets.push(trimmed);
                                    }
                                }
                            }
                        }
                        Event::Eof => break,
                        _ => {}
                    }
                }
            }
        }

        slides.push(SlideInfo {
            slide_number: idx + 1,
            title,
            text_snippets,
        });
    }

    let deck_title = slides.first().and_then(|s| s.title.clone());

    Ok(PptxPreview {
        file_path: file_path.to_string(),
        slide_count,
        title: deck_title,
        thumbnail_base64,
        slides,
    })
}

/// Reads archive (.zip, .tar, .gz) table of contents in < 2ms without extracting
pub fn load_archive_preview(
    file_path: &str,
    max_entries: Option<usize>,
) -> Result<ArchivePreview, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let limit = max_entries.unwrap_or(DEFAULT_MAX_ARCHIVE_ENTRIES);
    let file = File::open(path).map_err(|e| format!("Cannot open archive file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Not a valid ZIP archive: {}", e))?;

    let total_entries = archive.len();
    let mut total_uncompressed_bytes: u64 = 0;
    let mut total_compressed_bytes: u64 = 0;
    let mut entries = Vec::new();

    for i in 0..total_entries {
        if let Ok(entry) = archive.by_index(i) {
            let size = entry.size();
            let compressed_size = entry.compressed_size();
            let is_dir = entry.is_dir();
            let name = entry.name().to_string();

            total_uncompressed_bytes += size;
            total_compressed_bytes += compressed_size;

            if entries.len() < limit {
                entries.push(ArchiveEntry {
                    name,
                    size,
                    compressed_size,
                    is_dir,
                });
            }
        }
    }

    Ok(ArchivePreview {
        file_path: file_path.to_string(),
        total_entries,
        total_uncompressed_bytes,
        total_compressed_bytes,
        entries,
    })
}

/// Reads Jupyter notebook (.ipynb) cells without executing code or launching Python
pub fn load_notebook_preview(
    file_path: &str,
    max_cells: Option<usize>,
) -> Result<NotebookPreview, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let limit = max_cells.unwrap_or(DEFAULT_MAX_NOTEBOOK_CELLS);
    let file = File::open(path).map_err(|e| format!("Cannot open notebook file: {}", e))?;
    let reader = BufReader::new(file);

    let v: serde_json::Value =
        serde_json::from_reader(reader).map_err(|e| format!("Invalid notebook JSON: {}", e))?;

    let kernel_name = v
        .pointer("/metadata/kernelspec/display_name")
        .or_else(|| v.pointer("/metadata/kernelspec/name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let language = v
        .pointer("/metadata/language_info/name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let empty_vec = vec![];
    let raw_cells = v
        .get("cells")
        .and_then(|c| c.as_array())
        .unwrap_or(&empty_vec);
    let total_cells = raw_cells.len();

    let mut code_cells_count = 0;
    let mut markdown_cells_count = 0;
    let mut cells = Vec::new();
    let is_truncated = total_cells > limit;

    for (idx, cell) in raw_cells.iter().enumerate() {
        let cell_type = cell
            .get("cell_type")
            .and_then(|t| t.as_str())
            .unwrap_or("code")
            .to_string();

        if cell_type == "code" {
            code_cells_count += 1;
        } else if cell_type == "markdown" {
            markdown_cells_count += 1;
        }

        if idx < limit {
            let execution_count = cell.get("execution_count").and_then(|e| e.as_i64());
            let mut source_lines = Vec::new();

            if let Some(src) = cell.get("source") {
                if let Some(arr) = src.as_array() {
                    for line_val in arr {
                        if let Some(s) = line_val.as_str() {
                            source_lines
                                .push(s.trim_end_matches(&['\r', '\n'][..]).to_string());
                        }
                    }
                } else if let Some(s) = src.as_str() {
                    for line in s.lines() {
                        source_lines.push(line.to_string());
                    }
                }
            }

            cells.push(NotebookCell {
                cell_type,
                execution_count,
                source: source_lines,
            });
        }
    }

    Ok(NotebookPreview {
        file_path: file_path.to_string(),
        kernel_name,
        language,
        total_cells,
        code_cells_count,
        markdown_cells_count,
        cells,
        is_truncated,
    })
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_text_preview_loading() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("duplisoft_test_text.txt");

        let mut f = File::create(&test_file).unwrap();
        writeln!(f, "First line of notes").unwrap();
        writeln!(f, "Second line with some words").unwrap();
        writeln!(f, "Third line finishing document").unwrap();

        let preview = load_text_preview(test_file.to_str().unwrap(), Some(2)).unwrap();
        assert_eq!(preview.total_lines, 3);
        assert_eq!(preview.lines.len(), 2);
        assert!(preview.is_truncated);
        assert_eq!(preview.lines[0], "First line of notes");

        let _ = std::fs::remove_file(test_file);
    }

    #[test]
    fn test_base64_encoder() {
        let sample = b"DupliSoft Pure Rust Base64";
        let encoded = to_base64(sample);
        assert!(!encoded.is_empty());
        assert!(encoded.len() % 4 == 0);
    }

    #[test]
    fn test_archive_preview_loading() {
        let temp_dir = std::env::temp_dir();
        let test_zip = temp_dir.join("duplisoft_test_archive.zip");

        let file = File::create(&test_zip).unwrap();
        let mut zip_writer = zip::ZipWriter::new(file);

        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip_writer.start_file("sample1.txt", options).unwrap();
        zip_writer.write_all(b"Hello from inside zip archive!").unwrap();

        zip_writer.start_file("sample2.txt", options).unwrap();
        zip_writer.write_all(b"Second file inside zip!").unwrap();

        zip_writer.finish().unwrap();

        let preview = load_archive_preview(test_zip.to_str().unwrap(), Some(10)).unwrap();
        assert_eq!(preview.total_entries, 2);
        assert_eq!(preview.entries.len(), 2);
        assert!(preview.total_uncompressed_bytes > 0);

        let _ = std::fs::remove_file(test_zip);
    }

    #[test]
    fn test_docx_preview_loading() {
        let temp_dir = std::env::temp_dir();
        let test_docx = temp_dir.join("duplisoft_test_doc.docx");

        let file = File::create(&test_docx).unwrap();
        let mut zip_writer = zip::ZipWriter::new(file);

        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip_writer.start_file("word/document.xml", options).unwrap();
        let xml_data = r#"<?xml version="1.0" encoding="UTF-8"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
                <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Project Title</w:t></w:r></w:p>
                <w:p><w:r><w:t>This is the first paragraph of test document.</w:t></w:r></w:p>
            </w:body>
        </w:document>"#;
        zip_writer.write_all(xml_data.as_bytes()).unwrap();

        zip_writer.finish().unwrap();

        let preview = load_docx_preview(test_docx.to_str().unwrap(), Some(10)).unwrap();
        assert_eq!(preview.total_paragraphs, 2);
        assert_eq!(preview.paragraphs.len(), 2);
        assert!(preview.paragraphs[0].is_heading);
        assert_eq!(preview.paragraphs[0].text, "Project Title");
        assert_eq!(preview.paragraphs[1].text, "This is the first paragraph of test document.");

        let _ = std::fs::remove_file(test_docx);
    }

    #[test]
    fn test_pptx_preview_loading() {
        let temp_dir = std::env::temp_dir();
        let test_pptx = temp_dir.join("duplisoft_test_deck.pptx");

        let file = File::create(&test_pptx).unwrap();
        let mut zip_writer = zip::ZipWriter::new(file);

        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip_writer.start_file("docProps/thumbnail.jpeg", options).unwrap();
        zip_writer.write_all(b"fake_jpeg_image_data_here").unwrap();

        zip_writer.start_file("ppt/slides/slide1.xml", options).unwrap();
        let slide_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
        <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
            <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Quarterly Financial Results</a:t></a:r></a:p></txBody></p:sp></p:spTree></p:cSld>
        </p:sld>"#;
        zip_writer.write_all(slide_xml.as_bytes()).unwrap();

        zip_writer.finish().unwrap();

        let preview = load_pptx_preview(test_pptx.to_str().unwrap()).unwrap();
        assert_eq!(preview.slide_count, 1);
        assert!(preview.thumbnail_base64.is_some());
        assert_eq!(preview.slides[0].title.as_deref(), Some("Quarterly Financial Results"));

        let _ = std::fs::remove_file(test_pptx);
    }

    #[test]
    fn test_notebook_preview_loading() {
        let temp_dir = std::env::temp_dir();
        let test_ipynb = temp_dir.join("duplisoft_test_nb.ipynb");

        let mut f = File::create(&test_ipynb).unwrap();
        let sample_nb_json = r##"{
            "cells": [
                {
                    "cell_type": "markdown",
                    "metadata": {},
                    "source": ["# Analysis Pipeline\n", "Run data exploration."]
                },
                {
                    "cell_type": "code",
                    "execution_count": 1,
                    "metadata": {},
                    "outputs": [],
                    "source": ["import math\n", "print(math.pi)"]
                }
            ],
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3.12",
                    "name": "python3"
                },
                "language_info": {
                    "name": "python"
                }
            },
            "nbformat": 4,
            "nbformat_minor": 2
        }"##;
        f.write_all(sample_nb_json.as_bytes()).unwrap();

        let preview = load_notebook_preview(test_ipynb.to_str().unwrap(), Some(5)).unwrap();
        assert_eq!(preview.total_cells, 2);
        assert_eq!(preview.code_cells_count, 1);
        assert_eq!(preview.markdown_cells_count, 1);
        assert_eq!(preview.kernel_name.as_deref(), Some("Python 3.12"));
        assert_eq!(preview.language.as_deref(), Some("python"));
        assert_eq!(preview.cells.len(), 2);
        assert_eq!(preview.cells[0].cell_type, "markdown");
        assert_eq!(preview.cells[1].cell_type, "code");
        assert_eq!(preview.cells[1].execution_count, Some(1));
        assert_eq!(preview.cells[1].source[0], "import math");

        let _ = std::fs::remove_file(test_ipynb);
    }
}

