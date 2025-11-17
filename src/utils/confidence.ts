import { ParsedResumeData, ConfidenceScore } from '../types';
import { validateEmail, validatePhone, validateURL } from './validation';

/**
 * Calculate confidence scores for parsed resume data
 */
export class ConfidenceScorer {
  
  /**
   * Calculate overall confidence score for parsed resume data
   */
  static calculateOverallConfidence(data: ParsedResumeData): number {
    const scores = this.getAllConfidenceScores(data);
    if (scores.length === 0) return 0;
    
    const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
    return totalScore / scores.length;
  }
  
  /**
   * Get detailed confidence scores for all fields
   */
  static getAllConfidenceScores(data: ParsedResumeData): ConfidenceScore[] {
    const scores: ConfidenceScore[] = [];
    
    // Profile confidence scores
    scores.push(...this.calculateProfileConfidence(data.profile));
    
    // Summary confidence
    scores.push(this.calculateSummaryConfidence(data.summary));
    
    // Skills confidence
    data.skills.forEach((skillCategory, index) => {
      scores.push({
        field: `skills.${index}`,
        score: skillCategory.confidence,
        reason: this.getSkillsConfidenceReason(skillCategory)
      });
    });
    
    // Experience confidence
    data.experience.forEach((exp, index) => {
      scores.push({
        field: `experience.${index}`,
        score: exp.confidence,
        reason: this.getExperienceConfidenceReason(exp)
      });
    });
    
    // Projects confidence
    data.projects.forEach((project, index) => {
      scores.push({
        field: `projects.${index}`,
        score: project.confidence,
        reason: this.getProjectConfidenceReason(project)
      });
    });
    
    // Education confidence
    data.education.forEach((edu, index) => {
      scores.push({
        field: `education.${index}`,
        score: edu.confidence,
        reason: this.getEducationConfidenceReason(edu)
      });
    });
    
    return scores;
  }
  
  /**
   * Calculate confidence scores for profile section
   */
  private static calculateProfileConfidence(profile: ParsedResumeData['profile']): ConfidenceScore[] {
    const scores: ConfidenceScore[] = [];
    
    // Name confidence
    scores.push({
      field: 'profile.name',
      score: this.calculateNameConfidence(profile.name),
      reason: this.getNameConfidenceReason(profile.name)
    });
    
    // Email confidence
    const emailValidation = validateEmail(profile.email);
    scores.push({
      field: 'profile.email',
      score: emailValidation.confidence,
      reason: emailValidation.reason
    });
    
    // Phone confidence (if provided)
    if (profile.phone) {
      const phoneValidation = validatePhone(profile.phone);
      scores.push({
        field: 'profile.phone',
        score: phoneValidation.confidence,
        reason: phoneValidation.reason
      });
    }
    
    // Links confidence
    if (profile.links) {
      Object.entries(profile.links).forEach(([key, url]) => {
        if (url) {
          const urlValidation = validateURL(url);
          scores.push({
            field: `profile.links.${key}`,
            score: urlValidation.confidence,
            reason: urlValidation.reason
          });
        }
      });
    }
    
    return scores;
  }
  
  /**
   * Calculate confidence for name field
   */
  private static calculateNameConfidence(name: string): number {
    if (!name || name.trim().length === 0) return 0;
    
    let confidence = 0.5; // Base confidence
    
    // Check if it looks like a real name (has at least 2 parts)
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      confidence += 0.3;
    }
    
