use std::io::{Cursor, Read};
use zip::ZipArchive;

#[derive(Debug)]
pub struct ParsedDocument {
    pub text: String,
    pub pages: usize,
    pub file_type: String,
}

/// Parse a PDF file and extract text
pub fn parse_pdf(data: &[u8]) -> Result<ParsedDocument, String> {
    match pdf_extract::extract_text_from_mem(data) {
        Ok(text) => {
            let cleaned = clean_text(&text);
            let pages = count_pages(&cleaned);
            Ok(ParsedDocument {
                text: cleaned,
                pages,
                file_type: "pdf".to_string(),
            })
        }
        Err(e) => Err(format!("Failed to parse PDF: {}", e)),
    }
}

/// Parse a DOCX file and extract text
pub fn parse_docx(data: &[u8]) -> Result<ParsedDocument, String> {
    let cursor = Cursor::new(data);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to open DOCX as ZIP: {}", e))?;

    let mut text_content = String::new();

    // DOCX stores content in word/document.xml
    if let Ok(mut file) = archive.by_name("word/document.xml") {
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read document.xml: {}", e))?;

        // Extract text from <w:t> tags
        text_content = extract_text_from_xml(&xml_content, "w:t");
    }

    let cleaned = clean_text(&text_content);
    Ok(ParsedDocument {
        text: cleaned,
        pages: 1, // DOCX doesn't have clear page boundaries in the XML
        file_type: "docx".to_string(),
    })
}

/// Parse an Excel file (XLSX) and extract text
pub fn parse_xlsx(data: &[u8]) -> Result<ParsedDocument, String> {
    use calamine::{Reader, Xlsx};

    let cursor = Cursor::new(data);
    let mut workbook: Xlsx<_> = Xlsx::new(cursor)
        .map_err(|e| format!("Failed to open XLSX: {}", e))?;

    let mut all_text = Vec::new();

    for sheet_name in workbook.sheet_names().to_vec() {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            let mut sheet_text = format!("[Sheet: {}]\n", sheet_name);
            
            for row in range.rows() {
                let row_text: Vec<String> = row
                    .iter()
                    .map(|cell| cell.to_string())
                    .collect();
                sheet_text.push_str(&row_text.join("\t"));
                sheet_text.push('\n');
            }
            
            all_text.push(sheet_text);
        }
    }

    let text = all_text.join("\n");
    let cleaned = clean_text(&text);
    
    Ok(ParsedDocument {
        text: cleaned,
        pages: all_text.len(),
        file_type: "xlsx".to_string(),
    })
}

/// Parse a PowerPoint file (PPTX) and extract text
pub fn parse_pptx(data: &[u8]) -> Result<ParsedDocument, String> {
    let cursor = Cursor::new(data);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to open PPTX as ZIP: {}", e))?;

    let mut slides: Vec<(usize, String)> = Vec::new();

    // Find all slide XML files
    let file_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .filter(|name| name.starts_with("ppt/slides/slide") && name.ends_with(".xml"))
        .collect();

    for file_name in file_names {
        // Extract slide number from filename
        let slide_num = file_name
            .trim_start_matches("ppt/slides/slide")
            .trim_end_matches(".xml")
            .parse::<usize>()
            .unwrap_or(0);

        if let Ok(mut file) = archive.by_name(&file_name) {
            let mut xml_content = String::new();
            if file.read_to_string(&mut xml_content).is_ok() {
                let text = extract_text_from_xml(&xml_content, "a:t");
                if !text.trim().is_empty() {
                    slides.push((slide_num, text));
                }
            }
        }
    }

    // Sort by slide number
    slides.sort_by_key(|(num, _)| *num);

    let text = slides
        .iter()
        .map(|(num, text)| format!("[Slide {}]\n{}", num, text))
        .collect::<Vec<_>>()
        .join("\n\n");

    let cleaned = clean_text(&text);
    let page_count = slides.len();

    Ok(ParsedDocument {
        text: cleaned,
        pages: page_count,
        file_type: "pptx".to_string(),
    })
}

/// Parse any supported document type
pub fn parse_document(data: &[u8], filename: &str) -> Result<ParsedDocument, String> {
    let ext = filename
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "pdf" => parse_pdf(data),
        "docx" | "doc" => parse_docx(data),
        "xlsx" | "xls" => parse_xlsx(data),
        "pptx" | "ppt" => parse_pptx(data),
        // Text-based files - just convert to string
        "txt" | "md" | "markdown" | "json" | "csv" | "xml" | "yaml" | "yml" 
        | "html" | "htm" | "css" | "js" | "ts" | "jsx" | "tsx" | "py" | "rs" 
        | "go" | "java" | "c" | "cpp" | "h" | "hpp" | "cs" | "rb" | "php" 
        | "swift" | "kt" | "scala" | "r" | "sql" | "sh" | "bash" | "ps1"
        | "vue" | "svelte" | "toml" | "ini" | "env" | "log" => {
            let text = String::from_utf8_lossy(data).to_string();
            Ok(ParsedDocument {
                text: clean_text(&text),
                pages: 1,
                file_type: ext,
            })
        }
        _ => Err(format!("Unsupported file type: {}", ext)),
    }
}

/// Extract text content from XML tags
fn extract_text_from_xml(xml: &str, tag: &str) -> String {
    let open_tag = format!("<{}>", tag);
    let close_tag = format!("</{}>", tag);
    
    let mut result = Vec::new();
    let mut remaining = xml;
    
    while let Some(start) = remaining.find(&open_tag) {
        remaining = &remaining[start + open_tag.len()..];
        if let Some(end) = remaining.find(&close_tag) {
            let text = &remaining[..end];
            // Skip if it contains nested XML
            if !text.contains('<') {
                result.push(text.to_string());
            }
            remaining = &remaining[end + close_tag.len()..];
        }
    }
    
    result.join(" ")
}

/// Clean extracted text
fn clean_text(text: &str) -> String {
    text
        // Normalize line endings
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        // Remove excessive whitespace
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Count approximate pages based on content
fn count_pages(text: &str) -> usize {
    // Rough estimate: ~3000 chars per page
    (text.len() / 3000).max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_text() {
        let input = "  Hello   World  \n\n\n  Test  ";
        let result = clean_text(input);
        assert_eq!(result, "Hello   World\nTest");
    }

    #[test]
    fn test_extract_text_from_xml() {
        let xml = "<root><a:t>Hello</a:t> <a:t>World</a:t></root>";
        let result = extract_text_from_xml(xml, "a:t");
        assert_eq!(result, "Hello World");
    }
}
