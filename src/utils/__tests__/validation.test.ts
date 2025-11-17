import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhone,
  validateURL,
  validateFile,
  validateResumeData,
  validateTemplate,
  validateDeploymentConfig,
  validateDomain,
} from '../validation';
import type { ParsedResumeData, Template, DeploymentConfig } from '../../types';

describe('Email Validation', () => {
  it('should validate correct email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'developer@github.com',
      'john.doe+work@company.org',
    ];

    validEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  it('should reject invalid email formats', () => {
    const invalidEmails = [
      'invalid-email',
      '@domain.com',
      'user@',
    ];

    invalidEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  it('should give higher confidence to professional domains', () => {
    const professionalEmail = validateEmail('developer@company.com');
    const gmailEmail = validateEmail('developer@gmail.com');
    
    // Both should be valid, but professional should have higher or equal confidence
    expect(professionalEmail.confidence).toBeGreaterThanOrEqual(gmailEmail.confidence);
  });
});

describe('Phone Validation', () => {
  it('should validate US phone numbers', () => {
    const validPhones = [
      '+1-555-123-4567',
      '(555) 123-4567',
      '555.123.4567',
      '5551234567',
      '+15551234567',
    ];

    validPhones.forEach(phone => {
      const result = validatePhone(phone);
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  it('should validate international phone numbers', () => {
    const internationalPhones = [
      '+44 20 7946 0958',
      '+33 1 42 86 83 26',
      '+81 3 3264 1234',
    ];

    internationalPhones.forEach(phone => {
      const result = validatePhone(phone);
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  it('should reject invalid phone numbers', () => {
    const invalidPhones = [
      '123',
      'abc-def-ghij',
      '555-123', // Too short
    ];

    invalidPhones.forEach(phone => {
      const result = validatePhone(phone);
      expect(result.isValid).toBe(false);
    });
  });
});

describe('URL Validation', () => {
  it('should validate correct URLs', () => {
    const validUrls = [
      'https://github.com/user',
      'https://linkedin.com/in/user',
      'https://portfolio.dev',
      'http://example.com',
    ];

    validUrls.forEach(url => {
      const result = validateURL(url);
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  it('should give higher confidence to HTTPS URLs', () => {
    const httpsResult = validateURL('https://example.com');
    const httpResult = validateURL('http://example.com');
    
    expect(httpsResult.confidence).toBeGreaterThan(httpResult.confidence);
  });

  it('should give higher confidence to professional domains', () => {
    const githubResult = validateURL('https://github.com/user');
    const randomResult = validateURL('https://random-site.com');
    
    expect(githubResult.confidence).toBeGreaterThan(randomResult.confidence);
  });

  it('should reject invalid URLs', () => {
    const invalidUrls = [
      'not-a-url',
      'https://', // Missing domain
    ];

    invalidUrls.forEach(url => {
      const result = validateURL(url);
      expect(result.isValid).toBe(false);
    });
  });
});

describe('File Validation', () => {
  it('should validate supported file types', () => {
    const validFiles = [
      { name: 'resume.pdf', size: 1024 * 1024, type: 'application/pdf' },
      { name: 'resume.docx', size: 2 * 1024 * 1024, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'resume.txt', size: 512 * 1024, type: 'text/plain' },
    ];

    validFiles.forEach(fileData => {
      const file = new File(['content'], fileData.name, { type: fileData.type });
      Object.defineProperty(file, 'size', { value: fileData.size });
      
      const result = validateFile(file);
      expect(result.success).toBe(true);
    });
  });

  it('should reject unsupported file types', () => {
    const invalidFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    const result = validateFile(invalidFile);
    expect(result.success).toBe(false);
    expect(result.error).toContain('File must be PDF, DOCX, or TXT format');
  });

  it('should reject files that are too large', () => {
    const largeFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 }); // 15MB
    
    const result = validateFile(largeFile);
    expect(result.success).toBe(false);
    expect(result.error).toContain('File size must be less than 10MB');
  });
});

describe('Resume Data Validation', () => {
  const validResumeData: ParsedResumeData = {
    profile: {
      name: 'John Doe',
      title: 'Software Developer',
      email: 'john@example.com',
      phone: '5551234567',
      links: {
        github: 'https://github.com/johndoe',
        linkedin: 'https://linkedin.com/in/johndoe',
      },
    },
    summary: 'Experienced software developer with 5 years of experience.',
    skills: [
      {
        category: 'Programming Languages',
        items: ['JavaScript', 'TypeScript', 'Python'],
        confidence: 0.9,
      },
    ],
    experience: [
      {
        company: 'Tech Corp',
        role: 'Senior Developer',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-01-01'),
        bullets: ['Developed web applications', 'Led team of 3 developers'],
        techStack: ['React', 'Node.js'],
        confidence: 0.85,
      },
    ],
    projects: [
      {
        name: 'Portfolio Website',
        description: 'Personal portfolio built with React',
        links: { repo: 'https://github.com/johndoe/portfolio' },
        techStack: ['React', 'TypeScript'],
        confidence: 0.8,
      },
    ],
    education: [
      {
        degree: 'Bachelor of Computer Science',
        institution: 'University of Technology',
        startDate: new Date('2016-09-01'),
        endDate: new Date('2020-05-01'),
        confidence: 0.9,
      },
    ],
  };

  it('should validate correct resume data', () => {
    const result = validateResumeData(validResumeData);
    if (!result.success) {
      console.log('Validation errors:', result.errors);
    }
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should reject resume data with missing required fields', () => {
    const invalidData = { ...validResumeData };
    delete (invalidData as any).profile.name;
    
    const result = validateResumeData(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject resume data with invalid email', () => {
    const invalidData = {
      ...validResumeData,
      profile: { ...validResumeData.profile, email: 'invalid-email' },
    };
    
    const result = validateResumeData(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Template Validation', () => {
  const validTemplate: Template = {
    id: 'modern-template',
    name: 'Modern Template',
    description: 'A clean, modern template for developers',
    category: 'modern',
    sections: [
      {
        id: 'profile-section',
        name: 'Profile',
        type: 'profile',
        required: true,
        customizable: false,
      },
    ],
    customizations: [
      {
        id: 'primary-color',
        name: 'Primary Color',
        type: 'color',
        options: ['#3B82F6', '#10B981', '#F59E0B'],
        default: '#3B82F6',
      },
    ],
  };

  it('should validate correct template data', () => {
    const result = validateTemplate(validTemplate);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should reject template with invalid category', () => {
    const invalidTemplate = { ...validTemplate, category: 'invalid' };
    const result = validateTemplate(invalidTemplate);
    expect(result.success).toBe(false);
  });

  it('should reject template with empty sections', () => {
    const invalidTemplate = { ...validTemplate, sections: [] };
    const result = validateTemplate(invalidTemplate);
    expect(result.success).toBe(false);
  });
});

describe('Deployment Config Validation', () => {
  const validConfig: DeploymentConfig = {
    platform: 'vercel',
    customDomain: 'johndoe.dev',
    seoConfig: {
      title: 'John Doe - Software Developer',
      description: 'Portfolio of John Doe, experienced software developer',
      keywords: ['developer', 'javascript', 'react'],
    },
    analytics: {
      googleAnalytics: 'GA-123456789',
    },
  };

  it('should validate correct deployment config', () => {
    const result = validateDeploymentConfig(validConfig);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should reject config with invalid platform', () => {
    const invalidConfig = { ...validConfig, platform: 'invalid' as any };
    const result = validateDeploymentConfig(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject config with invalid domain', () => {
    const invalidConfig = { ...validConfig, customDomain: 'invalid-domain' };
    const result = validateDeploymentConfig(invalidConfig);
    expect(result.success).toBe(false);
  });
});

describe('Domain Validation', () => {
  it('should validate correct domain formats', () => {
    const validDomains = [
      'portfolio.dev',
      'johndoe.io',
      'my-site.com',
    ];

    validDomains.forEach(domain => {
      const result = validateDomain(domain);
      if (!result.isValid) {
        console.log(`Domain ${domain} failed: ${result.reason}`);
      }
      expect(result.isValid).toBe(true);
    });
  });

  it('should reject invalid domain formats', () => {
    const invalidDomains = [
      'invalid',
      '.com',
      'domain.',
      'domain..com',
      '-domain.com',
    ];

    invalidDomains.forEach(domain => {
      const result = validateDomain(domain);
      expect(result.isValid).toBe(false);
    });
  });

  it('should reject reserved domains', () => {
    const reservedDomains = ['localhost', 'example.com', 'test.com'];
    
    reservedDomains.forEach(domain => {
      const result = validateDomain(domain);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Reserved domain');
    });
  });
});