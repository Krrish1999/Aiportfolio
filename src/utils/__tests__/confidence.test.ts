import { describe, it, expect } from 'vitest';
import { ConfidenceScorer, confidenceUtils } from '../confidence';
import type { ParsedResumeData } from '../../types';

describe('ConfidenceScorer', () => {
  const mockResumeData: ParsedResumeData = {
    profile: {
      name: 'John Doe',
      title: 'Software Developer',
      email: 'john@example.com',
      phone: '555-123-4567',
      links: {
        github: 'https://github.com/johndoe',
        linkedin: 'https://linkedin.com/in/johndoe',
      },
    },
    summary: 'Experienced software developer with expertise in JavaScript, React, and Node.js. Passionate about creating scalable web applications.',
    skills: [
      {
        category: 'Programming Languages',
        items: ['JavaScript', 'TypeScript', 'Python'],
        confidence: 0.9,
      },
      {
        category: 'Frameworks',
        items: ['React', 'Node.js'],
        confidence: 0.8,
      },
    ],
    experience: [
      {
        company: 'Tech Corp',
        role: 'Senior Developer',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-01-01'),
        bullets: [
          'Developed scalable web applications using React and Node.js',
          'Led a team of 3 developers and improved code quality by 40%',
          'Implemented CI/CD pipelines reducing deployment time by 60%',
        ],
        techStack: ['React', 'Node.js', 'PostgreSQL'],
        confidence: 0.85,
      },
    ],
    projects: [
      {
        name: 'E-commerce Platform',
        description: 'Full-stack e-commerce platform with payment integration',
        links: {
          repo: 'https://github.com/johndoe/ecommerce',
          demo: 'https://ecommerce-demo.com'
        },
        techStack: ['React', 'Node.js', 'MongoDB', 'Stripe'],
        confidence: 0.9,
      },
    ],
    education: [
      {
        degree: 'Bachelor of Computer Science',
        institution: 'University of Technology',
        startDate: new Date('2016-09-01'),
        endDate: new Date('2020-05-01'),
        gpa: '3.8',
        confidence: 0.95,
      },
    ],
  };

  describe('calculateOverallConfidence', () => {
    it('should calculate overall confidence score', () => {
      const overallScore = ConfidenceScorer.calculateOverallConfidence(mockResumeData);
      expect(overallScore).toBeGreaterThan(0);
      expect(overallScore).toBeLessThanOrEqual(1);
    });

    it('should return 0 for empty data', () => {
      const emptyData = {
        ...mockResumeData,
        skills: [],
        experience: [],
        projects: [],
        education: [],
      };

      // This should still have profile and summary scores
      const overallScore = ConfidenceScorer.calculateOverallConfidence(emptyData);
      expect(overallScore).toBeGreaterThan(0);
    });
  });

  describe('getAllConfidenceScores', () => {
    it('should return confidence scores for all fields', () => {
      const scores = ConfidenceScorer.getAllConfidenceScores(mockResumeData);
      expect(scores.length).toBeGreaterThan(0);

      // Check that all scores have required properties
      scores.forEach(score => {
        expect(score).toHaveProperty('field');
        expect(score).toHaveProperty('score');
        expect(score).toHaveProperty('reason');
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(1);
      });
    });

    it('should include profile field scores', () => {
      const scores = ConfidenceScorer.getAllConfidenceScores(mockResumeData);
      const profileScores = scores.filter(score => score.field.startsWith('profile.'));
      expect(profileScores.length).toBeGreaterThan(0);
    });

    it('should include summary score', () => {
      const scores = ConfidenceScorer.getAllConfidenceScores(mockResumeData);
      const summaryScore = scores.find(score => score.field === 'summary');
      expect(summaryScore).toBeDefined();
    });
  });

  describe('getFieldsNeedingReview', () => {
    it('should identify low confidence fields', () => {
      const lowConfidenceData = {
        ...mockResumeData,
        skills: [
          {
            category: 'Unknown Skills',
            items: ['skill1'],
            confidence: 0.3, // Low confidence
          },
        ],
      };

      const fieldsNeedingReview = ConfidenceScorer.getFieldsNeedingReview(lowConfidenceData, 0.7);
      expect(fieldsNeedingReview.length).toBeGreaterThan(0);
      expect(fieldsNeedingReview).toContain('skills.0');
    });

    it('should return empty array for high confidence data', () => {
      const fieldsNeedingReview = ConfidenceScorer.getFieldsNeedingReview(mockResumeData, 0.5);
      // Most fields should have confidence > 0.5
      expect(fieldsNeedingReview.length).toBeLessThan(5);
    });
  });

  describe('calculateFieldConfidence', () => {
    it('should calculate email confidence', () => {
      const result = ConfidenceScorer.calculateFieldConfidence('email', 'john@company.com');
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.reason).toContain('Valid email');
    });

    it('should calculate phone confidence', () => {
      const result = ConfidenceScorer.calculateFieldConfidence('phone', '+1-555-123-4567');
      expect(result.score).toBeGreaterThanOrEqual(0.8);
      expect(result.reason).toContain('Valid');
    });

    it('should calculate URL confidence', () => {
      const result = ConfidenceScorer.calculateFieldConfidence('url', 'https://github.com/user');
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.reason).toContain('Valid URL');
    });

    it('should calculate name confidence', () => {
      const result = ConfidenceScorer.calculateFieldConfidence('name', 'John Doe');
      expect(result.score).toBeGreaterThan(0.7);
      expect(result.reason).toContain('Full name');
    });

    it('should handle single names with lower confidence', () => {
      const result = ConfidenceScorer.calculateFieldConfidence('name', 'John');
      expect(result.score).toBeLessThan(0.8);
      expect(result.reason).toContain('Single name');
    });
  });

  describe('Profile Confidence Calculation', () => {
    it('should give high confidence to properly formatted names', () => {
      const scores = ConfidenceScorer.getAllConfidenceScores({
        ...mockResumeData,
        profile: { ...mockResumeData.profile, name: 'John Smith' },
      });

      const nameScore = scores.find(score => score.field === 'profile.name');
      expect(nameScore?.score).toBeGreaterThan(0.7);
    });

    it('should give lower confidence to single names', () => {
      const scores = ConfidenceScorer.getAllConfidenceScores({
        ...mockResumeData,
        profile: { ...mockResumeData.profile, name: 'John' },
      });

      const nameScore = scores.find(score => score.field === 'profile.name');
      expect(nameScore?.score).toBeLessThan(0.8);
    });
  });

  describe('Summary Confidence Calculation', () => {
    it('should give high confidence to detailed summaries with keywords', () => {
      const detailedSummary = 'Experienced software developer with 5+ years of expertise in JavaScript, React, and Node.js. Passionate about creating scalable web applications and leading technical teams.';

      const scores = ConfidenceScorer.getAllConfidenceScores({
        ...mockResumeData,
        summary: detailedSummary,
      });

      const summaryScore = scores.find(score => score.field === 'summary');
      expect(summaryScore?.score).toBeGreaterThan(0.8);
    });

    it('should give lower confidence to short summaries', () => {
      const shortSummary = 'Developer';

      const scores = ConfidenceScorer.getAllConfidenceScores({
        ...mockResumeData,
        summary: shortSummary,
      });

      const summaryScore = scores.find(score => score.field === 'summary');
      expect(summaryScore?.score).toBeLessThan(0.7);
    });
  });
});

describe('confidenceUtils', () => {
  describe('getConfidenceLabel', () => {
    it('should return correct labels for different confidence levels', () => {
      expect(confidenceUtils.getConfidenceLabel(0.9)).toBe('High');
      expect(confidenceUtils.getConfidenceLabel(0.7)).toBe('Medium');
      expect(confidenceUtils.getConfidenceLabel(0.5)).toBe('Low');
      expect(confidenceUtils.getConfidenceLabel(0.3)).toBe('Very Low');
    });
  });

  describe('getConfidenceColor', () => {
    it('should return appropriate color classes', () => {
      expect(confidenceUtils.getConfidenceColor(0.9)).toBe('text-green-600');
      expect(confidenceUtils.getConfidenceColor(0.7)).toBe('text-yellow-600');
      expect(confidenceUtils.getConfidenceColor(0.5)).toBe('text-orange-600');
      expect(confidenceUtils.getConfidenceColor(0.3)).toBe('text-red-600');
    });
  });

  describe('requiresAttention', () => {
    it('should identify scores that require attention', () => {
      expect(confidenceUtils.requiresAttention(0.6)).toBe(true);
      expect(confidenceUtils.requiresAttention(0.8)).toBe(false);
    });
  });
});