import { PDFParserService, PDFExtractionResult, LayoutAnalysis } from './pdf-parser';
import { ContentExtractorService, ExtractionResult } from './content-extractor';
import { ParsedResumeData, ConfidenceScore } from '../types';
import { DatabaseService } from './database';

export interface ResumeParsingResult {
  data: ParsedResumeData;
  confidenceScores: ConfidenceScore[];
  isComplexLayout: boolean;
  layoutAnalysis?: LayoutAnalysis;
  processingTime: number;
  warnings: string[];
}

export interface ParsingOptions {
  enableLayoutDetection?: boolean;
  confidenceThreshold?: number;
  fallbackToManualReview?: boolean;
  saveToDatabase?: boolean;
  sessionId?: string;
  userId?: string;
  databaseService?: DatabaseService;
}

export class ResumeParserService {
  private pdfParser: PDFParserService;
  private contentExtractor: ContentExtractorService;

  constructor() {
    this.pdfParser = new PDFParserService();
    this.contentExtractor = new ContentExtractorService();
  }

  /**
   * Parse resume from buffer with layout-aware processing
   */
  async parseResume(
    buffer: Buffer, 
    filename: string, 
    options: ParsingOptions = {}
  ): Promise<ResumeParsingResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const confidenceScores: ConfidenceScore[] = [];

