/**
 * Content moderation service to prevent harmful or inappropriate AI-generated content
 */

export interface ModerationResult {
  safe: boolean;
  flagged: string[];
  confidence: number;
  sanitizedContent?: string;
}

export class ContentModerationService {
  // Patterns for detecting harmful content
  private readonly harmfulPatterns = [
    // Personal attacks and hate speech
    /\b(hate|kill|murder|attack|destroy)\s+(people|person|group|race|religion)\b/gi,
    // Explicit content
    /\b(explicit|sexual|pornographic|nude)\b/gi,
    // Violence
    /\b(violent|violence|assault|abuse|harm)\s+(content|material|imagery)\b/gi,
    // Discrimination
    /\b(discriminate|discriminatory|racist|sexist|homophobic)\b/gi,
    // Personal information patterns (PII)
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{16}\b/g, // Credit card
  ];

  // Patterns for professional content validation
  private readonly unprofessionalPatterns = [
    /\b(fuck|shit|damn|hell|ass|bitch)\b/gi,
    /\b(stupid|idiot|dumb|moron)\b/gi,
  ];

  // Sensitive topics that require careful handling
  private readonly sensitiveTopics = [
    'politics',
    'religion',
    'controversial',
    'sensitive',
    'confidential',
    'classified',
  ];

  /**
   * Moderate AI-generated content for safety and appropriateness
   */
  async moderateContent(content: string, context: 'bio' | 'bullet' | 'project' = 'bio'): Promise<ModerationResult> {
    const flagged: string[] = [];
    let confidence = 1.0;

    // Check for harmful patterns
    for (const pattern of this.harmfulPatterns) {
      if (pattern.test(content)) {
        flagged.push('harmful_content');
        confidence = 0;
        break;
      }
    }

    // Check for unprofessional language
    for (const pattern of this.unprofessionalPatterns) {
      if (pattern.test(content)) {
        flagged.push('unprofessional_language');
        confidence = Math.min(confidence, 0.5);
      }
    }

    // Check for sensitive topics
    const lowerContent = content.toLowerCase();
    for (const topic of this.sensitiveTopics) {
      if (lowerContent.includes(topic)) {
        flagged.push('sensitive_topic');
        confidence = Math.min(confidence, 0.7);
      }
    }

    // Check for excessive length (potential prompt injection)
    if (content.length > 5000) {
      flagged.push('excessive_length');
      confidence = Math.min(confidence, 0.6);
    }

    // Check for potential PII leakage
    if (this.containsPII(content)) {
      flagged.push('potential_pii');
      confidence = Math.min(confidence, 0.3);
    }

    // Context-specific validation
    if (context === 'bio' && content.length < 50) {
      flagged.push('insufficient_content');
      confidence = Math.min(confidence, 0.5);
    }

    const safe = flagged.length === 0 || (flagged.length === 1 && flagged[0] === 'sensitive_topic');

    return {
      safe,
      flagged,
      confidence,
      sanitizedContent: safe ? content : this.sanitizeContent(content),
    };
  }

  /**
   * Check if content contains potential PII
   */
  private containsPII(content: string): boolean {
    // Check for SSN pattern
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(content)) {
      return true;
    }

    // Check for credit card pattern
    if (/\b\d{16}\b/.test(content)) {
      return true;
    }

    // Check for phone numbers (basic pattern)
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(content)) {
      // This is acceptable in resume context, so we'll allow it
      return false;
    }

    return false;
  }

  /**
   * Sanitize content by removing harmful patterns
   */
  private sanitizeContent(content: string): string {
    let sanitized = content;

    // Remove unprofessional language
    for (const pattern of this.unprofessionalPatterns) {
      sanitized = sanitized.replace(pattern, '[redacted]');
    }

    // Remove potential PII
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN-REDACTED]');
    sanitized = sanitized.replace(/\b\d{16}\b/g, '[CARD-REDACTED]');

    return sanitized;
  }

  /**
   * Validate that content is appropriate for professional portfolio
   */
  async validateProfessionalContent(content: string): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check tone and professionalism
    if (/\b(I think|maybe|perhaps|possibly)\b/gi.test(content)) {
      issues.push('Weak language detected');
      suggestions.push('Use confident, action-oriented language');
    }

    // Check for first-person overuse
    const firstPersonCount = (content.match(/\b(I|my|me)\b/gi) || []).length;
    if (firstPersonCount > content.split(' ').length * 0.15) {
      issues.push('Excessive first-person usage');
      suggestions.push('Focus on achievements and impact rather than personal pronouns');
    }

    // Check for passive voice
    if (/\b(was|were|been)\s+\w+ed\b/gi.test(content)) {
      issues.push('Passive voice detected');
      suggestions.push('Use active voice to demonstrate ownership and impact');
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Batch moderate multiple content pieces
   */
  async moderateBatch(contents: string[], context: 'bio' | 'bullet' | 'project' = 'bio'): Promise<ModerationResult[]> {
    return Promise.all(contents.map(content => this.moderateContent(content, context)));
  }
}

// Singleton instance
export const contentModerationService = new ContentModerationService();