    // Check for proper capitalization
    const isProperlyCapitalized = nameParts.every(part => 
      part.charAt(0).toUpperCase() === part.charAt(0) && 
      part.slice(1).toLowerCase() === part.slice(1)
    );
    if (isProperlyCapitalized) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1);
  }
  
  /**
   * Calculate confidence for summary field
   */
  private static calculateSummaryConfidence(summary: string): ConfidenceScore {
    let confidence = 0.5; // Base confidence
    let reason = 'Summary extracted';
    
    if (summary.length > 100) {
      confidence += 0.2;
      reason = 'Detailed summary found';
    }
    
    // Check for professional keywords
    const professionalKeywords = [
      'developer', 'engineer', 'software', 'programming', 'technical',
      'experience', 'skilled', 'proficient', 'expertise', 'passionate'
    ];
    
    const keywordCount = professionalKeywords.filter(keyword => 
      summary.toLowerCase().includes(keyword)
    ).length;
    
    confidence += Math.min(keywordCount * 0.05, 0.3);
    
    if (keywordCount > 3) {
      reason = 'Professional summary with relevant keywords';
    }
    
    return {
      field: 'summary',
      score: Math.min(confidence, 1),
      reason
    };
  }
  
  /**
   * Get confidence reason for skills
   */
  private static getSkillsConfidenceReason(skillCategory: ParsedResumeData['skills'][0]): string {
    if (skillCategory.confidence > 0.8) {
      return `High confidence: ${skillCategory.items.length} skills in ${skillCategory.category}`;
    } else if (skillCategory.confidence > 0.6) {
      return `Medium confidence: Skills categorized as ${skillCategory.category}`;
    } else {
      return `Low confidence: Uncertain skill categorization`;
    }
  }
  
  /**
   * Get confidence reason for experience
   */
  private static getExperienceConfidenceReason(experience: ParsedResumeData['experience'][0]): string {
    if (experience.confidence > 0.8) {
      return `High confidence: Complete job details with ${experience.bullets.length} bullet points`;
    } else if (experience.confidence > 0.6) {
      return `Medium confidence: Job details extracted with some uncertainty`;
    } else {
      return `Low confidence: Incomplete or uncertain job information`;
    }
  }
  
  /**
   * Get confidence reason for projects
   */
  private static getProjectConfidenceReason(project: ParsedResumeData['projects'][0]): string {
    if (project.confidence > 0.8) {
      return `High confidence: Complete project with tech stack (${project.techStack.length} technologies)`;
    } else if (project.confidence > 0.6) {
      return `Medium confidence: Project details extracted`;
    } else {
      return `Low confidence: Limited project information`;
    }
  }
  
  /**
   * Get confidence reason for education
   */
  private static getEducationConfidenceReason(education: ParsedResumeData['education'][0]): string {
    if (education.confidence > 0.8) {
      return `High confidence: Complete education details`;
    } else if (education.confidence > 0.6) {
      return `Medium confidence: Education information extracted`;
    } else {
      return `Low confidence: Incomplete education details`;
    }
  }
  
  /**
   * Get name confidence reason
   */
  private static getNameConfidenceReason(name: string): string {
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      return 'Full name detected';
    } else {
      return 'Single name or incomplete name';
    }
  }
  
  /**
   * Identify fields that need user review (low confidence)
   */
  static getFieldsNeedingReview(data: ParsedResumeData, threshold: number = 0.7): string[] {
    const scores = this.getAllConfidenceScores(data);
    return scores
      .filter(score => score.score < threshold)
      .map(score => score.field);
  }
  
  /**
   * Calculate confidence score for a specific field type
   */
  static calculateFieldConfidence(
    fieldType: 'email' | 'phone' | 'url' | 'name',
    value: string
  ): { score: number; reason: string } {
    switch (fieldType) {
      case 'email':
        const emailResult = validateEmail(value);
        return { score: emailResult.confidence, reason: emailResult.reason };
      
      case 'phone':
        const phoneResult = validatePhone(value);
        return { score: phoneResult.confidence, reason: phoneResult.reason };
      
      case 'url':
        const urlResult = validateURL(value);
        return { score: urlResult.confidence, reason: urlResult.reason };
      
      case 'name':
        return {
          score: this.calculateNameConfidence(value),
          reason: this.getNameConfidenceReason(value)
        };
      
      default:
        return { score: 0.5, reason: 'Unknown field type' };
    }
  }
}

/**
 * Utility functions for confidence scoring
 */
export const confidenceUtils = {
  /**
   * Convert confidence score to human-readable label
   */
  getConfidenceLabel(score: number): string {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    if (score >= 0.4) return 'Low';
    return 'Very Low';
  },
  
  /**
   * Get color class for confidence score (for UI)
   */
  getConfidenceColor(score: number): string {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    if (score >= 0.4) return 'text-orange-600';
    return 'text-red-600';
  },
  
  /**
   * Check if confidence score requires user attention
   */
  requiresAttention(score: number): boolean {
    return score < 0.7;
  }
};