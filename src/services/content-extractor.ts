
export interface ExtractedField {
  value: string;
  confidence: number;
  position?: { start: number; end: number };
}

export interface SectionBoundary {
  name: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface LayoutAwareExtractionOptions {
  layoutAnalysis?: {
    isMultiColumn: boolean;
    columnCount: number;
    hasTablesOrBoxes: boolean;
    layoutComplexity: 'simple' | 'moderate' | 'complex';
    confidenceScore: number;
  };
  fallbackMode?: boolean;
  confidenceThreshold?: number;
}

export interface ExtractionResult {
  profile: {
    name?: ExtractedField;
    title?: ExtractedField;
    location?: ExtractedField;
    email?: ExtractedField;
    phone?: ExtractedField;
    links: {
      github?: ExtractedField;
      linkedin?: ExtractedField;
      website?: ExtractedField;
      portfolio?: ExtractedField;
    };
  };
  sections: SectionBoundary[];
  rawSections: { [key: string]: string };
  layoutAware: {
    extractionMethod: 'standard' | 'multi-column' | 'fallback';
    overallConfidence: number;
    requiresUserReview: boolean;
    reviewReasons: string[];
  };
}

export class ContentExtractorService {
  // Regex patterns for field extraction
  private readonly patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    github: /(?:(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_-]+)(?:\s|$)|(?:GitHub:\s*)?@([A-Za-z0-9_-]+)(?:\s+on\s+GitHub|\s|$)|Find\s+me\s+@([A-Za-z0-9_-]+)\s+on\s+GitHub)/gi,
    linkedin: /(?:linkedin\.com\/in\/|linkedin\.com\/pub\/|linkedin\.com\/profile\/view\?id=)([A-Za-z0-9_-]+)/gi,
    website: /(?:https?:\/\/)?(?:www\.)?([A-Za-z0-9_-]+\.(?:portfolio\.com|com|org|net|edu|gov|io|co|dev|me|tech|app|site|blog|portfolio|xyz|online|digital|studio|design|works|codes|build))\b/gi,
    date: /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:\d{1,2}[,\s]+)?\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b/gi,
    gpa: /\b(?:GPA|G\.P\.A\.?)\s*:?\s*(\d+\.?\d*)\s*(?:\/\s*(\d+\.?\d*))?\b/gi,
  };

  // Section header patterns
  private readonly sectionPatterns = [
    { name: 'EXPERIENCE', patterns: [/\b(?:EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT|PROFESSIONAL\s+EXPERIENCE|CAREER\s+HISTORY)\b/gi] },
    { name: 'EDUCATION', patterns: [/\b(?:EDUCATION|ACADEMIC\s+BACKGROUND|QUALIFICATIONS|DEGREES?)\b/gi] },
    { name: 'SKILLS', patterns: [/\b(?:SKILLS|TECHNICAL\s+SKILLS|CORE\s+COMPETENCIES|TECHNOLOGIES|EXPERTISE)\b/gi] },
    { name: 'PROJECTS', patterns: [/\b(?:PROJECTS|PERSONAL\s+PROJECTS|KEY\s+PROJECTS|PORTFOLIO|SELECTED\s+PROJECTS)\b/gi] },
    { name: 'CONTACT', patterns: [/\b(?:CONTACT|CONTACT\s+INFORMATION|PERSONAL\s+INFORMATION)\b/gi] },
    { name: 'SUMMARY', patterns: [/\b(?:SUMMARY|PROFESSIONAL\s+SUMMARY|PROFILE|OBJECTIVE|ABOUT\s+ME)\b/gi] },
    { name: 'CERTIFICATIONS', patterns: [/\b(?:CERTIFICATIONS?|CERTIFICATES?|LICENSES?|CREDENTIALS?)\b/gi] },
    { name: 'AWARDS', patterns: [/\b(?:AWARDS?|HONORS?|ACHIEVEMENTS?|RECOGNITION)\b/gi] },
  ];

  // Technology dictionary for skills normalization
  private readonly techDictionary = {
    // Programming Languages
    'javascript': ['js', 'javascript', 'ecmascript', 'es6', 'es2015', 'es2020'],
    'typescript': ['ts', 'typescript'],
    'python': ['python', 'py', 'python3'],
    'java': ['java', 'openjdk'],
    'csharp': ['c#', 'csharp', 'c-sharp', '.net'],
    'cpp': ['c++', 'cpp', 'cplusplus'],
    'c': ['c'],
    'go': ['go', 'golang'],
    'rust': ['rust'],
    'php': ['php'],
    'ruby': ['ruby', 'rb'],
    'swift': ['swift'],
    'kotlin': ['kotlin'],
    'scala': ['scala'],
    'r': ['r'],
    'matlab': ['matlab'],
    'sql': ['sql', 'sqlite', 'mssql'],

    // Frontend Frameworks/Libraries
    'react': ['react', 'reactjs', 'react.js'],
    'vue': ['vue', 'vuejs', 'vue.js'],
    'angular': ['angular', 'angularjs'],
    'svelte': ['svelte'],
    'jquery': ['jquery'],
    'bootstrap': ['bootstrap'],
    'tailwind': ['tailwind', 'tailwindcss'],

    // Backend Frameworks
    'nodejs': ['node', 'nodejs', 'node.js'],
    'express': ['express', 'expressjs'],
    'django': ['django'],
    'flask': ['flask'],
    'spring': ['spring', 'spring boot', 'springboot'],
    'laravel': ['laravel'],
    'rails': ['rails', 'ruby on rails'],
    'fastapi': ['fastapi'],

    // Databases
    'mongodb': ['mongodb', 'mongo'],
    'postgresql': ['postgresql', 'postgres', 'psql'],
    'mysql': ['mysql'],
    'redis': ['redis'],
    'elasticsearch': ['elasticsearch', 'elastic'],
    'firebase': ['firebase'],

    // Cloud/DevOps
    'aws': ['aws', 'amazon web services'],
    'azure': ['azure', 'microsoft azure'],
    'gcp': ['gcp', 'google cloud', 'google cloud platform'],
    'docker': ['docker'],
    'kubernetes': ['kubernetes', 'k8s'],
    'jenkins': ['jenkins'],
    'terraform': ['terraform'],

    // Tools
    'git': ['git', 'github', 'gitlab'],
    'webpack': ['webpack'],
    'vite': ['vite'],
    'npm': ['npm'],
    'yarn': ['yarn'],
    'jest': ['jest'],
    'cypress': ['cypress'],
  };

  /**
   * Extract structured data from resume text with layout awareness
   */
  extractContent(text: string, options: LayoutAwareExtractionOptions = {}): ExtractionResult {
    const result: ExtractionResult = {
      profile: {
        links: {}
      },
      sections: [],
      rawSections: {},
      layoutAware: {
        extractionMethod: 'standard',
        overallConfidence: 0.8,
        requiresUserReview: false,
        reviewReasons: []
      }
    };

    // Determine extraction method based on layout complexity
    const layoutAnalysis = options.layoutAnalysis;
    if (layoutAnalysis) {
      if (layoutAnalysis.isMultiColumn) {
        result.layoutAware.extractionMethod = 'multi-column';
        text = this.preprocessMultiColumnText(text);
      } else if (layoutAnalysis.layoutComplexity === 'complex' || options.fallbackMode) {
        result.layoutAware.extractionMethod = 'fallback';
      }
    }

    // Extract contact information with enhanced confidence scoring
    result.profile.email = this.extractEmail(text);
    result.profile.phone = this.extractPhone(text);
    result.profile.links.github = this.extractGitHub(text);
    result.profile.links.linkedin = this.extractLinkedIn(text);
    result.profile.links.website = this.extractWebsite(text);

    // Extract name and title (heuristic-based)
    result.profile.name = this.extractName(text);
    result.profile.title = this.extractTitle(text);
    result.profile.location = this.extractLocation(text);

    // Identify sections with layout-aware processing
    result.sections = this.identifySections(text, options);
    result.rawSections = this.extractSectionContent(text, result.sections);

    // Calculate overall confidence and determine if user review is needed
    this.calculateOverallConfidence(result, options);

    return result;
  }

  /**
   * Extract dates from text using various formats
   */
  extractDates(text: string): ExtractedField[] {
    const matches = Array.from(text.matchAll(this.patterns.date));
    return matches.map(match => ({
      value: match[0],
      confidence: 0.7,
      position: { start: match.index!, end: match.index! + match[0].length }
    }));
  }

  /**
   * Extract GPA information from education sections
   */
  extractGPA(text: string): ExtractedField | undefined {
    const matches = Array.from(text.matchAll(this.patterns.gpa));
    if (matches.length === 0) return undefined;

    const match = matches[0];
    const gpa = match[1];
    const scale = match[2];

    // If scale is provided, use the full format, otherwise just the GPA
    const value = scale ? `${gpa}/${scale}` : gpa;

    return {
      value,
      confidence: 0.8,
      position: { start: match.index!, end: match.index! + match[0].length }
    };
  }

  /**
   * Classify section content type based on keywords and patterns
   */
  classifySectionContent(sectionName: string, content: string): {
    type: 'experience' | 'education' | 'skills' | 'projects' | 'summary' | 'contact' | 'certifications' | 'unknown';
    confidence: number;
  } {
    const lowerContent = content.toLowerCase();
    const lowerSection = sectionName.toLowerCase();

    // Experience indicators
    const experienceKeywords = ['company', 'role', 'position', 'responsibilities', 'achievements', 'worked', 'developed', 'managed', 'led'];
    const experienceScore = experienceKeywords.filter(keyword => lowerContent.includes(keyword)).length;

    // Education indicators  
    const educationKeywords = ['university', 'college', 'degree', 'bachelor', 'master', 'phd', 'gpa', 'graduated', 'major'];
    const educationScore = educationKeywords.filter(keyword => lowerContent.includes(keyword)).length;

    // Skills indicators
    const skillsKeywords = ['javascript', 'python', 'react', 'programming', 'languages', 'frameworks', 'technologies'];
    const skillsScore = skillsKeywords.filter(keyword => lowerContent.includes(keyword)).length;

    // Projects indicators
    const projectsKeywords = ['project', 'built', 'created', 'developed', 'github', 'repository', 'demo', 'portfolio'];
    const projectsScore = projectsKeywords.filter(keyword => lowerContent.includes(keyword)).length;

    // Determine type based on section name first, then content
    if (lowerSection.includes('experience') || lowerSection.includes('work') || lowerSection.includes('employment')) {
      return { type: 'experience', confidence: 0.9 };
    } else if (lowerSection.includes('education') || lowerSection.includes('academic')) {
      return { type: 'education', confidence: 0.9 };
    } else if (lowerSection.includes('skill') || lowerSection.includes('technical') || lowerSection.includes('competenc')) {
      return { type: 'skills', confidence: 0.9 };
    } else if (lowerSection.includes('project')) {
      return { type: 'projects', confidence: 0.9 };
    } else if (lowerSection.includes('summary') || lowerSection.includes('profile') || lowerSection.includes('objective')) {
      return { type: 'summary', confidence: 0.9 };
    } else if (lowerSection.includes('contact') || lowerSection.includes('personal')) {
      return { type: 'contact', confidence: 0.9 };
    } else if (lowerSection.includes('certification') || lowerSection.includes('license')) {
      return { type: 'certifications', confidence: 0.9 };
    }

    // Fallback to content analysis
    const scores = {
      experience: experienceScore,
      education: educationScore,
      skills: skillsScore,
      projects: projectsScore
    };

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      return { type: 'unknown', confidence: 0.1 };
    }

    const bestType = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as any;
    return { type: bestType, confidence: Math.min(0.7, maxScore * 0.2) };
  }

  /**
   * Extract email address with confidence scoring
   */
  private extractEmail(text: string): ExtractedField | undefined {
    const matches = Array.from(text.matchAll(this.patterns.email));
    if (matches.length === 0) return undefined;

    // Prefer emails that look more professional
    const scored = matches.map(match => {
      const email = match[0];
      let confidence = 0.5;

      // Boost confidence for professional domains (custom domains)
      if (!email.includes('@gmail.') && !email.includes('@yahoo.') &&
        !email.includes('@hotmail.') && !email.includes('@outlook.')) {
        confidence += 0.3;
      }

      // Boost confidence for common personal domains
      if (email.includes('@gmail.com') || email.includes('@outlook.com') ||
        email.includes('@yahoo.com') || email.includes('@hotmail.com')) {
        confidence += 0.25;
      }

      // Penalize if it looks like a placeholder
      if (email.includes('example') || email.includes('test') || email.includes('sample')) {
        confidence -= 0.5;
      }

      return {
        value: email,
        confidence: Math.min(Math.max(confidence, 0), 1.0),
        position: { start: match.index!, end: match.index! + match[0].length }
      };
    });

    // Return the highest confidence email
    return scored.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Extract phone number with confidence scoring
   */
  private extractPhone(text: string): ExtractedField | undefined {
    const matches = Array.from(text.matchAll(this.patterns.phone));
    if (matches.length === 0) return undefined;

    const phone = matches[0];
    const formatted = `${phone[1]}-${phone[2]}-${phone[3]}`;

    return {
      value: formatted,
      confidence: 0.8,
      position: { start: phone.index!, end: phone.index! + phone[0].length }
    };
  }

  /**
   * Extract GitHub profile
   */
  private extractGitHub(text: string): ExtractedField | undefined {
    const matches = Array.from(text.matchAll(this.patterns.github));
    if (matches.length === 0) return undefined;

    // Get username from any of the capture groups
    const username = matches[0][1] || matches[0][2] || matches[0][3];
    if (!username) return undefined;

    // Validate username format (GitHub usernames can contain alphanumeric chars and hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return undefined;

    return {
      value: `https://github.com/${username}`,
      confidence: 0.9,
      position: { start: matches[0].index!, end: matches[0].index! + matches[0][0].length }
    };
  }

  /**
   * Extract LinkedIn profile
   */
  private extractLinkedIn(text: string): ExtractedField | undefined {
    const matches = Array.from(text.matchAll(this.patterns.linkedin));
    if (matches.length === 0) return undefined;

    const username = matches[0][1];
    return {
      value: `https://linkedin.com/in/${username}`,
      confidence: 0.9,
      position: { start: matches[0].index!, end: matches[0].index! + matches[0][0].length }
    };
  }

  /**
   * Extract website/portfolio URL
   */
  private extractWebsite(text: string): ExtractedField | undefined {
    const matches = Array.from(text.matchAll(this.patterns.website));
    if (matches.length === 0) return undefined;

    // Filter out common social media and email domains
    const filtered = matches.filter(match => {
      const domain = match[1].toLowerCase();
      return !domain.includes('github.') &&
        !domain.includes('linkedin.') &&
        !domain.includes('gmail.') &&
        !domain.includes('yahoo.') &&
        !domain.includes('outlook.');
    });

    if (filtered.length === 0) return undefined;

    const domain = filtered[0][1];
    const fullMatch = filtered[0][0];

    // If the original match already has protocol, use it as-is
    const finalUrl = fullMatch.startsWith('http') ? fullMatch : `https://${domain}`;

    return {
      value: finalUrl,
      confidence: 0.7,
      position: { start: filtered[0].index!, end: filtered[0].index! + filtered[0][0].length }
    };
  }

  /**
   * Extract name using heuristics
   */
  private extractName(text: string): ExtractedField | undefined {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Look for name in first few lines
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i];

      // Skip lines that look like headers or contact info
      if (this.isContactLine(line) || this.isSectionHeader(line)) continue;

      // Look for patterns that suggest a name
      const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*\s+[A-Z][a-z]+)$/;
      const match = line.match(namePattern);

      if (match) {
        return {
          value: match[1],
          confidence: 0.8,
          position: { start: 0, end: match[1].length }
        };
      }
    }

    return undefined;
  }

  /**
   * Extract job title using heuristics
   */
  private extractTitle(text: string): ExtractedField | undefined {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Common title patterns
    const titlePatterns = [
      /\b(?:Senior|Junior|Lead|Principal|Staff|Associate)?\s*(?:Software|Full[- ]?Stack|Front[- ]?End|Back[- ]?End|Web|Mobile|Data|DevOps|Machine Learning|AI|Cloud)\s*(?:Engineer|Developer|Architect|Scientist|Analyst|Specialist)\b/gi,
      /\b(?:Product|Project|Engineering|Technical|Development)\s*(?:Manager|Lead)\b/gi,
      /\b(?:CTO|VP|Director)\s*(?:of\s+)?(?:Engineering|Technology|Development)?\b/gi,
      /\b(?:Technical|Team|Engineering)\s*Lead\b/gi,
    ];

    for (const line of lines.slice(0, 5)) {
      if (this.isContactLine(line) || this.isSectionHeader(line)) continue;

      for (const pattern of titlePatterns) {
        pattern.lastIndex = 0; // Reset regex state
        const match = pattern.exec(line);
        if (match) {
          return {
            value: match[0],
            confidence: 0.7,
            position: { start: 0, end: match[0].length }
          };
        }
      }
    }

    return undefined;
  }

  /**
   * Extract location using heuristics
   */
  private extractLocation(text: string): ExtractedField | undefined {
    // Look for city, state patterns on individual lines
    const lines = text.split('\n');
    const locationPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)$/;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const match = trimmedLine.match(locationPattern);
      if (match) {
        return {
          value: match[0],
          confidence: 0.6,
          position: { start: 0, end: match[0].length }
        };
      }
    }

    return undefined;
  }

  /**
   * Preprocess multi-column text to improve extraction
   */
  private preprocessMultiColumnText(text: string): string {
    // Split text into lines and try to reorder based on likely reading flow
    const lines = text.split('\n');
    const processedLines: string[] = [];

    // Simple heuristic: if a line is very short and the next line starts far to the right,
    // it might be a continuation from another column
    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i].trim();
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';

      // If current line is short and next line looks like it might be from another column
      if (currentLine.length < 50 && nextLine.length > 0 &&
        !this.isSectionHeader(currentLine) && !this.isSectionHeader(nextLine)) {
        // Try to merge with next line if it makes sense
        if (this.shouldMergeLines(currentLine, nextLine)) {
          processedLines.push(currentLine + ' ' + nextLine);
          i++; // Skip next line since we merged it
          continue;
        }
      }

      processedLines.push(currentLine);
    }

    return processedLines.join('\n');
  }

  /**
   * Determine if two lines should be merged (likely from different columns)
   */
  private shouldMergeLines(line1: string, line2: string): boolean {
    // Don't merge if either line looks like a section header
    if (this.isSectionHeader(line1) || this.isSectionHeader(line2)) {
      return false;
    }

    // Don't merge if either line contains contact information
    if (this.isContactLine(line1) || this.isContactLine(line2)) {
      return false;
    }

    // Don't merge if lines seem to be separate bullet points
    if ((line1.includes('•') || line1.includes('-')) &&
      (line2.includes('•') || line2.includes('-'))) {
      return false;
    }

    // Merge if first line ends without punctuation and second line starts with lowercase
    if (!line1.match(/[.!?]$/) && line2.match(/^[a-z]/)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate overall confidence and determine review requirements
   */
  private calculateOverallConfidence(result: ExtractionResult, options: LayoutAwareExtractionOptions): void {
    const confidenceScores: number[] = [];
    const reviewReasons: string[] = [];
    const threshold = options.confidenceThreshold || 0.6;

    // Collect confidence scores from profile fields
    if (result.profile.name) confidenceScores.push(result.profile.name.confidence);
    if (result.profile.title) confidenceScores.push(result.profile.title.confidence);
    if (result.profile.email) confidenceScores.push(result.profile.email.confidence);
    if (result.profile.phone) confidenceScores.push(result.profile.phone.confidence);
    if (result.profile.location) confidenceScores.push(result.profile.location.confidence);

    // Collect confidence scores from sections
    result.sections.forEach(section => {
      confidenceScores.push(section.confidence);
    });

    // Calculate overall confidence
    const overallConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0.5;

    // Adjust confidence based on layout complexity
    let adjustedConfidence = overallConfidence;
    if (options.layoutAnalysis) {
      const layoutConfidence = options.layoutAnalysis.confidenceScore;
      adjustedConfidence = (overallConfidence + layoutConfidence) / 2;

      if (options.layoutAnalysis.isMultiColumn) {
        reviewReasons.push('Multi-column layout detected - text order may need verification');
      }
      if (options.layoutAnalysis.hasTablesOrBoxes) {
        reviewReasons.push('Tables or text boxes detected - structure may need manual review');
      }
      if (options.layoutAnalysis.layoutComplexity === 'complex') {
        reviewReasons.push('Complex layout detected - extraction accuracy may be reduced');
      }
    }

    // Check for missing critical information
    if (!result.profile.name || result.profile.name.confidence < threshold) {
      reviewReasons.push('Name extraction has low confidence or failed');
    }
    if (!result.profile.email || result.profile.email.confidence < threshold) {
      reviewReasons.push('Email extraction has low confidence or failed');
    }
    if (result.sections.length < 2) {
      reviewReasons.push('Few sections identified - document structure may be unclear');
    }

    // Check for low confidence sections
    const lowConfidenceSections = result.sections.filter(section => section.confidence < threshold);
    if (lowConfidenceSections.length > 0) {
      reviewReasons.push(`${lowConfidenceSections.length} sections have low confidence scores`);
    }

    result.layoutAware.overallConfidence = adjustedConfidence;
    result.layoutAware.requiresUserReview = adjustedConfidence < threshold || reviewReasons.length > 0;
    result.layoutAware.reviewReasons = reviewReasons;
  }

  /**
   * Identify section boundaries in the text with layout awareness
   */
  private identifySections(text: string, options: LayoutAwareExtractionOptions = {}): SectionBoundary[] {
    const sections: SectionBoundary[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      for (const sectionDef of this.sectionPatterns) {
        for (const pattern of sectionDef.patterns) {
          if (pattern.test(line)) {
            const startIndex = text.indexOf(line);

            // Adjust confidence based on layout complexity
            let confidence = 0.8;
            if (options.layoutAnalysis) {
              if (options.layoutAnalysis.layoutComplexity === 'complex') {
                confidence = 0.6;
              } else if (options.layoutAnalysis.layoutComplexity === 'moderate') {
                confidence = 0.7;
              }

              // Boost confidence if section header is clearly formatted
              if (line.toUpperCase() === line && line.length > 3) {
                confidence += 0.1;
              }
            }

            sections.push({
              name: sectionDef.name,
              startIndex,
              endIndex: -1, // Will be set later
              confidence: Math.min(confidence, 1.0)
            });
            break;
          }
        }
      }
    }

    // Enhanced section boundary detection for complex layouts
    if (options.layoutAnalysis?.isMultiColumn || options.layoutAnalysis?.hasTablesOrBoxes) {
      this.refineMultiColumnSections(sections, text);
    }

    // Set end indices
    for (let i = 0; i < sections.length; i++) {
      if (i < sections.length - 1) {
        sections[i].endIndex = sections[i + 1].startIndex;
      } else {
        sections[i].endIndex = text.length;
      }
    }

    return sections;
  }

  /**
   * Extract content for each identified section
   */
  private extractSectionContent(text: string, sections: SectionBoundary[]): { [key: string]: string } {
    const result: { [key: string]: string } = {};

    for (const section of sections) {
      const content = text.substring(section.startIndex, section.endIndex).trim();
      result[section.name] = content;
    }

    return result;
  }

  /**
   * Normalize skills using technology dictionary
   */
  normalizeSkills(skillsText: string): string[] {
    const skills = skillsText
      .toLowerCase()
      .split(/[,\n\r\t•·\-\|\/]/)
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0);

    const normalized: Set<string> = new Set();

    for (const skill of skills) {
      let found = false;

      // Check against technology dictionary
      // First try exact matches, then partial matches
      let bestMatch: { canonical: string; matchLength: number } | null = null;

      for (const [canonical, variants] of Object.entries(this.techDictionary)) {
        for (const variant of variants) {
          const lowerVariant = variant.toLowerCase();
          if (skill === lowerVariant) {
            // Exact match - use this immediately
            normalized.add(canonical);
            found = true;
            break;
          } else if (skill.includes(lowerVariant) && lowerVariant.length >= 3) {
            // Partial match - keep track of the longest match (minimum 3 chars to avoid false positives)
            if (!bestMatch || lowerVariant.length > bestMatch.matchLength) {
              bestMatch = { canonical, matchLength: lowerVariant.length };
            }
          }
        }
        if (found) break;
      }

      // If no exact match but we have a partial match, use the best one
      if (!found && bestMatch) {
        normalized.add(bestMatch.canonical);
        found = true;
      }

      // If not found in dictionary, add as-is if it looks like a technology
      if (!found && this.looksLikeTechnology(skill)) {
        normalized.add(skill);
      }
    }

    return Array.from(normalized);
  }

  /**
   * Check if a string looks like a technology/skill
   */
  private looksLikeTechnology(text: string): boolean {
    // Must be reasonable length
    if (text.length < 2 || text.length > 30) return false;

    // Should contain mostly alphanumeric characters
    if (!/^[a-zA-Z0-9\s\.\-\+#]+$/.test(text)) return false;

    // Exclude common non-technical words
    const excludeWords = ['and', 'or', 'the', 'with', 'for', 'in', 'on', 'at', 'to', 'from', 'by'];
    if (excludeWords.includes(text.toLowerCase())) return false;

    return true;
  }

  /**
   * Check if a line contains contact information
   */
  private isContactLine(line: string): boolean {
    return this.patterns.email.test(line) ||
      this.patterns.phone.test(line) ||
      this.patterns.github.test(line) ||
      this.patterns.linkedin.test(line);
  }

  /**
   * Refine section boundaries for multi-column layouts
   */
  private refineMultiColumnSections(sections: SectionBoundary[], text: string): void {
    // For multi-column layouts, we might have missed some sections or
    // incorrectly identified section boundaries. This method attempts to
    // refine the detection by looking for additional patterns.

    const lines = text.split('\n');
    const additionalSections: SectionBoundary[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for lines that might be section headers but weren't caught
      // by the main patterns (common in complex layouts)
      if (this.looksLikeSectionHeader(line) &&
        !sections.some(section => Math.abs(section.startIndex - text.indexOf(line)) < 10)) {

        const sectionName = this.inferSectionName(line);
        if (sectionName) {
          additionalSections.push({
            name: sectionName,
            startIndex: text.indexOf(line),
            endIndex: -1,
            confidence: 0.5 // Lower confidence for inferred sections
          });
        }
      }
    }

    // Add additional sections and re-sort
    sections.push(...additionalSections);
    sections.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Check if a line looks like a section header using heuristics
   */
  private looksLikeSectionHeader(line: string): boolean {
    // Must be reasonably short
    if (line.length > 50 || line.length < 3) return false;

    // Should not contain common text patterns
    if (line.includes('@') || line.includes('http') || line.includes('•')) return false;

    // Should be mostly uppercase or title case
    const uppercaseRatio = (line.match(/[A-Z]/g) || []).length / line.length;
    if (uppercaseRatio > 0.5) return true;

    // Check for title case (first letter of each word capitalized)
    const words = line.split(/\s+/);
    const titleCaseWords = words.filter(word => word.length > 0 && word[0] === word[0].toUpperCase());
    if (titleCaseWords.length === words.length && words.length <= 4) return true;

    return false;
  }

  /**
   * Infer section name from a potential header line
   */
  private inferSectionName(line: string): string | null {
    const upperLine = line.toUpperCase();

    // Map common variations to standard section names
    const sectionMappings: { [key: string]: string } = {
      'WORK': 'EXPERIENCE',
      'EMPLOYMENT': 'EXPERIENCE',
      'CAREER': 'EXPERIENCE',
      'PROFESSIONAL': 'EXPERIENCE',
      'JOBS': 'EXPERIENCE',
      'ACADEMIC': 'EDUCATION',
      'SCHOOL': 'EDUCATION',
      'UNIVERSITY': 'EDUCATION',
      'COLLEGE': 'EDUCATION',
      'TECHNICAL': 'SKILLS',
      'TECHNOLOGIES': 'SKILLS',
      'COMPETENCIES': 'SKILLS',
      'ABILITIES': 'SKILLS',
      'PERSONAL': 'PROJECTS',
      'PORTFOLIO': 'PROJECTS',
      'WORK SAMPLES': 'PROJECTS',
      'ACHIEVEMENTS': 'PROJECTS',
      'CONTACT INFO': 'CONTACT',
      'PERSONAL INFO': 'CONTACT',
      'ABOUT': 'SUMMARY',
      'PROFILE': 'SUMMARY',
      'OBJECTIVE': 'SUMMARY',
      'LICENSES': 'CERTIFICATIONS',
      'CREDENTIALS': 'CERTIFICATIONS'
    };

    // Check for exact matches first
    for (const [key, value] of Object.entries(sectionMappings)) {
      if (upperLine.includes(key)) {
        return value;
      }
    }

    // Check against standard section names
    const standardSections = ['EXPERIENCE', 'EDUCATION', 'SKILLS', 'PROJECTS', 'CONTACT', 'SUMMARY', 'CERTIFICATIONS'];
    for (const section of standardSections) {
      if (upperLine.includes(section)) {
        return section;
      }
    }

    return null;
  }

  /**
   * Check if a line is a section header
   */
  private isSectionHeader(line: string): boolean {
    return this.sectionPatterns.some(section =>
      section.patterns.some(pattern => pattern.test(line))
    );
  }
}