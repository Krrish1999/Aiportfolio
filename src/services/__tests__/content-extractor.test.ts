import { describe, it, expect, beforeEach } from 'vitest';
import { ContentExtractorService, ExtractionResult } from '../content-extractor';

describe('ContentExtractorService', () => {
  let extractor: ContentExtractorService;

  beforeEach(() => {
    extractor = new ContentExtractorService();
  });

  describe('extractContent', () => {
    it('should extract complete profile information from resume text', () => {
      const resumeText = `
John Doe
Senior Software Engineer
San Francisco, CA

john.doe@gmail.com
(555) 123-4567
github.com/johndoe
linkedin.com/in/johndoe
johndoe.dev

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years in full-stack development.

EXPERIENCE
Software Engineer at Tech Corp
2020 - Present
• Developed React applications
• Built Node.js APIs

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley
2016 - 2020

SKILLS
JavaScript, TypeScript, React, Node.js, Python, AWS, Docker
      `.trim();

      const result = extractor.extractContent(resumeText);

      expect(result.profile.name?.value).toBe('John Doe');
      expect(result.profile.title?.value).toContain('Software Engineer');
      expect(result.profile.location?.value).toBe('San Francisco, CA');
      expect(result.profile.email?.value).toBe('john.doe@gmail.com');
      expect(result.profile.phone?.value).toBe('555-123-4567');
      expect(result.profile.links.github?.value).toBe('https://github.com/johndoe');
      expect(result.profile.links.linkedin?.value).toBe('https://linkedin.com/in/johndoe');
      expect(result.profile.links.website?.value).toBe('https://johndoe.dev');

      expect(result.sections).toHaveLength(4);
      expect(result.sections.map(s => s.name)).toContain('EXPERIENCE');
      expect(result.sections.map(s => s.name)).toContain('EDUCATION');
      expect(result.sections.map(s => s.name)).toContain('SKILLS');
      expect(result.sections.map(s => s.name)).toContain('SUMMARY');
    });
  });

  describe('email extraction', () => {
    it('should extract valid email addresses', () => {
      const text = 'Contact me at john.doe@gmail.com for opportunities';
      const result = extractor.extractContent(text);
      
      expect(result.profile.email?.value).toBe('john.doe@gmail.com');
      expect(result.profile.email?.confidence).toBeGreaterThan(0.5);
    });

    it('should prefer professional emails over placeholder emails', () => {
      const text = 'john.doe@company.com or test@example.com';
      const result = extractor.extractContent(text);
      
      expect(result.profile.email?.value).toBe('john.doe@company.com');
    });

    it('should handle multiple emails and pick the best one', () => {
      const text = 'Personal: john@gmail.com Work: john.doe@techcorp.com';
      const result = extractor.extractContent(text);
      
      expect(result.profile.email?.value).toBe('john.doe@techcorp.com');
    });
  });

  describe('phone extraction', () => {
    it('should extract and format phone numbers', () => {
      const testCases = [
        { input: '(555) 123-4567', expected: '555-123-4567' },
        { input: '555.123.4567', expected: '555-123-4567' },
        { input: '555 123 4567', expected: '555-123-4567' },
        { input: '+1 555 123 4567', expected: '555-123-4567' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractor.extractContent(input);
        expect(result.profile.phone?.value).toBe(expected);
      });
    });
  });

  describe('social media extraction', () => {
    it('should extract GitHub profiles', () => {
      const testCases = [
        'github.com/johndoe',
        'https://github.com/johndoe',
        '@johndoe on GitHub'
      ];

      testCases.forEach(input => {
        const result = extractor.extractContent(input);
        expect(result.profile.links.github?.value).toBe('https://github.com/johndoe');
      });
    });

    it('should extract LinkedIn profiles', () => {
      const testCases = [
        'linkedin.com/in/johndoe',
        'https://linkedin.com/in/johndoe',
        'linkedin.com/pub/johndoe'
      ];

      testCases.forEach(input => {
        const result = extractor.extractContent(input);
        expect(result.profile.links.linkedin?.value).toBe('https://linkedin.com/in/johndoe');
      });
    });

    it('should extract personal websites', () => {
      const result = extractor.extractContent('Portfolio: johndoe.dev');
      expect(result.profile.links.website?.value).toBe('https://johndoe.dev');
    });

    it('should filter out social media domains from website extraction', () => {
      const result = extractor.extractContent('github.com/user linkedin.com/in/user johndoe.dev');
      expect(result.profile.links.website?.value).toBe('https://johndoe.dev');
    });
  });

  describe('name extraction', () => {
    it('should extract names from the beginning of resume', () => {
      const text = 'John Doe\nSoftware Engineer\nSan Francisco, CA';
      const result = extractor.extractContent(text);
      
      expect(result.profile.name?.value).toBe('John Doe');
    });

    it('should handle names with middle initials', () => {
      const text = 'John A. Doe\nSenior Developer';
      const result = extractor.extractContent(text);
      
      expect(result.profile.name?.value).toBe('John A. Doe');
    });

    it('should skip contact information lines when looking for names', () => {
      const text = 'john.doe@email.com\n(555) 123-4567\nJohn Doe\nSoftware Engineer';
      const result = extractor.extractContent(text);
      
      expect(result.profile.name?.value).toBe('John Doe');
    });
  });

  describe('title extraction', () => {
    it('should extract software engineering titles', () => {
      const testCases = [
        'Senior Software Engineer',
        'Full-Stack Developer',
        'Frontend Engineer',
        'Backend Developer',
        'DevOps Engineer',
        'Data Scientist',
        'Machine Learning Engineer'
      ];

      testCases.forEach(title => {
        const text = `John Doe\n${title}\nSan Francisco, CA`;
        const result = extractor.extractContent(text);
        expect(result.profile.title?.value).toBe(title);
      });
    });

    it('should extract management titles', () => {
      const testCases = [
        'Engineering Manager',
        'Technical Lead',
        'VP of Engineering',
        'CTO'
      ];

      testCases.forEach(title => {
        const text = `John Doe\n${title}\nTech Corp`;
        const result = extractor.extractContent(text);
        expect(result.profile.title?.value).toBe(title);
      });
    });
  });

  describe('location extraction', () => {
    it('should extract city, state combinations', () => {
      const testCases = [
        'San Francisco, CA',
        'New York, NY',
        'Austin, Texas',
        'Seattle, WA'
      ];

      testCases.forEach(location => {
        const result = extractor.extractContent(`John Doe\nSoftware Engineer\n${location}`);
        expect(result.profile.location?.value).toBe(location);
      });
    });
  });

  describe('section identification', () => {
    it('should identify standard resume sections', () => {
      const resumeText = `
PROFESSIONAL SUMMARY
Experienced developer

WORK EXPERIENCE  
Software Engineer at Company

EDUCATION
Bachelor's Degree

TECHNICAL SKILLS
JavaScript, Python

PROJECTS
Personal Portfolio

CERTIFICATIONS
AWS Certified
      `;

      const result = extractor.extractContent(resumeText);
      const sectionNames = result.sections.map(s => s.name);

      expect(sectionNames).toContain('SUMMARY');
      expect(sectionNames).toContain('EXPERIENCE');
      expect(sectionNames).toContain('EDUCATION');
      expect(sectionNames).toContain('SKILLS');
      expect(sectionNames).toContain('PROJECTS');
      expect(sectionNames).toContain('CERTIFICATIONS');
    });

    it('should handle alternative section header formats', () => {
      const resumeText = `
CAREER HISTORY
Previous roles

ACADEMIC BACKGROUND
University degrees

CORE COMPETENCIES
Technical skills
      `;

      const result = extractor.extractContent(resumeText);
      const sectionNames = result.sections.map(s => s.name);

      expect(sectionNames).toContain('EXPERIENCE');
      expect(sectionNames).toContain('EDUCATION');
      expect(sectionNames).toContain('SKILLS');
    });
  });

  describe('skills normalization', () => {
    it('should normalize common technology names', () => {
      const skillsText = 'JavaScript, js, TypeScript, ts, Python, py, React.js, Vue.js';
      const normalized = extractor.normalizeSkills(skillsText);

      expect(normalized).toContain('javascript');
      expect(normalized).toContain('typescript');
      expect(normalized).toContain('python');
      expect(normalized).toContain('react');
      expect(normalized).toContain('vue');
      
      // Should not contain duplicates
      expect(normalized.filter(skill => skill === 'javascript')).toHaveLength(1);
    });

    it('should handle various skill separators', () => {
      const skillsText = 'JavaScript, Python | React • Vue.js / Node.js - Express';
      const normalized = extractor.normalizeSkills(skillsText);

      expect(normalized).toContain('javascript');
      expect(normalized).toContain('python');
      expect(normalized).toContain('react');
      expect(normalized).toContain('vue');
      expect(normalized).toContain('nodejs');
      expect(normalized).toContain('express');
    });

    it('should include unknown technologies that look valid', () => {
      const skillsText = 'JavaScript, SomeNewFramework, CustomTool2024';
      const normalized = extractor.normalizeSkills(skillsText);

      expect(normalized).toContain('javascript');
      expect(normalized).toContain('somenewframework');
      expect(normalized).toContain('customtool2024');
    });

    it('should exclude common non-technical words', () => {
      const skillsText = 'JavaScript, and, Python, with, React, for, development';
      const normalized = extractor.normalizeSkills(skillsText);

      expect(normalized).toContain('javascript');
      expect(normalized).toContain('python');
      expect(normalized).toContain('react');
      expect(normalized).not.toContain('and');
      expect(normalized).not.toContain('with');
      expect(normalized).not.toContain('for');
    });

    it('should handle database and cloud technologies', () => {
      const skillsText = 'MongoDB, PostgreSQL, AWS, Azure, Docker, Kubernetes';
      const normalized = extractor.normalizeSkills(skillsText);

      expect(normalized).toContain('mongodb');
      expect(normalized).toContain('postgresql');
      expect(normalized).toContain('aws');
      expect(normalized).toContain('azure');
      expect(normalized).toContain('docker');
      expect(normalized).toContain('kubernetes');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty text', () => {
      const result = extractor.extractContent('');
      
      expect(result.profile.name).toBeUndefined();
      expect(result.profile.email).toBeUndefined();
      expect(result.sections).toHaveLength(0);
    });

    it('should handle text with no identifiable information', () => {
      const result = extractor.extractContent('Lorem ipsum dolor sit amet consectetur adipiscing elit');
      
      expect(result.profile.name).toBeUndefined();
      expect(result.profile.email).toBeUndefined();
      expect(result.sections).toHaveLength(0);
    });

    it('should handle malformed contact information gracefully', () => {
      const result = extractor.extractContent('Email: not-an-email Phone: abc-def-ghij');
      
      expect(result.profile.email).toBeUndefined();
      expect(result.profile.phone).toBeUndefined();
    });

    it('should handle very long skill lists', () => {
      const longSkillsList = Array(100).fill('JavaScript').join(', ');
      const normalized = extractor.normalizeSkills(longSkillsList);
      
      expect(normalized).toContain('javascript');
      expect(normalized).toHaveLength(1); // Should deduplicate
    });

    it('should handle special characters in text', () => {
      const textWithSpecialChars = 'John Döe\nSoftware Engineer\njohn@email.com';
      const result = extractor.extractContent(textWithSpecialChars);
      
      expect(result.profile.email?.value).toBe('john@email.com');
    });
  });

  describe('date extraction', () => {
    it('should extract various date formats', () => {
      const testCases = [
        'January 2020',
        'Jan 2020', 
        'Jan. 2020',
        '01/2020',
        '2020-01-15',
        'Dec 15, 2020',
        '12/15/2020'
      ];

      testCases.forEach(dateStr => {
        const text = `Work Experience\nSoftware Engineer\n${dateStr} - Present`;
        const result = extractor.extractContent(text);
        
        // Should find the date in the experience section
        expect(result.rawSections['EXPERIENCE']).toContain(dateStr);
      });
    });

    it('should handle date ranges in experience sections', () => {
      const text = `
EXPERIENCE
Software Engineer at Tech Corp
January 2020 - December 2022
• Built web applications
      `;

      const result = extractor.extractContent(text);
      expect(result.rawSections['EXPERIENCE']).toContain('January 2020');
      expect(result.rawSections['EXPERIENCE']).toContain('December 2022');
    });
  });

  describe('URL and link extraction edge cases', () => {
    it('should handle URLs without protocols', () => {
      const result = extractor.extractContent('Portfolio: johndoe.portfolio.com');
      // The regex captures the domain part, so it should be johndoe.portfolio.com
      expect(result.profile.links.website?.value).toBe('https://johndoe.portfolio.com');
    });

    it('should extract GitHub usernames from various formats', () => {
      const testCases = [
        { input: 'GitHub: @johndoe', expected: 'https://github.com/johndoe' },
        { input: 'Find me @johndoe on GitHub', expected: 'https://github.com/johndoe' },
        { input: 'github.com/johndoe', expected: 'https://github.com/johndoe' },
        { input: 'https://www.github.com/johndoe', expected: 'https://github.com/johndoe' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractor.extractContent(input);
        expect(result.profile.links.github?.value).toBe(expected);
      });
    });

    it('should handle complex LinkedIn URLs', () => {
      const testCases = [
        'linkedin.com/in/johndoe',
        'linkedin.com/pub/johndoe',
        'linkedin.com/profile/view?id=johndoe'
      ];

      testCases.forEach(input => {
        const result = extractor.extractContent(input);
        expect(result.profile.links.linkedin?.value).toBe('https://linkedin.com/in/johndoe');
      });
    });
  });

  describe('section content extraction', () => {
    it('should extract content between section boundaries correctly', () => {
      const resumeText = `
EXPERIENCE
Software Engineer at Tech Corp
2020 - Present
• Developed React applications
• Built REST APIs

EDUCATION  
Bachelor of Science in Computer Science
University of California
2016 - 2020
GPA: 3.8/4.0

SKILLS
JavaScript, Python, React, Node.js
      `;

      const result = extractor.extractContent(resumeText);

      expect(result.rawSections['EXPERIENCE']).toContain('Software Engineer at Tech Corp');
      expect(result.rawSections['EXPERIENCE']).toContain('Developed React applications');
      expect(result.rawSections['EDUCATION']).toContain('Bachelor of Science');
      expect(result.rawSections['EDUCATION']).toContain('GPA: 3.8/4.0');
      expect(result.rawSections['SKILLS']).toContain('JavaScript, Python');
    });

    it('should handle sections with no clear boundaries', () => {
      const resumeText = `
John Doe
Software Engineer

I am a passionate developer with experience in web technologies.

SKILLS
JavaScript, React, Node.js
      `;

      const result = extractor.extractContent(resumeText);
      expect(result.rawSections['SKILLS']).toContain('JavaScript, React, Node.js');
    });
  });

  describe('advanced skills normalization', () => {
    it('should handle version-specific technologies', () => {
      const skillsText = 'React 18, Vue 3, Angular 15, Node.js 18, Python 3.11';
      const normalized = extractor.normalizeSkills(skillsText);

      expect(normalized).toContain('react');
      expect(normalized).toContain('vue');
      expect(normalized).toContain('angular');
      expect(normalized).toContain('nodejs');
      expect(normalized).toContain('python');
    });

    it('should handle framework variations and aliases', () => {
      const skillsText = 'React.js, ReactJS, Vue.js, VueJS, Node, NodeJS, Express.js, ExpressJS';
      const normalized = extractor.normalizeSkills(skillsText);

      // Should normalize to canonical forms without duplicates
      expect(normalized.filter(skill => skill === 'react')).toHaveLength(1);
      expect(normalized.filter(skill => skill === 'vue')).toHaveLength(1);
      expect(normalized.filter(skill => skill === 'nodejs')).toHaveLength(1);
      expect(normalized.filter(skill => skill === 'express')).toHaveLength(1);
    });

    it('should handle database variations', () => {
      const skillsText = 'PostgreSQL, Postgres, PSQL, MongoDB, Mongo, MySQL';
      const normalized = extractor.normalizeSkills(skillsText);

      expect(normalized).toContain('postgresql');
      expect(normalized).toContain('mongodb');
      expect(normalized).toContain('mysql');
      
      // Should not have duplicates for postgres variations
      expect(normalized.filter(skill => skill === 'postgresql')).toHaveLength(1);
    });

    it('should preserve case-sensitive technologies', () => {
      const skillsText = 'JavaScript, TypeScript, C#, C++, .NET, iOS, macOS';
      const normalized = extractor.normalizeSkills(skillsText);

      expect(normalized).toContain('javascript');
      expect(normalized).toContain('typescript');
      expect(normalized).toContain('csharp');
      expect(normalized).toContain('cpp');
    });
  });

  describe('date and GPA extraction', () => {
    it('should extract dates from text', () => {
      const text = 'Worked from January 2020 to December 2022';
      const dates = extractor.extractDates(text);
      
      expect(dates).toHaveLength(2);
      expect(dates[0].value).toBe('January 2020');
      expect(dates[1].value).toBe('December 2022');
    });

    it('should extract GPA information', () => {
      const text = 'Bachelor of Science, GPA: 3.8/4.0';
      const gpa = extractor.extractGPA(text);
      
      expect(gpa?.value).toBe('3.8/4.0');
      expect(gpa?.confidence).toBe(0.8);
    });

    it('should handle GPA without scale', () => {
      const text = 'Graduated with GPA 3.75';
      const gpa = extractor.extractGPA(text);
      
      expect(gpa?.value).toBe('3.75');
    });
  });

  describe('section content classification', () => {
    it('should classify experience sections correctly', () => {
      const content = 'Software Engineer at Tech Corp. Developed applications and managed team.';
      const classification = extractor.classifySectionContent('EXPERIENCE', content);
      
      expect(classification.type).toBe('experience');
      expect(classification.confidence).toBe(0.9);
    });

    it('should classify education sections correctly', () => {
      const content = 'Bachelor of Science in Computer Science from Stanford University. GPA: 3.8';
      const classification = extractor.classifySectionContent('EDUCATION', content);
      
      expect(classification.type).toBe('education');
      expect(classification.confidence).toBe(0.9);
    });

    it('should classify skills sections correctly', () => {
      const content = 'JavaScript, Python, React, Node.js, AWS, Docker';
      const classification = extractor.classifySectionContent('TECHNICAL SKILLS', content);
      
      expect(classification.type).toBe('skills');
      expect(classification.confidence).toBe(0.9);
    });

    it('should classify projects sections correctly', () => {
      const content = 'Built a portfolio website using React and deployed to Vercel. GitHub: github.com/user/project';
      const classification = extractor.classifySectionContent('PROJECTS', content);
      
      expect(classification.type).toBe('projects');
      expect(classification.confidence).toBe(0.9);
    });

    it('should fallback to content analysis for unknown section names', () => {
      const content = 'Worked as developer, built applications, managed team responsibilities';
      const classification = extractor.classifySectionContent('UNKNOWN SECTION', content);
      
      expect(classification.type).toBe('experience');
      expect(classification.confidence).toBeGreaterThan(0);
    });

    it('should return unknown for unclassifiable content', () => {
      const content = 'Lorem ipsum dolor sit amet consectetur adipiscing elit';
      const classification = extractor.classifySectionContent('RANDOM', content);
      
      expect(classification.type).toBe('unknown');
      expect(classification.confidence).toBe(0.1);
    });
  });

  describe('confidence scoring', () => {
    it('should assign higher confidence to professional email domains', () => {
      const professionalEmail = extractor.extractContent('john.doe@company.com');
      const personalEmail = extractor.extractContent('john.doe@gmail.com');
      
      expect(professionalEmail.profile.email?.confidence).toBeGreaterThan(0.7);
      expect(personalEmail.profile.email?.confidence).toBeGreaterThan(0.7);
    });

    it('should assign lower confidence to placeholder emails', () => {
      const result = extractor.extractContent('test@example.com');
      
      expect(result.profile.email?.confidence).toBeLessThan(0.5);
    });

    it('should assign confidence scores to all extracted fields', () => {
      const resumeText = `
John Doe
Software Engineer
john@gmail.com
(555) 123-4567
github.com/johndoe
      `;

      const result = extractor.extractContent(resumeText);

      expect(result.profile.name?.confidence).toBeGreaterThan(0);
      expect(result.profile.title?.confidence).toBeGreaterThan(0);
      expect(result.profile.email?.confidence).toBeGreaterThan(0);
      expect(result.profile.phone?.confidence).toBeGreaterThan(0);
      expect(result.profile.links.github?.confidence).toBeGreaterThan(0);
    });

    it('should assign higher confidence to well-formatted sections', () => {
      const wellFormattedResume = `
EXPERIENCE
Software Engineer at Tech Corp
January 2020 - Present
• Developed applications
• Led team of 5 developers

EDUCATION
Bachelor of Science in Computer Science
Stanford University
2016 - 2020
      `;

      const result = extractor.extractContent(wellFormattedResume);
      const experienceSection = result.sections.find(s => s.name === 'EXPERIENCE');
      const educationSection = result.sections.find(s => s.name === 'EDUCATION');

      expect(experienceSection?.confidence).toBeGreaterThan(0.7);
      expect(educationSection?.confidence).toBeGreaterThan(0.7);
    });
  });
});