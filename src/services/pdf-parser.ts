import * as pdfjsLib from 'pdfjs-dist';
import { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
}

export interface PDFPageData {
  pageNumber: number;
  textItems: PDFTextItem[];
  rawText: string;
  width: number;
  height: number;
}

export interface LayoutAnalysis {
  isMultiColumn: boolean;
  columnCount: number;
  hasTablesOrBoxes: boolean;
  hasGraphicalElements: boolean;
  textDensity: number;
  layoutComplexity: 'simple' | 'moderate' | 'complex';
  confidenceScore: number;
  fallbackRequired: boolean;
  userConfirmationNeeded: string[];
}

export interface PDFExtractionResult {
  pages: PDFPageData[];
  fullText: string;
  preprocessedText: string;
  hasComplexLayout: boolean;
  layoutAnalysis: LayoutAnalysis;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export class PDFParserService {
  /**
   * Extract text and layout metadata from PDF buffer
   */
  async extractFromBuffer(buffer: Buffer): Promise<PDFExtractionResult> {
    try {
      const uint8Array = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;

      const pages: PDFPageData[] = [];
      let fullText = '';

      // Extract metadata
      const metadata = await this.extractMetadata(pdf);

      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const pageData = await this.extractPageData(page, pageNum);
        pages.push(pageData);
        fullText += pageData.rawText + '\n\n';
      }

      const preprocessedText = this.preprocessText(fullText.trim());
      const layoutAnalysis = this.analyzeLayout(pages);
      const hasComplexLayout = layoutAnalysis.layoutComplexity !== 'simple';

      return {
        pages,
        fullText: fullText.trim(),
        preprocessedText,
        hasComplexLayout,
        layoutAnalysis,
        metadata
      };
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract metadata from PDF document
   */
  private async extractMetadata(pdf: any): Promise<PDFExtractionResult['metadata']> {
    try {
      const metadata = await pdf.getMetadata();
      const info = metadata.info;

      return {
        title: info.Title || undefined,
        author: info.Author || undefined,
        subject: info.Subject || undefined,
        creator: info.Creator || undefined,
        producer: info.Producer || undefined,
        creationDate: info.CreationDate ? new Date(info.CreationDate) : undefined,
        modificationDate: info.ModDate ? new Date(info.ModDate) : undefined,
      };
    } catch (error) {
      // Return empty metadata if extraction fails
      return {};
    }
  }

  /**
   * Extract text and layout data from a single page
   */
  private async extractPageData(page: any, pageNumber: number): Promise<PDFPageData> {
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const textItems: PDFTextItem[] = [];
    let rawText = '';

    // Process text items with position and formatting info
    for (const item of textContent.items) {
      if (this.isTextItem(item)) {
        const textItem: PDFTextItem = {
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          fontName: item.fontName,
          fontSize: Math.abs(item.transform[0]), // Extract font size from transform matrix
        };

        textItems.push(textItem);
        rawText += item.str + ' ';
      }
    }

    return {
      pageNumber,
      textItems,
      rawText: this.cleanText(rawText),
      width: viewport.width,
      height: viewport.height,
    };
  }

  /**
   * Type guard to check if item is a TextItem
   */
  private isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
    return 'str' in item;
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanText(text: string): string {
    return text
      // Normalize line breaks first
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove common PDF artifacts (but preserve line breaks)
      .replace(/[^\x20-\x7E\n\t]/g, '')
      // Remove trailing spaces from each line
      .replace(/[ \t]+$/gm, '')
      // Normalize multiple spaces within lines (but preserve line breaks)
      .replace(/[ \t]+/g, ' ')
      // Remove excessive line breaks (3 or more becomes 2)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Preprocess text for better parsing
   */
  preprocessText(text: string): string {
    return text
      // Normalize common resume section headers
      .replace(/\b(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|PROFESSIONAL EXPERIENCE|CAREER HISTORY)\b/gi, 'EXPERIENCE')
      .replace(/\b(EDUCATION|ACADEMIC BACKGROUND|QUALIFICATIONS|ACADEMIC HISTORY)\b/gi, 'EDUCATION')
      .replace(/\b(SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|TECHNOLOGIES|EXPERTISE)\b/gi, 'SKILLS')
      .replace(/\b(PROJECTS|PERSONAL PROJECTS|KEY PROJECTS|PORTFOLIO)\b/gi, 'PROJECTS')
      .replace(/\b(CONTACT|CONTACT INFORMATION|PERSONAL INFORMATION)\b/gi, 'CONTACT')
      .replace(/\b(SUMMARY|PROFILE|OBJECTIVE|ABOUT)\b/gi, 'SUMMARY')
      .replace(/\b(CERTIFICATIONS|CERTIFICATES|CREDENTIALS)\b/gi, 'CERTIFICATIONS')
      // Normalize date formats
      .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, '$1/$2/$3')
      .replace(/(\d{4})-(\d{1,2})-(\d{1,2})/g, '$2/$3/$1')
      .replace(/(\w+)\s+(\d{4})\s*-\s*(\w+)\s+(\d{4})/gi, '$1 $2 - $3 $4')
      .replace(/(\w+)\s+(\d{4})\s*-\s*Present/gi, '$1 $2 - Present')
      // Normalize phone numbers
      .replace(/\((\d{3})\)\s*(\d{3})-(\d{4})/g, '$1-$2-$3')
      .replace(/(\d{3})\s*\.\s*(\d{3})\s*\.\s*(\d{4})/g, '$1-$2-$3')
      // Normalize email addresses (ensure proper spacing)
      .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, ' $1 ')
      // Normalize URLs
      .replace(/(https?:\/\/[^\s]+)/g, ' $1 ')
      .replace(/(www\.[^\s]+)/g, ' $1 ')
      // Clean up bullet points and special characters
      .replace(/[•·▪▫◦‣⁃]/g, '•')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract structured layout information for better parsing
   */
  extractLayoutMetadata(pages: PDFPageData[]): {
    sections: Array<{ name: string; startY: number; endY: number; pageNumber: number }>;
    columns: number;
    averageFontSize: number;
    headerFontSizes: number[];
  } {
    const sections: Array<{ name: string; startY: number; endY: number; pageNumber: number }> = [];
    const fontSizes: number[] = [];
    let columns = 1;

    for (const page of pages) {
      const textItems = page.textItems.filter(item => item.text.trim().length > 0);
      
      // Collect font sizes for analysis
      textItems.forEach(item => fontSizes.push(item.fontSize));

      // Detect sections by looking for common section headers
      const sectionHeaders = [
        'EXPERIENCE', 'EDUCATION', 'SKILLS', 'PROJECTS', 'CONTACT', 'SUMMARY', 'CERTIFICATIONS'
      ];

      for (const item of textItems) {
        const upperText = item.text.toUpperCase();
        for (const header of sectionHeaders) {
          if (upperText.includes(header) && item.fontSize > 10) {
            sections.push({
              name: header,
              startY: item.y,
              endY: item.y - 50, // Approximate section height
              pageNumber: page.pageNumber
            });
          }
        }
      }

      // Estimate column count by analyzing text distribution
      const xPositions = textItems.map(item => item.x).sort((a, b) => a - b);
      const uniqueXPositions = [...new Set(xPositions.filter((x, i, arr) => 
        i === 0 || Math.abs(x - arr[i - 1]) > 50
      ))];
      columns = Math.max(columns, Math.min(uniqueXPositions.length, 3));
    }

    const averageFontSize = fontSizes.length > 0 ? 
      fontSizes.reduce((sum, size) => sum + size, 0) / fontSizes.length : 12;
    
    const headerFontSizes = [...new Set(fontSizes.filter(size => size > averageFontSize + 1))];

    return {
      sections: sections.sort((a, b) => b.startY - a.startY), // Sort by Y position (top to bottom)
      columns,
      averageFontSize,
      headerFontSizes
    };
  }

  /**
   * Comprehensive layout analysis for complex resume detection
   */
  analyzeLayout(pages: PDFPageData[]): LayoutAnalysis {
    let totalComplexityScore = 0;
    let isMultiColumn = false;
    let columnCount = 1;
    let hasTablesOrBoxes = false;
    let hasGraphicalElements = false;
    let totalTextItems = 0;
    let totalPageArea = 0;
    const userConfirmationNeeded: string[] = [];

    for (const page of pages) {
      const analysis = this.analyzePageLayout(page);
      
      totalComplexityScore += analysis.complexityScore;
      isMultiColumn = isMultiColumn || analysis.isMultiColumn;
      columnCount = Math.max(columnCount, analysis.columnCount);
      hasTablesOrBoxes = hasTablesOrBoxes || analysis.hasTablesOrBoxes;
      hasGraphicalElements = hasGraphicalElements || analysis.hasGraphicalElements;
      totalTextItems += page.textItems.length;
      totalPageArea += page.width * page.height;

      // Add specific warnings for user confirmation
      if (analysis.isMultiColumn) {
        userConfirmationNeeded.push(`Page ${page.pageNumber} has ${analysis.columnCount} columns - text order may need verification`);
      }
      if (analysis.hasTablesOrBoxes) {
        userConfirmationNeeded.push(`Page ${page.pageNumber} contains tables or text boxes - structure may need manual review`);
      }
      if (analysis.hasGraphicalElements) {
        userConfirmationNeeded.push(`Page ${page.pageNumber} has design elements that may affect text extraction`);
      }
    }

    const averageComplexity = totalComplexityScore / pages.length;
    const textDensity = totalTextItems / (totalPageArea / 1000000); // Items per million pixels

    // Determine layout complexity level
    let layoutComplexity: 'simple' | 'moderate' | 'complex';
    let confidenceScore: number;
    let fallbackRequired: boolean;

    if (averageComplexity < 3) {
      layoutComplexity = 'simple';
      confidenceScore = 0.9;
      fallbackRequired = false;
    } else if (averageComplexity < 6) {
      layoutComplexity = 'moderate';
      confidenceScore = 0.7;
      fallbackRequired = isMultiColumn || hasTablesOrBoxes;
    } else {
      layoutComplexity = 'complex';
      confidenceScore = 0.5;
      fallbackRequired = true;
    }

    return {
      isMultiColumn,
      columnCount,
      hasTablesOrBoxes,
      hasGraphicalElements,
      textDensity,
      layoutComplexity,
      confidenceScore,
      fallbackRequired,
      userConfirmationNeeded: [...new Set(userConfirmationNeeded)] // Remove duplicates
    };
  }

  /**
   * Analyze layout complexity for a single page
   */
  private analyzePageLayout(page: PDFPageData): {
    complexityScore: number;
    isMultiColumn: boolean;
    columnCount: number;
    hasTablesOrBoxes: boolean;
    hasGraphicalElements: boolean;
  } {
    const textItems = page.textItems.filter(item => item.text.trim().length > 0);
    let complexityScore = 0;

    if (textItems.length === 0) {
      return {
        complexityScore: 0,
        isMultiColumn: false,
        columnCount: 1,
        hasTablesOrBoxes: false,
        hasGraphicalElements: false
      };
    }

    // 1. Analyze column structure
    const columnAnalysis = this.detectColumns(textItems, page.width);
    const isMultiColumn = columnAnalysis.columnCount > 1;
    if (isMultiColumn) complexityScore += columnAnalysis.columnCount;

    // 2. Detect tables and text boxes
    const hasTablesOrBoxes = this.detectTablesAndBoxes(textItems);
    if (hasTablesOrBoxes) complexityScore += 2;

    // 3. Analyze font variation (indicates design complexity)
    const fontVariation = this.analyzeFontVariation(textItems);
    complexityScore += fontVariation.score;

    // 4. Detect irregular text positioning
    const irregularPositioning = this.detectIrregularPositioning(textItems);
    if (irregularPositioning) complexityScore += 1;

    // 5. Check for overlapping or very close text items
    const hasOverlapping = this.detectOverlappingText(textItems);
    if (hasOverlapping) complexityScore += 1;

    return {
      complexityScore,
      isMultiColumn,
      columnCount: columnAnalysis.columnCount,
      hasTablesOrBoxes,
      hasGraphicalElements: fontVariation.hasGraphicalElements
    };
  }

  /**
   * Detect column structure in text items
   */
  private detectColumns(textItems: PDFTextItem[], pageWidth: number): {
    columnCount: number;
    columnBoundaries: number[];
  } {
    // Group text items by Y position to find text lines
    const lines: { y: number; items: PDFTextItem[] }[] = [];
    
    for (const item of textItems) {
      const existingLine = lines.find(line => Math.abs(line.y - item.y) < 8);
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({ y: item.y, items: [item] });
      }
    }

    // Analyze X positions across multiple lines to detect columns
    const xPositionCounts: { [x: number]: number } = {};
    
    for (const line of lines) {
      if (line.items.length > 1) {
        // Sort items by X position
        const sortedItems = line.items.sort((a, b) => a.x - b.x);
        
        // Look for significant gaps between items
        for (let i = 1; i < sortedItems.length; i++) {
          const gap = sortedItems[i].x - (sortedItems[i-1].x + sortedItems[i-1].width);
          
          if (gap > 30) { // Significant gap indicates column boundary
            const boundaryX = Math.round((sortedItems[i-1].x + sortedItems[i-1].width + sortedItems[i].x) / 2);
            xPositionCounts[boundaryX] = (xPositionCounts[boundaryX] || 0) + 1;
          }
        }
      }
    }

    // Find consistent column boundaries (appear in multiple lines)
    const minOccurrences = Math.max(1, Math.floor(lines.length * 0.1));
    
    const columnBoundaries = Object.entries(xPositionCounts)
      .filter(([_, count]) => count >= minOccurrences)
      .map(([x, _]) => parseInt(x))
      .sort((a, b) => a - b);

    return {
      columnCount: columnBoundaries.length + 1,
      columnBoundaries
    };
  }

  /**
   * Detect tables and text boxes by analyzing alignment patterns
   */
  private detectTablesAndBoxes(textItems: PDFTextItem[]): boolean {
    // Look for grid-like patterns in text positioning
    const xPositions = [...new Set(textItems.map(item => Math.round(item.x / 5) * 5))].sort((a, b) => a - b);
    const yPositions = [...new Set(textItems.map(item => Math.round(item.y / 5) * 5))].sort((a, b) => a - b);

    // If there are many distinct X and Y positions with regular spacing, likely a table
    if (xPositions.length > 3 && yPositions.length > 3) {
      // Check for regular spacing in X positions
      const xGaps = [];
      for (let i = 1; i < xPositions.length; i++) {
        xGaps.push(xPositions[i] - xPositions[i-1]);
      }
      
      // Check for regular spacing in Y positions
      const yGaps = [];
      for (let i = 1; i < yPositions.length; i++) {
        yGaps.push(yPositions[i] - yPositions[i-1]);
      }

      // If gaps are relatively consistent, likely a table
      const xGapVariance = this.calculateVariance(xGaps);
      const yGapVariance = this.calculateVariance(yGaps);
      
      return xGapVariance < 100 && yGapVariance < 100;
    }

    return false;
  }

  /**
   * Analyze font variation to detect design complexity
   */
  private analyzeFontVariation(textItems: PDFTextItem[]): {
    score: number;
    hasGraphicalElements: boolean;
  } {
    const fontSizes = [...new Set(textItems.map(item => item.fontSize))];
    const fontNames = [...new Set(textItems.map(item => item.fontName))];

    let score = 0;
    let hasGraphicalElements = false;

    // More font sizes indicate more complex design
    if (fontSizes.length > 4) score += 1;
    if (fontSizes.length > 6) score += 1;

    // Multiple font families indicate design complexity
    if (fontNames.length > 2) score += 1;
    if (fontNames.length > 4) score += 1;

    // Very small or very large fonts might indicate graphical elements
    const minFontSize = Math.min(...fontSizes);
    const maxFontSize = Math.max(...fontSizes);
    
    if (minFontSize < 6 || maxFontSize > 24) {
      hasGraphicalElements = true;
      score += 1;
    }

    return { score, hasGraphicalElements };
  }

  /**
   * Detect irregular text positioning that might indicate complex layout
   */
  private detectIrregularPositioning(textItems: PDFTextItem[]): boolean {
    // Calculate the variance in Y positions to detect irregular line spacing
    const yPositions = textItems.map(item => item.y).sort((a, b) => a - b);
    const yGaps = [];
    
    for (let i = 1; i < yPositions.length; i++) {
      yGaps.push(yPositions[i] - yPositions[i-1]);
    }

    const variance = this.calculateVariance(yGaps);
    
    // High variance in line spacing indicates irregular positioning
    return variance > 200;
  }

  /**
   * Detect overlapping or very close text items
   */
  private detectOverlappingText(textItems: PDFTextItem[]): boolean {
    for (let i = 0; i < textItems.length; i++) {
      for (let j = i + 1; j < textItems.length; j++) {
        const item1 = textItems[i];
        const item2 = textItems[j];

        // Check if items overlap or are very close
        const xOverlap = Math.max(0, Math.min(item1.x + item1.width, item2.x + item2.width) - Math.max(item1.x, item2.x));
        const yOverlap = Math.max(0, Math.min(item1.y + item1.height, item2.y + item2.height) - Math.max(item1.y, item2.y));

        if (xOverlap > 0 && yOverlap > 0) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  /**
   * Detect if PDF has complex layout (multi-column, tables, etc.)
   * @deprecated Use analyzeLayout instead
   */
  detectComplexLayout(pages: PDFPageData[]): boolean {
    const analysis = this.analyzeLayout(pages);
    // For backward compatibility, consider moderate layouts as complex too
    return analysis.layoutComplexity === 'moderate' || analysis.layoutComplexity === 'complex';
  }
}