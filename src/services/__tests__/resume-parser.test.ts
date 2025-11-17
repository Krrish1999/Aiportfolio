import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeParserService, ResumeParsingResult } from '../resume-parser';

// Mock PDF.js to avoid DOM dependencies in tests
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
  version: '3.0.0'
}));

// Mock the dependencies
vi.mock('../pdf-parser');
vi.mock('../content-extractor');

describe('ResumeParserService', () => {
  let resumeParser: ResumeParserService;
  let mockPdfParser: any;
  let mockContentExtractor: any;

  beforeEach(async () => {
    // Create mocks
    mockPdfParser = {
      extractFromBuffer: vi.fn(),
      preprocessText: vi.fn(),
      detectComplexLayout: vi.fn()
    };

    mockContentExtractor = {
      extractContent: vi.fn(),
      normalizeSkills: vi.fn()
    };

    // Mock the modules
    const { PDFParserService } = await import('../pdf-parser');
    const { ContentExtractorService } = await import('../content-extractor');
    
    vi.mocked(PDFParserService).mockImplementation(() => mockPdfParser);
    vi.mocked(ContentExtractorService).mockImplementation(() => mockContentExtractor);

    resumeParser = new ResumeParserService();
  });

  describe('parseResume', () => {
    it('should parse a PDF resume successfully', async () => {
      // Mock PDF extraction
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [{ pageNumber: 1, textItems: [], rawText: 'John Doe\nSoftware Engineer', width: 612, height: 792 }],
        fullText: 'John Doe\nSoftware Engineer\njohn@email.com\n\nEXPERIENCE\nSenior Developer at Tech Corp',
        metadata: { title: 'Resume' }
      });

      mockPdfParser.preprocessText.mockReturnValue('John Doe\nSoftware Engineer\njohn@email.com\n\nEXPERIENCE\nSenior Developer at Tech Corp');
      mockPdfParser.detectComplexLayout.mockReturnValue(false);

      // Mock content extraction
      mockContentExtractor.extractContent.mockReturnValue({
        profile: {
          name: { value: 'John Doe', confidence: 0.9 },
          title: { value: 'Software Engineer', confidence: 0.8 },
          email: { value: 'john@email.com', confidence: 0.9 },
          phone: { value: '555-123-4567', confidence: 0.8 },
          links: {}
        },
        sections: [
          { name: 'EXPERIENCE', startIndex: 50, endIndex: 100, confidence: 0.8 }
        ],
        rawSections: {
          'EXPERIENCE': 'EXPERIENCE\nSenior Developer at Tech Corp\n• Built web applications'
        }
      });

      mockContentExtractor.normalizeSkills.mockReturnValue(['javascript', 'react']);

      const buffer = Buffer.from('mock pdf content');
      const result = await resumeParser.parseResume(buffer, 'resume.pdf');

      expect(result).toMatchObject({
        data: expect.objectContaining({
          profile: expect.objectContaining({
            name: 'John Doe',
            title: 'Software Engineer',
            email: 'john@email.com'
          })
        }),
        isComplexLayout: false,
        processingTime: expect.any(Number),
        warnings: expect.any(Array),
        confidenceScores: expect.any(Array)
      });

      expect(mockPdfParser.extractFromBuffer).toHaveBeenCalledWith(buffer);
      expect(mockContentExtractor.extractContent).toHaveBeenCalled();
    });

    it('should handle complex layout detection', async () => {
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [{ pageNumber: 1, textItems: [], rawText: 'Complex layout resume', width: 612, height: 792 }],
        fullText: 'Complex layout resume',
        metadata: {}
      });

      mockPdfParser.preprocessText.mockReturnValue('Complex layout resume');
      mockPdfParser.detectComplexLayout.mockReturnValue(true);

      mockContentExtractor.extractContent.mockReturnValue({
        profile: { name: { value: 'John Doe', confidence: 0.5 }, links: {} },
        sections: [],
        rawSections: {}
      });

      const buffer = Buffer.from('mock pdf content');
      const result = await resumeParser.parseResume(buffer, 'complex-resume.pdf');

      expect(result.isComplexLayout).toBe(true);
      expect(result.warnings).toContain('Complex layout detected - some information may require manual review');
    });

    it('should handle text files', async () => {
      mockPdfParser.preprocessText.mockReturnValue('John Doe\nSoftware Engineer');
      
      mockContentExtractor.extractContent.mockReturnValue({
        profile: { name: { value: 'John Doe', confidence: 0.8 }, links: {} },
        sections: [],
        rawSections: {}
      });

      const buffer = Buffer.from('John Doe\nSoftware Engineer');
      const result = await resumeParser.parseResume(buffer, 'resume.txt');

      expect(result.data.profile.name).toBe('John Doe');
      expect(mockPdfParser.extractFromBuffer).not.toHaveBeenCalled();
    });

    it('should apply confidence threshold filtering', async () => {
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [],
        fullText: 'Low confidence resume',
        metadata: {}
      });

      mockPdfParser.preprocessText.mockReturnValue('Low confidence resume');
      mockPdfParser.detectComplexLayout.mockReturnValue(false);

      mockContentExtractor.extractContent.mockReturnValue({
        profile: { 
          name: { value: 'John Doe', confidence: 0.3 }, // Low confidence
          email: { value: 'john@email.com', confidence: 0.2 }, // Low confidence
          links: {} 
        },
        sections: [],
        rawSections: {}
      });

      const buffer = Buffer.from('mock content');
      const result = await resumeParser.parseResume(buffer, 'resume.pdf', { confidenceThreshold: 0.5 });

      expect(result.warnings).toContain('2 fields have low confidence and may need review');
      expect(result.warnings).toContain('Critical profile information has low confidence - manual review recommended');
    });

    it('should handle parsing errors gracefully', async () => {
      mockPdfParser.extractFromBuffer.mockRejectedValue(new Error('PDF parsing failed'));

      const buffer = Buffer.from('invalid pdf');
      
      await expect(resumeParser.parseResume(buffer, 'resume.pdf')).rejects.toThrow('Resume parsing failed: PDF parsing failed');
    });
  });

  describe('skills categorization', () => {
    it('should categorize skills correctly', async () => {
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [],
        fullText: 'SKILLS\nJavaScript, React, PostgreSQL, AWS, Docker',
        metadata: {}
      });

      mockPdfParser.preprocessText.mockReturnValue('SKILLS\nJavaScript, React, PostgreSQL, AWS, Docker');
      mockPdfParser.detectComplexLayout.mockReturnValue(false);

      mockContentExtractor.extractContent.mockReturnValue({
        profile: { name: { value: 'John Doe', confidence: 0.8 }, links: {} },
        sections: [
          { name: 'SKILLS', startIndex: 0, endIndex: 50, confidence: 0.8 }
        ],
        rawSections: {
          'SKILLS': 'SKILLS\nJavaScript, React, PostgreSQL, AWS, Docker'
        }
      });

      mockContentExtractor.normalizeSkills.mockReturnValue(['javascript', 'react', 'postgresql', 'aws', 'docker']);

      const buffer = Buffer.from('mock content');
      const result = await resumeParser.parseResume(buffer, 'resume.pdf');

      expect(result.data.skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'Programming Languages',
            items: ['javascript']
          }),
          expect.objectContaining({
            category: 'Frameworks & Libraries',
            items: ['react']
          }),
          expect.objectContaining({
            category: 'Databases',
            items: ['postgresql']
          }),
          expect.objectContaining({
            category: 'Cloud & DevOps',
            items: ['aws', 'docker']
          })
        ])
      );
    });
  });

  describe('section processing', () => {
    it('should extract summary section', async () => {
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [],
        fullText: 'SUMMARY\nExperienced software engineer with 5+ years',
        metadata: {}
      });

      mockPdfParser.preprocessText.mockReturnValue('SUMMARY\nExperienced software engineer with 5+ years');
      mockPdfParser.detectComplexLayout.mockReturnValue(false);

      mockContentExtractor.extractContent.mockReturnValue({
        profile: { name: { value: 'John Doe', confidence: 0.8 }, links: {} },
        sections: [
          { name: 'SUMMARY', startIndex: 0, endIndex: 50, confidence: 0.8 }
        ],
        rawSections: {
          'SUMMARY': 'SUMMARY\nExperienced software engineer with 5+ years'
        }
      });

      const buffer = Buffer.from('mock content');
      const result = await resumeParser.parseResume(buffer, 'resume.pdf');

      expect(result.data.summary).toBe('Experienced software engineer with 5+ years');
    });

    it('should extract experience section', async () => {
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [],
        fullText: 'EXPERIENCE\nSenior Software Engineer\n• Built web applications',
        metadata: {}
      });

      mockPdfParser.preprocessText.mockReturnValue('EXPERIENCE\nSenior Software Engineer\n• Built web applications');
      mockPdfParser.detectComplexLayout.mockReturnValue(false);

      mockContentExtractor.extractContent.mockReturnValue({
        profile: { name: { value: 'John Doe', confidence: 0.8 }, links: {} },
        sections: [
          { name: 'EXPERIENCE', startIndex: 0, endIndex: 100, confidence: 0.8 }
        ],
        rawSections: {
          'EXPERIENCE': 'EXPERIENCE\nSenior Software Engineer\n• Built web applications\n• Improved performance'
        }
      });

      const buffer = Buffer.from('mock content');
      const result = await resumeParser.parseResume(buffer, 'resume.pdf');

      expect(result.data.experience).toHaveLength(1);
      expect(result.data.experience[0]).toMatchObject({
        role: 'Senior Software Engineer',
        bullets: ['Built web applications', 'Improved performance']
      });
    });

    it('should extract education section', async () => {
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [],
        fullText: 'EDUCATION\nBachelor of Science in Computer Science',
        metadata: {}
      });

      mockPdfParser.preprocessText.mockReturnValue('EDUCATION\nBachelor of Science in Computer Science');
      mockPdfParser.detectComplexLayout.mockReturnValue(false);

      mockContentExtractor.extractContent.mockReturnValue({
        profile: { name: { value: 'John Doe', confidence: 0.8 }, links: {} },
        sections: [
          { name: 'EDUCATION', startIndex: 0, endIndex: 50, confidence: 0.8 }
        ],
        rawSections: {
          'EDUCATION': 'EDUCATION\nBachelor of Science in Computer Science'
        }
      });

      const buffer = Buffer.from('mock content');
      const result = await resumeParser.parseResume(buffer, 'resume.pdf');

      expect(result.data.education).toHaveLength(1);
      expect(result.data.education[0].degree).toBe('Bachelor of Science in Computer Science');
    });
  });

  describe('validateResumeData', () => {
    it('should validate complete resume data', () => {
      const validData = {
        profile: {
          name: 'John Doe',
          title: 'Software Engineer',
          email: 'john@email.com',
          links: {}
        },
        summary: 'Experienced developer',
        skills: [{ category: 'Programming', items: ['JavaScript'], confidence: 0.8 }],
        experience: [{ 
          company: 'Tech Corp', 
          role: 'Developer', 
          startDate: new Date(), 
          bullets: [], 
          techStack: [], 
          confidence: 0.8 
        }],
        projects: [],
        education: [],
        certifications: []
      };

      const result = resumeParser.validateResumeData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify missing required fields', () => {
      const invalidData = {
        profile: {
          name: '',
          title: '',
          email: 'invalid-email',
          links: {}
        },
        summary: '',
        skills: [],
        experience: [],
        projects: [],
        education: [],
        certifications: []
      };

      const result = resumeParser.validateResumeData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
      expect(result.errors).toContain('Invalid email format');
      expect(result.errors).toContain('No work experience or projects found');
      expect(result.errors).toContain('No skills identified');
    });
  });

  describe('confidence scoring', () => {
    it('should generate confidence scores for all extracted fields', async () => {
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [],
        fullText: 'John Doe\nSoftware Engineer\njohn@email.com',
        metadata: {}
      });

      mockPdfParser.preprocessText.mockReturnValue('John Doe\nSoftware Engineer\njohn@email.com');
      mockPdfParser.detectComplexLayout.mockReturnValue(false);

      mockContentExtractor.extractContent.mockReturnValue({
        profile: {
          name: { value: 'John Doe', confidence: 0.9 },
          title: { value: 'Software Engineer', confidence: 0.8 },
          email: { value: 'john@email.com', confidence: 0.95 },
          phone: { value: '555-123-4567', confidence: 0.85 },
          links: {}
        },
        sections: [],
        rawSections: {}
      });

      const buffer = Buffer.from('mock content');
      const result = await resumeParser.parseResume(buffer, 'resume.pdf');

      expect(result.confidenceScores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'profile.name',
            score: 0.9,
            reason: expect.any(String)
          }),
          expect.objectContaining({
            field: 'profile.title',
            score: 0.8,
            reason: expect.any(String)
          }),
          expect.objectContaining({
            field: 'profile.email',
            score: 0.95,
            reason: expect.any(String)
          }),
          expect.objectContaining({
            field: 'profile.phone',
            score: 0.85,
            reason: expect.any(String)
          })
        ])
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty resume content', async () => {
      mockPdfParser.extractFromBuffer.mockResolvedValue({
        pages: [],
        fullText: '',
        metadata: {}
      });

      mockPdfParser.preprocessText.mockReturnValue('');
      mockPdfParser.detectComplexLayout.mockReturnValue(false);

      mockContentExtractor.extractContent.mockReturnValue({
        profile: { links: {} },
        sections: [],
        rawSections: {}
      });

      const buffer = Buffer.from('');
      const result = await resumeParser.parseResume(buffer, 'empty.pdf');

      expect(result.data.profile.name).toBe('');
      expect(result.data.profile.email).toBe('');
    });

    it('should handle unknown file extensions', async () => {
      mockPdfParser.preprocessText.mockReturnValue('John Doe');
      
      mockContentExtractor.extractContent.mockReturnValue({
        profile: { name: { value: 'John Doe', confidence: 0.8 }, links: {} },
        sections: [],
        rawSections: {}
      });

      const buffer = Buffer.from('John Doe');
      const result = await resumeParser.parseResume(buffer, 'resume.unknown');

      expect(result.data.profile.name).toBe('John Doe');
    });
  });
});