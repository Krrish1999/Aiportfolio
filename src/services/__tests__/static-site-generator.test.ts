import { describe, it, expect } from 'vitest';
import { StaticSiteGenerator } from '../static-site-generator';
import { ParsedResumeData, Template, SEOConfig } from '../../types';
import { getDefaultTemplate } from '../../templates/config';

describe('StaticSiteGenerator', () => {
  const generator = new StaticSiteGenerator();

  const mockResumeData: ParsedResumeData = {
    profile: {
      name: 'John Doe',
      title: 'Full Stack Developer',
      location: 'San Francisco, CA',
      email: 'john@example.com',
      phone: '+1-555-0123',
      links: {
        github: 'https://github.com/johndoe',
        linkedin: 'https://linkedin.com/in/johndoe',
        website: 'https://johndoe.dev',
      },
    },
    summary: 'Experienced full stack developer with 5+ years building scalable web applications.',
    skills: [
      {
        category: 'Languages',
        items: ['JavaScript', 'TypeScript', 'Python'],
        confidence: 0.95,
      },
      {
        category: 'Frameworks',
        items: ['React', 'Node.js', 'Next.js'],
        confidence: 0.9,
      },
    ],
    experience: [
      {
        company: 'Tech Corp',
        role: 'Senior Developer',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-12-31'),
        bullets: [
          'Led development of microservices architecture',
          'Improved application performance by 40%',
        ],
        techStack: ['React', 'Node.js', 'PostgreSQL'],
        confidence: 0.92,
      },
    ],
    projects: [
      {
        name: 'E-commerce Platform',
        description: 'Built a scalable e-commerce platform handling 10k+ daily users',
        role: 'Lead Developer',
        links: {
          repo: 'https://github.com/johndoe/ecommerce',
          demo: 'https://demo.example.com',
        },
        techStack: ['Next.js', 'Stripe', 'PostgreSQL'],
        confidence: 0.88,
      },
    ],
    education: [
      {
        degree: 'BS Computer Science',
        institution: 'University of California',
        startDate: new Date('2015-09-01'),
        endDate: new Date('2019-06-01'),
        gpa: '3.8',
        confidence: 0.95,
      },
    ],
    certifications: [
      {
        name: 'AWS Certified Developer',
        issuer: 'Amazon Web Services',
        date: new Date('2022-03-15'),
        url: 'https://aws.amazon.com/certification',
      },
    ],
  };

  const mockTemplate: Template = getDefaultTemplate();

  describe('generateSite', () => {
    it('should generate a complete static site', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site).toHaveProperty('html');
      expect(site).toHaveProperty('css');
      expect(site).toHaveProperty('metadata');
      expect(site.html).toContain('<!DOCTYPE html>');
      expect(site.css).toContain('font-family');
      expect(site.metadata.title).toContain('John Doe');
    });

    it('should include custom SEO config', () => {
      const seoConfig: SEOConfig = {
        title: 'Custom Title',
        description: 'Custom description for SEO',
        keywords: ['developer', 'javascript', 'react'],
      };

      const site = generator.generateSite(mockResumeData, mockTemplate, {}, seoConfig);

      expect(site.html).toContain('Custom Title');
      expect(site.html).toContain('Custom description for SEO');
      expect(site.html).toContain('developer, javascript, react');
    });

    it('should apply customizations', () => {
      const customizations = {
        primaryColor: '#FF5733',
        fontFamily: 'Roboto',
        fontSize: 'large' as const,
        spacing: 3,
        theme: 'dark' as const,
      };

      const site = generator.generateSite(mockResumeData, mockTemplate, customizations);

      expect(site.css).toContain('#FF5733');
      expect(site.css).toContain('Roboto');
      expect(site.css).toContain('18px'); // large font size
      expect(site.html).toContain('theme-dark');
    });
  });

  describe('SEO optimization', () => {
    it('should include meta tags', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('<meta name="description"');
      expect(site.html).toContain('<meta name="keywords"');
      expect(site.html).toContain('<meta name="author"');
      expect(site.html).toContain('<meta name="robots"');
    });

    it('should include Open Graph tags', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('property="og:type"');
      expect(site.html).toContain('property="og:title"');
      expect(site.html).toContain('property="og:description"');
    });

    it('should include Twitter Card tags', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('property="twitter:card"');
      expect(site.html).toContain('property="twitter:title"');
      expect(site.html).toContain('property="twitter:description"');
    });

    it('should include structured data (JSON-LD)', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('application/ld+json');
      expect(site.html).toContain('"@context": "https://schema.org"');
      expect(site.html).toContain('"@type": "Person"');
      expect(site.html).toContain('John Doe');
    });

    it('should escape HTML in meta tags', () => {
      const dataWithSpecialChars: ParsedResumeData = {
        ...mockResumeData,
        profile: {
          ...mockResumeData.profile,
          name: 'John <script>alert("xss")</script> Doe',
        },
      };

      const site = generator.generateSite(dataWithSpecialChars, mockTemplate);

      expect(site.html).not.toContain('<script>');
      expect(site.html).toContain('&lt;script&gt;');
    });
  });

  describe('generateSitemap', () => {
    it('should generate valid sitemap XML', () => {
      const sitemap = generator.generateSitemap('https://example.com');

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemap).toContain('<loc>https://example.com</loc>');
      expect(sitemap).toContain('<changefreq>monthly</changefreq>');
      expect(sitemap).toContain('<priority>1.0</priority>');
    });

    it('should include custom entries', () => {
      const entries = [
        {
          url: 'https://example.com',
          lastmod: '2024-01-01',
          changefreq: 'weekly' as const,
          priority: 1.0,
        },
        {
          url: 'https://example.com/projects',
          lastmod: '2024-01-15',
          changefreq: 'monthly' as const,
          priority: 0.8,
        },
      ];

      const sitemap = generator.generateSitemap('https://example.com', entries);

      expect(sitemap).toContain('https://example.com/projects');
      expect(sitemap).toContain('2024-01-15');
      expect(sitemap).toContain('<priority>0.8</priority>');
    });

    it('should escape XML special characters', () => {
      const entries = [
        {
          url: 'https://example.com?param=value&other=test',
          lastmod: '2024-01-01',
          changefreq: 'monthly' as const,
          priority: 1.0,
        },
      ];

      const sitemap = generator.generateSitemap('https://example.com', entries);

      expect(sitemap).toContain('&amp;');
      expect(sitemap).not.toContain('?param=value&other=test');
    });
  });

  describe('generateRobotsTxt', () => {
    it('should generate basic robots.txt', () => {
      const robotsTxt = generator.generateRobotsTxt();

      expect(robotsTxt).toContain('User-agent: *');
      expect(robotsTxt).toContain('Allow: /');
    });

    it('should include sitemap URL when provided', () => {
      const robotsTxt = generator.generateRobotsTxt('https://example.com/sitemap.xml');

      expect(robotsTxt).toContain('Sitemap: https://example.com/sitemap.xml');
    });
  });

  describe('validateMobileResponsive', () => {
    it('should validate responsive design', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);
      const validation = generator.validateMobileResponsive(site.html, site.css);

      expect(validation.isResponsive).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect missing viewport meta tag', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const css = 'body { font-size: 16px; }';
      
      const validation = generator.validateMobileResponsive(html, css);

      expect(validation.isResponsive).toBe(false);
      expect(validation.issues).toContain('Missing viewport meta tag');
    });

    it('should detect missing media queries', () => {
      const html = '<html><head><meta name="viewport" content="width=device-width"></head></html>';
      const css = 'body { font-size: 16px; }';
      
      const validation = generator.validateMobileResponsive(html, css);

      expect(validation.isResponsive).toBe(false);
      expect(validation.issues).toContain('No media queries found in CSS');
    });
  });

  describe('content generation', () => {
    it('should include all profile information', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('John Doe');
      expect(site.html).toContain('Full Stack Developer');
      expect(site.html).toContain('San Francisco, CA');
      expect(site.html).toContain('john@example.com');
      expect(site.html).toContain('+1-555-0123');
    });

    it('should include all experience items', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('Tech Corp');
      expect(site.html).toContain('Senior Developer');
      expect(site.html).toContain('Led development of microservices architecture');
      expect(site.html).toContain('React, Node.js, PostgreSQL');
    });

    it('should include all projects', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('E-commerce Platform');
      expect(site.html).toContain('Built a scalable e-commerce platform');
      expect(site.html).toContain('https://github.com/johndoe/ecommerce');
    });

    it('should include education', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('BS Computer Science');
      expect(site.html).toContain('University of California');
      expect(site.html).toContain('GPA: 3.8');
    });

    it('should include certifications', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.html).toContain('AWS Certified Developer');
      expect(site.html).toContain('Amazon Web Services');
    });

    it('should handle missing optional fields', () => {
      const minimalData: ParsedResumeData = {
        ...mockResumeData,
        profile: {
          ...mockResumeData.profile,
          location: undefined,
          phone: undefined,
          links: {},
        },
        certifications: undefined,
      };

      const site = generator.generateSite(minimalData, mockTemplate);

      expect(site.html).toContain('John Doe');
      expect(site.html).not.toContain('location');
      expect(site.html).not.toContain('Certifications');
    });
  });

  describe('CSS generation', () => {
    it('should generate responsive CSS', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.css).toContain('@media (max-width: 768px)');
      expect(site.css).toContain('@media print');
    });

    it('should use custom colors', () => {
      const customizations = {
        primaryColor: '#FF5733',
      };

      const site = generator.generateSite(mockResumeData, mockTemplate, customizations);

      expect(site.css).toContain('#FF5733');
    });

    it('should support dark theme', () => {
      const customizations = {
        theme: 'dark' as const,
      };

      const site = generator.generateSite(mockResumeData, mockTemplate, customizations);

      expect(site.css).toContain('#1a1a1a'); // dark background
      expect(site.css).toContain('#e5e5e5'); // light text
    });

    it('should support light theme', () => {
      const customizations = {
        theme: 'light' as const,
      };

      const site = generator.generateSite(mockResumeData, mockTemplate, customizations);

      expect(site.css).toContain('#ffffff'); // light background
      expect(site.css).toContain('#1a1a1a'); // dark text
    });
  });

  describe('metadata extraction', () => {
    it('should extract keywords from skills', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.metadata.keywords).toContain('javascript');
      expect(site.metadata.keywords).toContain('typescript');
      expect(site.metadata.keywords).toContain('react');
    });

    it('should limit keywords to 20', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.metadata.keywords.length).toBeLessThanOrEqual(20);
    });

    it('should generate default title and description', () => {
      const site = generator.generateSite(mockResumeData, mockTemplate);

      expect(site.metadata.title).toBe('John Doe - Full Stack Developer');
      expect(site.metadata.description).toContain('Experienced full stack developer');
    });
  });
});
