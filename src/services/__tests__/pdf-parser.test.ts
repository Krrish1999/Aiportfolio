import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFParserService, PDFExtractionResult, PDFPageData } from '../pdf-parser';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
  version: '3.0.0'
}));

describe('PDFParserService', () => {
  let pdfParser: PDFParserService;
  let mockPdf: any;
  let mockPage: any;

  beforeEach(() => {
    pdfParser = new PDFParserService();
    
    // Mock PDF document
    mockPdf = {
      numPages: 2,
      getPage: vi.fn(),
      getMetadata: vi.fn().mockResolvedValue({
        info: {
          Title: 'John Doe Resume',
          Author: 'John Doe',
          Creator: 'Microsoft Word',
          CreationDate: 'D:20240101120000Z'
        }
      })
    };

    // Mock PDF page
    mockPage = {
      getViewport: vi.fn().mockReturnValue({
        width: 612,
        height: 792
      }),
      getTextContent: vi.fn()
    };

    mockPdf.getPage.mockResolvedValue(mockPage);
  });

  describe('extractFromBuffer', () => {
    it('should extract text and metadata from PDF buffer', async () => {
      // Mock text content
      const mockTextContent = {
        items: [
          {
            str: 'John Doe',
            transform: [12, 0, 0, 12, 100, 700],
            width: 60,
            height: 12,
            fontName: 'Arial-Bold'
          },
          {
            str: 'Software Engineer',
            transform: [10, 0, 0, 10, 100, 680],
            width: 80,
            height: 10,
            fontName: 'Arial'
          },
          {
            str: 'john.doe@email.com',
            transform: [10, 0, 0, 10, 100, 660],
            width: 100,
            height: 10,
            fontName: 'Arial'
          }
        ]
      };

      mockPage.getTextContent.mockResolvedValue(mockTextContent);

      // Mock pdfjs-dist getDocument
      const { getDocument } = await import('pdfjs-dist');
      (getDocument as any).mockReturnValue({
        promise: Promise.resolve(mockPdf)
      });

      const buffer = Buffer.from('mock pdf content');
      const result = await pdfParser.extractFromBuffer(buffer);

      expect(result).toMatchObject({
        pages: expect.arrayContaining([
          expect.objectContaining({
            pageNumber: 1,
            textItems: expect.arrayContaining([
              expect.objectContaining({
                text: 'John Doe',
                x: 100,
                y: 700,
                fontSize: 12,
                fontName: 'Arial-Bold'
              })
            ]),
            rawText: expect.stringContaining('John Doe'),
            width: 612,
            height: 792
          })
        ]),
        fullText: expect.stringContaining('John Doe'),
        preprocessedText: expect.stringContaining('John Doe'),
        hasComplexLayout: expect.any(Boolean),
        metadata: expect.objectContaining({
          title: 'John Doe Resume',
          author: 'John Doe'
        })
      });
    });

    it('should handle PDF parsing errors gracefully', async () => {
      const { getDocument } = await import('pdfjs-dist');
      (getDocument as any).mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF'))
      });

      const buffer = Buffer.from('invalid pdf');
      
      await expect(pdfParser.extractFromBuffer(buffer)).rejects.toThrow('PDF parsing failed: Invalid PDF');
    });

    it('should handle missing metadata gracefully', async () => {
      mockPdf.getMetadata.mockRejectedValue(new Error('No metadata'));
      
      const mockTextContent = { items: [] };
      mockPage.getTextContent.mockResolvedValue(mockTextContent);

      const { getDocument } = await import('pdfjs-dist');
      (getDocument as any).mockReturnValue({
        promise: Promise.resolve(mockPdf)
      });

      const buffer = Buffer.from('mock pdf content');
      const result = await pdfParser.extractFromBuffer(buffer);

      expect(result.metadata).toEqual({});
      expect(result.hasComplexLayout).toBe(false);
      expect(result.preprocessedText).toBeDefined();
    });
  });

  describe('preprocessText', () => {
    it('should normalize section headers', () => {
      const input = 'WORK EXPERIENCE\nSoftware Engineer\nTECHNICAL SKILLS\nJavaScript';
      const result = pdfParser.preprocessText(input);
      
      expect(result).toContain('EXPERIENCE');
      expect(result).toContain('SKILLS');
    });

    it('should normalize date formats', () => {
      const input = '01/15/2023 to 2024-03-20';
      const result = pdfParser.preprocessText(input);
      
      expect(result).toContain('01/15/2023');
      expect(result).toContain('03/20/2024');
    });

    it('should normalize phone numbers', () => {
      const input = '(555) 123-4567';
      const result = pdfParser.preprocessText(input);
      
      expect(result).toContain('555-123-4567');
    });

    it('should normalize email addresses with proper spacing', () => {
      const input = 'Contact:john.doe@email.com for more info';
      const result = pdfParser.preprocessText(input);
      
      expect(result).toContain(' john.doe@email.com ');
    });

    it('should normalize URLs with proper spacing', () => {
      const input = 'Portfolio:https://johndoe.com and www.github.com/johndoe more text';
      const result = pdfParser.preprocessText(input);
      
      expect(result).toContain(' https://johndoe.com ');
      expect(result).toContain(' www.github.com/johndoe ');
    });

    it('should normalize additional section headers', () => {
      const input = 'CAREER HISTORY\nSoftware Engineer\nEXPERTISE\nJavaScript\nCREDENTIALS\nAWS Certified';
      const result = pdfParser.preprocessText(input);
      
      expect(result).toContain('EXPERIENCE');
      expect(result).toContain('SKILLS');
      expect(result).toContain('CERTIFICATIONS');
    });

    it('should normalize bullet points and quotes', () => {
      const input = `• First bullet
▪ Second bullet
"Quoted text"
'Smart quotes'`;
      const result = pdfParser.preprocessText(input);
      
      expect(result).toContain('• First bullet');
      expect(result).toContain('• Second bullet');
      expect(result).toContain('"Quoted text"');
      expect(result).toContain("'Smart quotes'");
    });

    it('should normalize date ranges', () => {
      const input = 'January 2020 - March 2023\nApril 2023 - Present';
      const result = pdfParser.preprocessText(input);
      
      expect(result).toContain('January 2020 - March 2023');
      expect(result).toContain('April 2023 - Present');
    });

    it('should clean up excessive whitespace', () => {
      const input = 'John    Doe\n\n\nSoftware   Engineer';
      const result = pdfParser.preprocessText(input);
      
      expect(result).toBe('John Doe Software Engineer');
    });
  });

  describe('detectComplexLayout', () => {
    it('should detect multi-column layout', () => {
      const pages: PDFPageData[] = [
        {
          pageNumber: 1,
          textItems: [
            // Left column
            { text: 'Experience', x: 50, y: 700, width: 60, height: 12, fontName: 'Arial', fontSize: 12 },
            { text: 'Software Engineer', x: 50, y: 680, width: 100, height: 10, fontName: 'Arial', fontSize: 10 },
            // Right column (large gap)
            { text: 'Skills', x: 300, y: 700, width: 40, height: 12, fontName: 'Arial', fontSize: 12 },
            { text: 'JavaScript', x: 300, y: 680, width: 60, height: 10, fontName: 'Arial', fontSize: 10 }
          ],
          rawText: 'Experience Software Engineer Skills JavaScript',
          width: 612,
          height: 792
        }
      ];

      const result = pdfParser.detectComplexLayout(pages);
      expect(result).toBe(true);
    });

    it('should not detect complex layout for single column', () => {
      const pages: PDFPageData[] = [
        {
          pageNumber: 1,
          textItems: [
            { text: 'John Doe', x: 100, y: 700, width: 60, height: 12, fontName: 'Arial', fontSize: 12 },
            { text: 'Software Engineer', x: 100, y: 680, width: 100, height: 10, fontName: 'Arial', fontSize: 10 },
            { text: 'Experience', x: 100, y: 650, width: 60, height: 10, fontName: 'Arial', fontSize: 10 }
          ],
          rawText: 'John Doe Software Engineer Experience',
          width: 612,
          height: 792
        }
      ];

      const result = pdfParser.detectComplexLayout(pages);
      expect(result).toBe(false);
    });

    it('should handle empty pages', () => {
      const pages: PDFPageData[] = [
        {
          pageNumber: 1,
          textItems: [],
          rawText: '',
          width: 612,
          height: 792
        }
      ];

      const result = pdfParser.detectComplexLayout(pages);
      expect(result).toBe(false);
    });
  });

  describe('cleanText', () => {
    it('should remove excessive whitespace', () => {
      const dirtyText = 'John    Doe\n\n\n\nSoftware Engineer   ';
      // Access private method through any cast for testing
      const result = (pdfParser as any).cleanText(dirtyText);
      
      expect(result).toBe('John Doe\n\nSoftware Engineer');
    });

    it('should remove non-printable characters', () => {
      const textWithArtifacts = 'John\x00Doe\x01Software\x02Engineer';
      const result = (pdfParser as any).cleanText(textWithArtifacts);
      
      expect(result).toBe('JohnDoeSoftwareEngineer');
    });

    it('should normalize line breaks', () => {
      const textWithMixedBreaks = 'Line 1\r\nLine 2\rLine 3\nLine 4';
      const result = (pdfParser as any).cleanText(textWithMixedBreaks);
      
      expect(result).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle TextMarkedContent items', async () => {
      const mockTextContent = {
        items: [
          {
            str: 'John Doe',
            transform: [12, 0, 0, 12, 100, 700],
            width: 60,
            height: 12,
            fontName: 'Arial-Bold'
          },
          {
            // TextMarkedContent item (no str property)
            type: 'marked-content'
          }
        ]
      };

      mockPage.getTextContent.mockResolvedValue(mockTextContent);

      const { getDocument } = await import('pdfjs-dist');
      (getDocument as any).mockReturnValue({
        promise: Promise.resolve(mockPdf)
      });

      const buffer = Buffer.from('mock pdf content');
      const result = await pdfParser.extractFromBuffer(buffer);

      expect(result.pages[0].textItems).toHaveLength(1);
      expect(result.pages[0].textItems[0].text).toBe('John Doe');
    });

    it('should handle zero or negative font sizes', async () => {
      const mockTextContent = {
        items: [
          {
            str: 'Test Text',
            transform: [0, 0, 0, 0, 100, 700], // Zero transform values
            width: 60,
            height: 12,
            fontName: 'Arial'
          }
        ]
      };

      mockPage.getTextContent.mockResolvedValue(mockTextContent);

      const { getDocument } = await import('pdfjs-dist');
      (getDocument as any).mockReturnValue({
        promise: Promise.resolve(mockPdf)
      });

      const buffer = Buffer.from('mock pdf content');
      const result = await pdfParser.extractFromBuffer(buffer);

      expect(result.pages[0].textItems[0].fontSize).toBe(0);
    });
  });

  describe('extractLayoutMetadata', () => {
    it('should extract section information from pages', () => {
      const pages: PDFPageData[] = [
        {
          pageNumber: 1,
          textItems: [
            { text: 'EXPERIENCE', x: 50, y: 700, width: 80, height: 14, fontName: 'Arial-Bold', fontSize: 14 },
            { text: 'Software Engineer', x: 50, y: 680, width: 100, height: 10, fontName: 'Arial', fontSize: 10 },
            { text: 'EDUCATION', x: 50, y: 600, width: 70, height: 14, fontName: 'Arial-Bold', fontSize: 14 },
            { text: 'Computer Science', x: 50, y: 580, width: 90, height: 10, fontName: 'Arial', fontSize: 10 }
          ],
          rawText: 'EXPERIENCE Software Engineer EDUCATION Computer Science',
          width: 612,
          height: 792
        }
      ];

      const metadata = pdfParser.extractLayoutMetadata(pages);

      expect(metadata.sections).toHaveLength(2);
      expect(metadata.sections[0].name).toBe('EXPERIENCE');
      expect(metadata.sections[1].name).toBe('EDUCATION');
      expect(metadata.averageFontSize).toBe(12);
      expect(metadata.columns).toBe(1);
      expect(metadata.headerFontSizes).toContain(14);
    });

    it('should detect multi-column layout', () => {
      const pages: PDFPageData[] = [
        {
          pageNumber: 1,
          textItems: [
            // Left column
            { text: 'EXPERIENCE', x: 50, y: 700, width: 80, height: 12, fontName: 'Arial', fontSize: 12 },
            { text: 'Software Engineer', x: 50, y: 680, width: 100, height: 10, fontName: 'Arial', fontSize: 10 },
            // Right column (significant gap)
            { text: 'SKILLS', x: 350, y: 700, width: 50, height: 12, fontName: 'Arial', fontSize: 12 },
            { text: 'JavaScript', x: 350, y: 680, width: 60, height: 10, fontName: 'Arial', fontSize: 10 }
          ],
          rawText: 'EXPERIENCE Software Engineer SKILLS JavaScript',
          width: 612,
          height: 792
        }
      ];

      const metadata = pdfParser.extractLayoutMetadata(pages);

      expect(metadata.columns).toBeGreaterThan(1);
    });

    it('should handle empty pages gracefully', () => {
      const pages: PDFPageData[] = [
        {
          pageNumber: 1,
          textItems: [],
          rawText: '',
          width: 612,
          height: 792
        }
      ];

      const metadata = pdfParser.extractLayoutMetadata(pages);

      expect(metadata.sections).toHaveLength(0);
      expect(metadata.columns).toBe(1);
      expect(metadata.averageFontSize).toBe(12);
      expect(metadata.headerFontSizes).toHaveLength(0);
    });
  });

  describe('integration tests', () => {
    it('should handle a complete resume parsing workflow', async () => {
      // Mock a realistic resume structure
      const mockTextContent = {
        items: [
          // Header
          { str: 'John Doe', transform: [16, 0, 0, 16, 100, 750], width: 80, height: 16, fontName: 'Arial-Bold' },
          { str: 'Software Engineer', transform: [12, 0, 0, 12, 100, 730], width: 120, height: 12, fontName: 'Arial' },
          { str: 'john.doe@email.com', transform: [10, 0, 0, 10, 100, 710], width: 100, height: 10, fontName: 'Arial' },
          { str: '(555) 123-4567', transform: [10, 0, 0, 10, 100, 695], width: 80, height: 10, fontName: 'Arial' },
          
          // Experience section
          { str: 'EXPERIENCE', transform: [14, 0, 0, 14, 100, 680], width: 90, height: 14, fontName: 'Arial-Bold' },
          { str: 'Senior Developer', transform: [12, 0, 0, 12, 100, 660], width: 100, height: 12, fontName: 'Arial-Bold' },
          { str: 'Tech Corp', transform: [10, 0, 0, 10, 100, 645], width: 60, height: 10, fontName: 'Arial' },
          { str: 'Jan 2020 - Present', transform: [10, 0, 0, 10, 100, 630], width: 100, height: 10, fontName: 'Arial' },
          { str: '• Led development of microservices architecture', transform: [10, 0, 0, 10, 110, 615], width: 200, height: 10, fontName: 'Arial' },
          
          // Skills section
          { str: 'SKILLS', transform: [14, 0, 0, 14, 100, 580], width: 60, height: 14, fontName: 'Arial-Bold' },
          { str: 'JavaScript, TypeScript, React, Node.js', transform: [10, 0, 0, 10, 100, 560], width: 180, height: 10, fontName: 'Arial' }
        ]
      };

      mockPage.getTextContent.mockResolvedValue(mockTextContent);

      const { getDocument } = await import('pdfjs-dist');
      (getDocument as any).mockReturnValue({
        promise: Promise.resolve(mockPdf)
      });

      const buffer = Buffer.from('mock resume pdf');
      const result = await pdfParser.extractFromBuffer(buffer);

      // Verify extraction results
      expect(result.fullText).toContain('John Doe');
      expect(result.fullText).toContain('Software Engineer');
      expect(result.fullText).toContain('john.doe@email.com');
      expect(result.fullText).toContain('EXPERIENCE');
      expect(result.fullText).toContain('SKILLS');
      
      // Verify preprocessing
      expect(result.preprocessedText).toContain('555-123-4567'); // Normalized phone
      expect(result.preprocessedText).toContain(' john.doe@email.com '); // Normalized email
      
      // Verify layout detection
      expect(result.hasComplexLayout).toBe(false);
      
      // Verify layout metadata
      const layoutMetadata = pdfParser.extractLayoutMetadata(result.pages);
      expect(layoutMetadata.sections.length).toBeGreaterThan(0);
      expect(layoutMetadata.sections.some(s => s.name === 'EXPERIENCE')).toBe(true);
      expect(layoutMetadata.sections.some(s => s.name === 'SKILLS')).toBe(true);
    });
  });
});