    try {
      // Determine file type and extract text
      const fileExtension = this.getFileExtension(filename);
      let extractedText: string;
      let isComplexLayout = false;
      let layoutAnalysis: LayoutAnalysis | undefined;

      if (fileExtension === 'pdf') {
        const pdfResult = await this.pdfParser.extractFromBuffer(buffer);
        extractedText = this.pdfParser.preprocessText(pdfResult.fullText);
        
        // Get layout analysis if enabled
        if (options.enableLayoutDetection !== false) {
          layoutAnalysis = pdfResult.layoutAnalysis;
          isComplexLayout = layoutAnalysis ? layoutAnalysis.layoutComplexity !== 'simple' : false;
          
          if (isComplexLayout) {
            warnings.push('Complex layout detected - some information may require manual review');
          }
          
          // Add specific warnings from layout analysis
          if (layoutAnalysis) {
            warnings.push(...layoutAnalysis.userConfirmationNeeded);
          }
        }
      } else {
        // Handle other formats (TXT, DOCX, etc.)
        extractedText = buffer.toString('utf-8');
        extractedText = this.pdfParser.preprocessText(extractedText);
      }

      // Extract structured content with layout awareness
      const extractionOptions = {
        layoutAnalysis: layoutAnalysis ? {
          isMultiColumn: layoutAnalysis.isMultiColumn,
          columnCount: layoutAnalysis.columnCount,
          hasTablesOrBoxes: layoutAnalysis.hasTablesOrBoxes,
          layoutComplexity: layoutAnalysis.layoutComplexity,
          confidenceScore: layoutAnalysis.confidenceScore
        } : undefined,
        fallbackMode: options.fallbackToManualReview && isComplexLayout,
        confidenceThreshold: options.confidenceThreshold || 0.6
      };

      const extractionResult = this.contentExtractor.extractContent(extractedText, extractionOptions);

      // Convert to ParsedResumeData format with confidence scoring
      const parsedData = await this.convertToResumeData(extractionResult, confidenceScores);

      // Apply confidence threshold filtering
      const threshold = options.confidenceThreshold || 0.5;
      this.applyConfidenceFiltering(parsedData, confidenceScores, threshold, warnings);

      const processingTime = Date.now() - startTime;

      const result: ResumeParsingResult = {
        data: parsedData,
        confidenceScores,
        isComplexLayout,
        layoutAnalysis,
        processingTime,
        warnings
      };

      // Save to D1 database if requested
      if (options.saveToDatabase && options.databaseService && options.sessionId && options.userId) {
        await this.saveToDatabase(
          options.databaseService,
          options.sessionId,
          options.userId,
          filename,
          fileExtension,
          parsedData,
          confidenceScores
        );
      }

      return result;

    } catch (error) {
      throw new Error(`Resume parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save parsing results to D1 database
   */
  private async saveToDatabase(
    db: DatabaseService,
    sessionId: string,
    userId: string,
    filename: string,
    fileFormat: string,
    parsedData: ParsedResumeData,
    confidenceScores: ConfidenceScore[]
  ): Promise<void> {
    try {
      // Update or create resume session
      const existingSession = await db.getResumeSession(sessionId);
      
      if (existingSession) {
        // Update existing session
        await db.updateResumeSession(sessionId, {
          processingStatus: 'completed',
          parsedData,
        });
      } else {
        // Create new session
        await db.createResumeSession({
          userId,
          originalFilename: filename,
          fileFormat,
          processingStatus: 'completed',
          parsedData,
        });
      }

      // Save confidence scores as parsing metrics
      if (confidenceScores.length > 0) {
        const metrics = confidenceScores.map(score => ({
          sessionId,
          fieldName: score.field,
          confidenceScore: score.score,
          wasEdited: false,
        }));

        await db.batchCreateParsingMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to save parsing results to database:', error);
      // Don't throw - parsing succeeded even if database save failed
    }
  }

  /**
   * Convert extraction result to ParsedResumeData format
   */
  private async convertToResumeData(
    extraction: ExtractionResult, 
    confidenceScores: ConfidenceScore[]
  ): Promise<ParsedResumeData> {
    const data: ParsedResumeData = {
      profile: {
        name: extraction.profile.name?.value || '',
        title: extraction.profile.title?.value || '',
        location: extraction.profile.location?.value,
        email: extraction.profile.email?.value || '',
        phone: extraction.profile.phone?.value,
        links: {
          github: extraction.profile.links.github?.value,
          linkedin: extraction.profile.links.linkedin?.value,
          website: extraction.profile.links.website?.value,
          portfolio: extraction.profile.links.portfolio?.value,
        }
      },
      summary: '',
      skills: [],
      experience: [],
      projects: [],
      education: [],
      certifications: []
    };

    // Record confidence scores for profile fields with layout-aware adjustments
    if (extraction.profile.name) {
      let adjustedScore = extraction.profile.name.confidence;
      let reason = 'Extracted from document header';
      
      if (extraction.layoutAware.extractionMethod === 'fallback') {
        adjustedScore *= 0.8;
        reason += ' (fallback mode)';
      } else if (extraction.layoutAware.extractionMethod === 'multi-column') {
        adjustedScore *= 0.9;
        reason += ' (multi-column layout)';
      }
      
      confidenceScores.push({
        field: 'profile.name',
        score: adjustedScore,
        reason
      });
    }

    if (extraction.profile.title) {
      let adjustedScore = extraction.profile.title.confidence;
      let reason = 'Identified using title patterns';
      
      if (extraction.layoutAware.extractionMethod === 'fallback') {
        adjustedScore *= 0.8;
        reason += ' (fallback mode)';
      }
      
      confidenceScores.push({
        field: 'profile.title',
        score: adjustedScore,
        reason
      });
    }

    if (extraction.profile.email) {
      confidenceScores.push({
        field: 'profile.email',
        score: extraction.profile.email.confidence,
        reason: 'Validated email format'
      });
    }

    if (extraction.profile.phone) {
      confidenceScores.push({
        field: 'profile.phone',
        score: extraction.profile.phone.confidence,
        reason: 'Normalized phone format'
      });
    }

    // Add overall layout confidence score
    confidenceScores.push({
      field: 'layout.overall',
      score: extraction.layoutAware.overallConfidence,
      reason: `Layout analysis (${extraction.layoutAware.extractionMethod})`
    });

    // Process sections
    await this.processSections(extraction, data, confidenceScores);

    return data;
  }

  /**
   * Process identified sections and extract structured data
   */
  private async processSections(
    extraction: ExtractionResult,
    data: ParsedResumeData,
    confidenceScores: ConfidenceScore[]
  ): Promise<void> {
    for (const section of extraction.sections) {
      const sectionContent = extraction.rawSections[section.name];
      if (!sectionContent) continue;

      switch (section.name) {
        case 'SUMMARY':
          data.summary = this.extractSummary(sectionContent);
          confidenceScores.push({
            field: 'summary',
            score: section.confidence,
            reason: 'Extracted from summary section'
          });
          break;

        case 'SKILLS':
          data.skills = this.extractSkills(sectionContent, confidenceScores);
          break;

        case 'EXPERIENCE':
          data.experience = this.extractExperience(sectionContent, confidenceScores);
          break;

        case 'PROJECTS':
          data.projects = this.extractProjects(sectionContent, confidenceScores);
          break;

        case 'EDUCATION':
          data.education = this.extractEducation(sectionContent, confidenceScores);
          break;

        case 'CERTIFICATIONS':
          data.certifications = this.extractCertifications(sectionContent, confidenceScores);
          break;
      }
    }
  }

  /**
   * Extract summary from section content
   */
  private extractSummary(content: string): string {
    // Remove section header and clean up
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const summaryLines = lines.slice(1); // Skip header line
    return summaryLines.join(' ').trim();
  }

  /**
   * Extract skills with normalization
   */
  private extractSkills(content: string, confidenceScores: ConfidenceScore[]): ParsedResumeData['skills'] {
    const skillsText = content.replace(/SKILLS/gi, '').trim();
    const normalizedSkills = this.contentExtractor.normalizeSkills(skillsText);

    // Group skills by category (simplified categorization)
    const categories = this.categorizeSkills(normalizedSkills);
    
    const skills: ParsedResumeData['skills'] = [];
    for (const [category, items] of Object.entries(categories)) {
      if (items.length > 0) {
        skills.push({
          category,
          items,
          confidence: 0.8 // Base confidence for skills extraction
        });

        confidenceScores.push({
          field: `skills.${category}`,
          score: 0.8,
          reason: 'Normalized using technology dictionary'
        });
      }
    }

    return skills;
  }

  /**
   * Categorize skills into groups
   */
  private categorizeSkills(skills: string[]): { [category: string]: string[] } {
    const categories: { [category: string]: string[] } = {
      'Programming Languages': [],
      'Frameworks & Libraries': [],
      'Databases': [],
      'Cloud & DevOps': [],
      'Tools': []
    };

    const languageSkills = ['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'r', 'matlab'];
    const frameworkSkills = ['react', 'vue', 'angular', 'svelte', 'nodejs', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'fastapi'];
    const databaseSkills = ['mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'firebase', 'sql'];
    const cloudSkills = ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform'];
    const toolSkills = ['git', 'webpack', 'vite', 'npm', 'yarn', 'jest', 'cypress'];

    for (const skill of skills) {
      if (languageSkills.includes(skill)) {
        categories['Programming Languages'].push(skill);
      } else if (frameworkSkills.includes(skill)) {
        categories['Frameworks & Libraries'].push(skill);
      } else if (databaseSkills.includes(skill)) {
        categories['Databases'].push(skill);
      } else if (cloudSkills.includes(skill)) {
        categories['Cloud & DevOps'].push(skill);
      } else if (toolSkills.includes(skill)) {
        categories['Tools'].push(skill);
      } else {
        // Unknown skills go to Tools category
        categories['Tools'].push(skill);
      }
    }

    return categories;
  }

  /**
   * Extract work experience
   */
  private extractExperience(content: string, confidenceScores: ConfidenceScore[]): ParsedResumeData['experience'] {
    const experience: ParsedResumeData['experience'] = [];
    
    // Simple pattern-based extraction (can be enhanced)
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let currentJob: Partial<ParsedResumeData['experience'][0]> | null = null;

    for (const line of lines) {
      if (line.match(/EXPERIENCE/i)) continue; // Skip header

      // Look for job title patterns
      if (line.match(/\b(Engineer|Developer|Manager|Analyst|Scientist|Architect|Lead|Director|VP|CTO)\b/i)) {
        if (currentJob) {
          experience.push(currentJob as ParsedResumeData['experience'][0]);
        }
        
        currentJob = {
          company: '',
          role: line,
          startDate: new Date(),
          bullets: [],
          techStack: [],
          confidence: 0.6
        };
      } else if (currentJob && line.match(/^\s*•|^\s*-|^\s*\*/)) {
        // Bullet point
        const bullet = line.replace(/^\s*[•\-\*]\s*/, '');
        currentJob.bullets = currentJob.bullets || [];
        currentJob.bullets.push(bullet);
      }
    }

    if (currentJob) {
      experience.push(currentJob as ParsedResumeData['experience'][0]);
    }

    // Add confidence scores
    experience.forEach((job, index) => {
      confidenceScores.push({
        field: `experience.${index}`,
        score: job.confidence,
        reason: 'Extracted using pattern matching'
      });
    });

    return experience;
  }

  /**
   * Extract projects
   */
  private extractProjects(content: string, confidenceScores: ConfidenceScore[]): ParsedResumeData['projects'] {
    const projects: ParsedResumeData['projects'] = [];
    
    // Basic project extraction (can be enhanced)
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of lines) {
      if (line.match(/PROJECTS/i)) continue; // Skip header
      
      if (line.length > 10 && !line.startsWith('•') && !line.startsWith('-')) {
        projects.push({
          name: line,
          description: '',
          links: {},
          techStack: [],
          confidence: 0.5
        });
      }
    }

    // Add confidence scores
    projects.forEach((project, index) => {
      confidenceScores.push({
        field: `projects.${index}`,
        score: project.confidence,
        reason: 'Basic pattern extraction'
      });
    });

    return projects;
  }

  /**
   * Extract education
   */
  private extractEducation(content: string, confidenceScores: ConfidenceScore[]): ParsedResumeData['education'] {
    const education: ParsedResumeData['education'] = [];
    
    // Basic education extraction
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of lines) {
      if (line.match(/EDUCATION/i)) continue; // Skip header
      
      if (line.match(/\b(Bachelor|Master|PhD|Doctorate|Associate|Certificate)\b/i)) {
        education.push({
          degree: line,
          institution: '',
          startDate: new Date(),
          confidence: 0.7
        });
      }
    }

    // Add confidence scores
    education.forEach((edu, index) => {
      confidenceScores.push({
        field: `education.${index}`,
        score: edu.confidence,
        reason: 'Degree pattern matching'
      });
    });

    return education;
  }

  /**
   * Extract certifications
   */
  private extractCertifications(content: string, confidenceScores: ConfidenceScore[]): ParsedResumeData['certifications'] {
    const certifications: ParsedResumeData['certifications'] = [];
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of lines) {
      if (line.match(/CERTIFICATIONS?/i)) continue; // Skip header
      
      if (line.length > 5) {
        certifications.push({
          name: line,
          issuer: '',
          date: new Date()
        });
      }
    }

    return certifications;
  }

  /**
   * Apply confidence filtering and add warnings for low-confidence fields
   */
  private applyConfidenceFiltering(
    data: ParsedResumeData,
    confidenceScores: ConfidenceScore[],
    threshold: number,
    warnings: string[]
  ): void {
    const lowConfidenceFields = confidenceScores.filter(score => score.score < threshold);
    
    if (lowConfidenceFields.length > 0) {
      warnings.push(`${lowConfidenceFields.length} fields have low confidence and may need review`);
      
      // Add specific warnings for critical fields
      const criticalFields = lowConfidenceFields.filter(field => 
        field.field.includes('profile.name') || 
        field.field.includes('profile.email') ||
        field.field.includes('experience')
      );
      
      if (criticalFields.length > 0) {
        warnings.push('Critical profile information has low confidence - manual review recommended');
      }

      // Add layout-specific warnings
      const layoutFields = lowConfidenceFields.filter(field => field.field.includes('layout.'));
      if (layoutFields.length > 0) {
        warnings.push('Document layout complexity may affect extraction accuracy');
      }
    }

    // Add fallback mode warnings
    const fallbackFields = confidenceScores.filter(score => 
      score.reason.includes('fallback mode')
    );
    if (fallbackFields.length > 0) {
      warnings.push('Fallback extraction mode used - please verify all extracted information');
    }

    // Add multi-column warnings
    const multiColumnFields = confidenceScores.filter(score => 
      score.reason.includes('multi-column')
    );
    if (multiColumnFields.length > 0) {
      warnings.push('Multi-column layout detected - text order and section boundaries should be verified');
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Validate parsed resume data
   */
  validateResumeData(data: ParsedResumeData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!data.profile.name) {
      errors.push('Name is required');
    }

    if (!data.profile.email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.profile.email)) {
      errors.push('Invalid email format');
    }

    // Data quality checks
    if (data.experience.length === 0 && data.projects.length === 0) {
      errors.push('No work experience or projects found');
    }

    if (data.skills.length === 0) {
      errors.push('No skills identified');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}