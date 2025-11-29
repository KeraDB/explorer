export interface ParsedFile {
  name: string
  content: string
  size: number
  type: string
}

// Supported file extensions
export const SUPPORTED_EXTENSIONS = [
  // Text files
  '.txt', '.md', '.markdown',
  // Data files
  '.json', '.csv', '.xml', '.yaml', '.yml',
  // Web files
  '.html', '.htm', '.css',
  // Code files
  '.js', '.ts', '.jsx', '.tsx', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.sql', '.sh', '.bash', '.ps1',
  '.vue', '.svelte', '.astro',
  // Config files
  '.toml', '.ini', '.env', '.gitignore', '.dockerfile',
  // Documents
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  // Log files
  '.log'
]

export const ACCEPT_STRING = SUPPORTED_EXTENSIONS.join(',')

/**
 * Check if a file type is supported
 */
export function isSupported(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return SUPPORTED_EXTENSIONS.includes(ext)
}

/**
 * Clean extracted text - remove non-printable characters and normalize
 */
function cleanText(text: string): string {
  return text
    // Remove non-printable characters except common whitespace
    .replace(/[^\x20-\x7E\t\n\r\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if text is mostly readable (has enough ASCII/Latin characters)
 */
function isReadableText(text: string): boolean {
  if (text.length === 0) return false
  const readableChars = text.match(/[a-zA-Z0-9\s.,!?;:'"()-]/g) || []
  return readableChars.length / text.length > 0.5
}

/**
 * Parse a PDF file and extract text content (lazy loaded)
 */
async function parsePDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ 
    data: arrayBuffer,
    useSystemFonts: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/standard_fonts/'
  }).promise
  
  const textParts: string[] = []
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent({ 
      includeMarkedContent: false,
      disableNormalization: false
    })
    
    // Group items by their vertical position to maintain line structure
    const lines: Map<number, string[]> = new Map()
    
    for (const item of textContent.items) {
      if ('str' in item && item.str) {
        const y = Math.round((item as any).transform?.[5] || 0)
        if (!lines.has(y)) {
          lines.set(y, [])
        }
        lines.get(y)!.push(item.str)
      }
    }
    
    // Sort by Y position (top to bottom) and join
    const sortedLines = Array.from(lines.entries())
      .sort((a, b) => b[0] - a[0]) // Higher Y = higher on page
      .map(([_, texts]) => texts.join(' '))
      .filter(line => line.trim().length > 0)
    
    const pageText = sortedLines.join('\n')
    const cleanedText = cleanText(pageText)
    
    if (cleanedText.length > 0) {
      textParts.push(`[Page ${i}]\n${cleanedText}`)
    }
  }
  
  const result = textParts.join('\n\n')
  
  // Check if extracted text is readable
  if (!isReadableText(result) && result.length > 0) {
    return `[PDF "${file.name}" contains non-extractable text (scanned/image-based or encrypted). Extracted ${result.length} characters but content appears to be encoded or corrupted.]`
  }
  
  return result || `[PDF "${file.name}" appears to be empty or contains only images]`
}

/**
 * Parse a Word document (.docx) and extract text content (lazy loaded)
 */
async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

/**
 * Parse an Excel file (.xlsx, .xls) and extract text content (lazy loaded)
 */
async function parseExcel(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  
  const textParts: string[] = []
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    // Convert to CSV for text representation
    const csv = XLSX.utils.sheet_to_csv(sheet)
    textParts.push(`[Sheet: ${sheetName}]\n${csv}`)
  }
  
  return textParts.join('\n\n')
}

/**
 * Parse a PowerPoint file (.pptx) and extract text content (lazy loaded)
 * PPTX files are ZIP archives containing XML files with slide content
 */
async function parsePowerPoint(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  const textParts: string[] = []
  const slideFiles: string[] = []
  
  // Find all slide XML files
  zip.forEach((relativePath) => {
    if (relativePath.match(/ppt\/slides\/slide\d+\.xml$/)) {
      slideFiles.push(relativePath)
    }
  })
  
  // Sort slides by number
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0')
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0')
    return numA - numB
  })
  
  // Extract text from each slide
  for (const slidePath of slideFiles) {
    const slideXml = await zip.file(slidePath)?.async('string')
    if (slideXml) {
      // Extract text from <a:t> tags (text runs in PowerPoint XML)
      const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g)
      if (textMatches) {
        const slideText = textMatches
          .map(match => match.replace(/<\/?a:t>/g, ''))
          .filter(text => text.trim().length > 0)
          .join(' ')
        
        const slideNum = slidePath.match(/slide(\d+)/)?.[1]
        textParts.push(`[Slide ${slideNum}]\n${slideText}`)
      }
    }
  }
  
  return textParts.join('\n\n')
}

/**
 * Parse any supported file and return its text content
 */
export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  let content: string
  
  try {
    if (ext === '.pdf') {
      content = await parsePDF(file)
    } else if (ext === '.docx' || ext === '.doc') {
      content = await parseDocx(file)
    } else if (ext === '.xlsx' || ext === '.xls') {
      content = await parseExcel(file)
    } else if (ext === '.pptx' || ext === '.ppt') {
      content = await parsePowerPoint(file)
    } else {
      // All other files - read as text
      content = await file.text()
    }
  } catch (error) {
    console.error(`Error parsing ${file.name}:`, error)
    // Fallback to text reading
    try {
      content = await file.text()
    } catch {
      content = `[Error: Could not parse ${file.name}]`
    }
  }
  
  return {
    name: file.name,
    content,
    size: file.size,
    type: ext
  }
}

/**
 * Parse multiple files
 */
export async function parseFiles(files: FileList | File[]): Promise<ParsedFile[]> {
  const fileArray = Array.from(files)
  const results = await Promise.all(fileArray.map(parseFile))
  return results
}
