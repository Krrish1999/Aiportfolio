import { describe, it, expect } from 'vitest';
import { ContentModerationService } from '../content-moderation';

describe('ContentModerationService', () => {
  const moderationService = new ContentModerationService();

  describe('moderateContent', () => {
    it('should pass safe professional content', async () => {
      const safeContent = 'Experienced software engineer with expertise in React and Node.js. Built scalable applications serving 1M+ users.';
      
      const result = await moderationService.moderateContent(safeContent, 'bio');
      
      expect(result.safe).toBe(true);
      expect(result.flagged).toHaveLength(0);
      expect(result.confidence).toBe(1.0);
    });

    it('should flag unprofessional language', async () => {
      const unprofessionalContent = 'I am a damn good developer who can build shit that works.';
      
      const result = await moderationService.moderateContent(unprofessionalContent, 'bio');
      
      expect(result.safe).toBe(false);
      expect(result.flagged).toContain('unprofessional_language');
      expect(result.confidence).toBeLessThan(1.0);
      expect(result.sanitizedContent).toBeTruthy();
    });

    it('should flag harmful content', async () => {
      const harmfulContent = 'I hate people who use Java and want to destroy their code.';
      
      const result = await moderationService.moderateContent(harmfulContent, 'bio');
      
      expect(result.safe).toBe(false);
      expect(result.flagged).toContain('harmful_content');
      expect(result.confidence).toBe(0);
    });

    it('should flag potential PII', async () => {
      const piiContent = 'My SSN is 123-45-6789 and credit card is 1234567890123456.';
      
      const result = await moderationService.moderateContent(piiContent, 'bio');
      
      expect(result.safe).toBe(false);
      expect(result.flagged).toContain('potential_pii');
      expect(result.sanitizedContent).toContain('[SSN-REDACTED]');
      expect(result.sanitizedContent).toContain('[CARD-REDACTED]');
    });

    it('should flag excessive length', async () => {
      const longContent = 'a'.repeat(6000);
      
      const result = await moderationService.moderateContent(longContent, 'bio');
      
      expect(result.safe).toBe(false);
      expect(result.flagged).toContain('excessive_length');
    });

    it('should flag insufficient bio content', async () => {
      const shortContent = 'Developer';
      
      const result = await moderationService.moderateContent(shortContent, 'bio');
      
      expect(result.safe).toBe(false);
      expect(result.flagged).toContain('insufficient_content');
    });

    it('should allow phone numbers in resume context', async () => {
      const contentWithPhone = 'Contact me at 555-123-4567 for opportunities.';
      
      const result = await moderationService.moderateContent(contentWithPhone, 'bio');
      
      // Phone numbers are acceptable in resume context
      expect(result.flagged).not.toContain('potential_pii');
    });
  });

  describe('validateProfessionalContent', () => {
    it('should validate strong professional content', async () => {
      const strongContent = 'Led development of microservices architecture, reducing latency by 40%.';
      
      const result = await moderationService.validateProfessionalContent(strongContent);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect weak language', async () => {
      const weakContent = 'I think I maybe helped with some projects that were possibly successful.';
      
      const result = await moderationService.validateProfessionalContent(weakContent);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Weak language detected');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect excessive first-person usage', async () => {
      const firstPersonContent = 'I did this and I did that. My work was great. I achieved my goals.';
      
      const result = await moderationService.validateProfessionalContent(firstPersonContent);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Excessive first-person usage');
    });

    it('should detect passive voice', async () => {
      const passiveContent = 'The system was designed and the features were implemented.';
      
      const result = await moderationService.validateProfessionalContent(passiveContent);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Passive voice detected');
    });
  });

  describe('moderateBatch', () => {
    it('should moderate multiple content pieces', async () => {
      const contents = [
        'Built scalable web applications',
        'Damn good at coding',
        'Implemented CI/CD pipelines'
      ];
      
      const results = await moderationService.moderateBatch(contents, 'bullet');
      
      expect(results).toHaveLength(3);
      expect(results[0].safe).toBe(true);
      expect(results[1].safe).toBe(false);
      expect(results[2].safe).toBe(true);
    });
  });
});
