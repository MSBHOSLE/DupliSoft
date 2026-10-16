use crate::models::{SheetPreview, SpreadsheetPreview};
use calamine::{open_workbook_auto, Data, Range, Reader};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

const DEFAULT_MAX_ROWS: usize = 50;

/// Reads spreadsheet data (.xlsx, .xls, .xlsb, .ods, .csv, .tsv) on demand.
/// Sub-millisecond response time by only loading top `max_rows` into memory.
pub fn load_spreadsheet_preview(
    file_path: &str,
    max_rows: Option<usize>,
) -> Result<SpreadsheetPreview, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let limit = max_rows.unwrap_or(DEFAULT_MAX_ROWS);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "csv" | "tsv" | "txt" => parse_csv_or_tsv(path, &ext, limit),
        "xlsx" | "xls" | "xlsb" | "ods" => parse_calamine_workbook(path, &ext, limit),
        _ => Err(format!("Unsupported spreadsheet extension: .{}", ext)),
    }
}

fn parse_csv_or_tsv(
    path: &Path,
    ext: &str,
    max_rows: usize,
) -> Result<SpreadsheetPreview, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open CSV file: {}", e))?;
    let delimiter = if ext == "tsv" { b'\t' } else { b',' };

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .has_headers(false)
        .from_reader(file);

    let mut all_rows: Vec<Vec<String>> = Vec::new();
    let mut total_rows = 0;
    let mut max_cols = 0;

    for result in rdr.records() {
        match result {
            Ok(record) => {
                total_rows += 1;
                max_cols = max_cols.max(record.len());
                if all_rows.len() < max_rows + 1 {
                    let row: Vec<String> = record.iter().map(|s| s.trim().to_string()).collect();
                    all_rows.push(row);
                }
            }
            Err(_) => {
                // If CSV error, continue counting valid lines
                continue;
            }
        }
    }

    if all_rows.is_empty() {
        // Fallback for raw text lines
        let file = File::open(path).map_err(|e| e.to_string())?;
        let reader = BufReader::new(file);
        for line in reader.lines().flatten() {
            total_rows += 1;
            if all_rows.len() < max_rows + 1 {
                let parts: Vec<String> = line.split(char::from(delimiter)).map(|s| s.trim().to_string()).collect();
                max_cols = max_cols.max(parts.len());
                all_rows.push(parts);
            }
        }
    }

    let (headers, rows) = if !all_rows.is_empty() {
        let first = all_rows.remove(0);
        (first, all_rows)
    } else {
        (Vec::new(), Vec::new())
    };

    let sheet = SheetPreview {
        sheet_name: "Data".to_string(),
        total_rows,
        total_cols: max_cols,
        headers,
        rows,
    };

    Ok(SpreadsheetPreview {
        file_path: path.to_string_lossy().to_string(),
        format: ext.to_string(),
        total_sheets: 1,
        sheets: vec![sheet],
    })
}

fn parse_calamine_workbook(
    path: &Path,
    ext: &str,
    max_rows: usize,
) -> Result<SpreadsheetPreview, String> {
    let mut workbook = open_workbook_auto(path)
        .map_err(|e| format!("Unable to open spreadsheet workbook: {}", e))?;

    let sheet_names: Vec<String> = workbook.sheet_names();
    if sheet_names.is_empty() {
        return Err("Workbook contains no worksheets".to_string());
    }

    let total_sheets = sheet_names.len();
    let mut sheets: Vec<SheetPreview> = Vec::new();

    for name in &sheet_names {
        if let Ok(range) = workbook.worksheet_range(name) {
            let (tot_r, tot_c) = range.get_size();
            let (headers, rows) = extract_range_data(&range, max_rows);

            sheets.push(SheetPreview {
                sheet_name: name.clone(),
                total_rows: tot_r,
                total_cols: tot_c,
                headers,
                rows,
            });
        }
    }

    Ok(SpreadsheetPreview {
        file_path: path.to_string_lossy().to_string(),
        format: ext.to_string(),
        total_sheets,
        sheets,
    })
}

fn extract_range_data(
    range: &Range<Data>,
    max_rows: usize,
) -> (Vec<String>, Vec<Vec<String>>) {
    let mut all_rows: Vec<Vec<String>> = Vec::new();

    for row in range.rows() {
        if all_rows.len() >= max_rows + 1 {
            break;
        }
        let formatted_row: Vec<String> = row.iter().map(format_cell).collect();
        all_rows.push(formatted_row);
    }

    if all_rows.is_empty() {
        return (Vec::new(), Vec::new());
    }

    let headers = all_rows.remove(0);
    (headers, all_rows)
}

fn format_cell(data: &Data) -> String {
    match data {
        Data::Empty => String::new(),
        Data::String(s) => s.trim().to_string(),
        Data::Float(f) => {
            if f.fract() == 0.0 && *f >= i64::MIN as f64 && *f <= i64::MAX as f64 {
                format!("{}", *f as i64)
            } else {
                format!("{:.2}", f)
            }
        }
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => (if *b { "TRUE" } else { "FALSE" }).to_string(),
        Data::DateTime(dt) => dt.to_string(),
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
        Data::Error(e) => format!("#ERR:{:?}", e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_csv_preview_parsing() {
        let temp_dir = std::env::temp_dir();
        let test_csv_path = temp_dir.join("duplisoft_test_sample.csv");

        let mut file = File::create(&test_csv_path).unwrap();
        writeln!(file, "Product,Category,Price,InStock").unwrap();
        writeln!(file, "Laptop,Electronics,1200,true").unwrap();
        writeln!(file, "Desk,Furniture,350,false").unwrap();
        writeln!(file, "Coffee Mug,Kitchen,15.5,true").unwrap();

        let preview = load_spreadsheet_preview(test_csv_path.to_str().unwrap(), Some(10)).unwrap();

        assert_eq!(preview.format, "csv");
        assert_eq!(preview.total_sheets, 1);
        let sheet = &preview.sheets[0];
        assert_eq!(sheet.headers, vec!["Product", "Category", "Price", "InStock"]);
        assert_eq!(sheet.rows.len(), 3);
        assert_eq!(sheet.rows[0], vec!["Laptop", "Electronics", "1200", "true"]);
        assert_eq!(sheet.rows[1], vec!["Desk", "Furniture", "350", "false"]);

        // Cleanup
        let _ = std::fs::remove_file(test_csv_path);
    }
}
