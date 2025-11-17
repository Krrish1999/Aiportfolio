import { ParsedResumeData, Template } from '../types';
import { SEOConfig } from './deployment';

export interface CustomizationOptions {
  primaryColor?: string;
  fontFamily?: string;
  fontSize?: 'small' | 'medium' | 'large';
  spacing?: number;
  theme?: 'light' | 'dark';
}

export interface StaticSite {
  html: string;
  css: string;
  metadata: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

/**
 * Static Site Generator Service
 * Generates deployable HTML/CSS/JS files from resume data
 */
export class StaticSiteGenerator {
  /**
   * Generate a complete static site from resume data
   */
  generateSite(
    data: ParsedResumeData,
    template: Template,
    customizations: CustomizationOptions = {},
    seoConfig?: SEOConfig
  ): StaticSite {
    const css = this.generateCSS(template, customizations);
    const html = this.generateHTML(data, template, customizations, seoConfig);
    const metadata = this.extractMetadata(data, seoConfig);

    return {
      html,
      css,
      metadata,
    };
  }

  /**
   * Generate HTML with SEO optimization
   */
  private generateHTML(
    data: ParsedResumeData,
    template: Template,
    customizations: CustomizationOptions,
    seoConfig?: SEOConfig
  ): string {
    const title = seoConfig?.title || `${data.profile.name} - ${data.profile.title}`;
    const description = seoConfig?.description || data.summary.substring(0, 160);
    const keywords = seoConfig?.keywords || this.extractKeywords(data);
    
    const structuredData = this.generateStructuredData(data);
    const metaTags = this.generateMetaTags(title, description, keywords, seoConfig?.ogImage);
    const bodyContent = this.generateBody(data, template, customizations);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${metaTags}
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">
${structuredData}
  </script>
</head>
${bodyContent}
</html>`;
  }

  /**
   * Generate meta tags for SEO
   */
  private generateMetaTags(
    title: string,
    description: string,
    keywords: string[],
    ogImage?: string
  ): string {
    const canonicalUrl = typeof window !== 'undefined' ? window.location.href : '';
    
    return `  <title>${this.escapeHtml(title)}</title>
  <meta name="description" content="${this.escapeHtml(description)}">
  <meta name="keywords" content="${keywords.map(k => this.escapeHtml(k)).join(', ')}">
  <meta name="author" content="${this.escapeHtml(title.split(' - ')[0])}">
  <meta name="robots" content="index, follow">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${this.escapeHtml(title)}">
  <meta property="og:description" content="${this.escapeHtml(description)}">
  ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonicalUrl}">
  <meta property="twitter:title" content="${this.escapeHtml(title)}">
  <meta property="twitter:description" content="${this.escapeHtml(description)}">
  ${ogImage ? `<meta property="twitter:image" content="${ogImage}">` : ''}`;
  }

  /**
   * Generate structured data (JSON-LD) for SEO
   */
  private generateStructuredData(data: ParsedResumeData): string {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: data.profile.name,
      jobTitle: data.profile.title,
      email: data.profile.email,
      telephone: data.profile.phone,
      url: data.profile.links.website || data.profile.links.portfolio,
      sameAs: [
        data.profile.links.github,
        data.profile.links.linkedin,
      ].filter(Boolean),
      address: data.profile.location ? {
        '@type': 'PostalAddress',
        addressLocality: data.profile.location,
      } : undefined,
      alumniOf: data.education.map(edu => ({
        '@type': 'EducationalOrganization',
        name: edu.institution,
      })),
      knowsAbout: data.skills.flatMap(s => s.items),
    };
    
    // Return as escaped JSON string
    return JSON.stringify(structuredData, null, 2)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e');
  }

  /**
   * Generate body content based on template
   */
  private generateBody(
    data: ParsedResumeData,
    template: Template,
    customizations: CustomizationOptions
  ): string {
    const theme = customizations.theme || 'light';
    
    return `<body class="theme-${theme}">
  <div class="container">
    <header class="profile-section">
      ${this.generateProfileSection(data.profile)}
    </header>
    
    <main>
      ${template.sections.map(section => {
        switch (section.type) {
          case 'summary':
            return this.generateSummarySection(data.summary);
          case 'skills':
            return this.generateSkillsSection(data.skills);
          case 'experience':
            return this.generateExperienceSection(data.experience);
          case 'projects':
            return this.generateProjectsSection(data.projects);
          case 'education':
            return this.generateEducationSection(data.education);
          case 'certifications':
            return data.certifications ? this.generateCertificationsSection(data.certifications) : '';
          default:
            return '';
        }
      }).join('\n')}
    </main>
    
    <footer>
      <p>Last updated: ${new Date().toLocaleDateString()}</p>
    </footer>
  </div>
</body>`;
  }

  /**
   * Generate profile section HTML
   */
  private generateProfileSection(profile: ParsedResumeData['profile']): string {
    return `<div class="profile">
        <h1>${this.escapeHtml(profile.name)}</h1>
        <p class="title">${this.escapeHtml(profile.title)}</p>
        ${profile.location ? `<p class="location">${this.escapeHtml(profile.location)}</p>` : ''}
        <div class="contact">
          <a href="mailto:${profile.email}">${this.escapeHtml(profile.email)}</a>
          ${profile.phone ? `<span>${this.escapeHtml(profile.phone)}</span>` : ''}
        </div>
        <div class="links">
          ${profile.links.github ? `<a href="${profile.links.github}" target="_blank" rel="noopener noreferrer">GitHub</a>` : ''}
          ${profile.links.linkedin ? `<a href="${profile.links.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : ''}
          ${profile.links.website ? `<a href="${profile.links.website}" target="_blank" rel="noopener noreferrer">Website</a>` : ''}
        </div>
      </div>`;
  }

  /**
   * Generate summary section HTML
   */
  private generateSummarySection(summary: string): string {
    return `<section class="summary-section">
        <h2>About</h2>
        <p>${this.escapeHtml(summary)}</p>
      </section>`;
  }

  /**
   * Generate skills section HTML
   */
  private generateSkillsSection(skills: ParsedResumeData['skills']): string {
    return `<section class="skills-section">
        <h2>Skills</h2>
        ${skills.map(category => `
          <div class="skill-category">
            <h3>${this.escapeHtml(category.category)}</h3>
            <ul>
              ${category.items.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </section>`;
  }

  /**
   * Generate experience section HTML
   */
  private generateExperienceSection(experience: ParsedResumeData['experience']): string {
    return `<section class="experience-section">
        <h2>Experience</h2>
        ${experience.map(exp => `
          <div class="experience-item">
            <h3>${this.escapeHtml(exp.role)}</h3>
            <p class="company">${this.escapeHtml(exp.company)}</p>
            <p class="date">${this.formatDate(exp.startDate)} - ${exp.endDate ? this.formatDate(exp.endDate) : 'Present'}</p>
            <ul>
              ${exp.bullets.map(bullet => `<li>${this.escapeHtml(bullet)}</li>`).join('')}
            </ul>
            ${exp.techStack.length > 0 ? `
              <div class="tech-stack">
                <strong>Technologies:</strong> ${exp.techStack.map(tech => this.escapeHtml(tech)).join(', ')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </section>`;
  }

  /**
   * Generate projects section HTML
   */
  private generateProjectsSection(projects: ParsedResumeData['projects']): string {
    return `<section class="projects-section">
        <h2>Projects</h2>
        ${projects.map(project => `
          <div class="project-item">
            <h3>${this.escapeHtml(project.name)}</h3>
            ${project.role ? `<p class="role">${this.escapeHtml(project.role)}</p>` : ''}
            <p>${this.escapeHtml(project.description)}</p>
            ${project.techStack.length > 0 ? `
              <div class="tech-stack">
                ${project.techStack.map(tech => `<span class="tech-tag">${this.escapeHtml(tech)}</span>`).join('')}
              </div>
            ` : ''}
            <div class="project-links">
              ${project.links.repo ? `<a href="${project.links.repo}" target="_blank" rel="noopener noreferrer">Repository</a>` : ''}
              ${project.links.demo ? `<a href="${project.links.demo}" target="_blank" rel="noopener noreferrer">Live Demo</a>` : ''}
            </div>
          </div>
        `).join('')}
      </section>`;
  }

  /**
   * Generate education section HTML
   */
  private generateEducationSection(education: ParsedResumeData['education']): string {
    return `<section class="education-section">
        <h2>Education</h2>
        ${education.map(edu => `
          <div class="education-item">
            <h3>${this.escapeHtml(edu.degree)}</h3>
            <p class="institution">${this.escapeHtml(edu.institution)}</p>
            <p class="date">${this.formatDate(edu.startDate)} - ${edu.endDate ? this.formatDate(edu.endDate) : 'Present'}</p>
            ${edu.gpa ? `<p class="gpa">GPA: ${this.escapeHtml(edu.gpa)}</p>` : ''}
          </div>
        `).join('')}
      </section>`;
  }

  /**
   * Generate certifications section HTML
   */
  private generateCertificationsSection(certifications: NonNullable<ParsedResumeData['certifications']>): string {
    return `<section class="certifications-section">
        <h2>Certifications</h2>
        ${certifications.map(cert => `
          <div class="certification-item">
            <h3>${this.escapeHtml(cert.name)}</h3>
            <p class="issuer">${this.escapeHtml(cert.issuer)}</p>
            <p class="date">${this.formatDate(cert.date)}</p>
            ${cert.url ? `<a href="${cert.url}" target="_blank" rel="noopener noreferrer">View Certificate</a>` : ''}
          </div>
        `).join('')}
      </section>`;
  }

  /**
   * Generate CSS based on template and customizations
   */
  private generateCSS(template: Template, customizations: CustomizationOptions): string {
    const primaryColor = customizations.primaryColor || '#3B82F6';
    const fontFamily = customizations.fontFamily || 'Inter';
    const fontSize = this.getFontSizeValue(customizations.fontSize || 'medium');
    const spacing = customizations.spacing || 2;
    const theme = customizations.theme || 'light';

    const colors = theme === 'dark' ? {
      background: '#1a1a1a',
      text: '#e5e5e5',
      secondary: '#a3a3a3',
      border: '#404040',
    } : {
      background: '#ffffff',
      text: '#1a1a1a',
      secondary: '#666666',
      border: '#e5e5e5',
    };

    return `/* Reset and Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: ${fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: ${fontSize}px;
  line-height: 1.6;
  color: ${colors.text};
  background-color: ${colors.background};
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: ${spacing * 2}rem;
}

/* Profile Section */
.profile-section {
  text-align: center;
  padding: ${spacing * 2}rem 0;
  border-bottom: 2px solid ${primaryColor};
  margin-bottom: ${spacing * 2}rem;
}

.profile h1 {
  font-size: ${fontSize * 2}px;
  font-weight: 700;
  margin-bottom: ${spacing * 0.5}rem;
  color: ${colors.text};
}

.profile .title {
  font-size: ${fontSize * 1.2}px;
  color: ${primaryColor};
  font-weight: 600;
  margin-bottom: ${spacing * 0.5}rem;
}

.profile .location {
  color: ${colors.secondary};
  margin-bottom: ${spacing}rem;
}

.contact {
  display: flex;
  justify-content: center;
  gap: ${spacing}rem;
  margin: ${spacing}rem 0;
  flex-wrap: wrap;
}

.contact a {
  color: ${colors.text};
  text-decoration: none;
}

.contact a:hover {
  color: ${primaryColor};
}

.links {
  display: flex;
  justify-content: center;
  gap: ${spacing}rem;
  margin-top: ${spacing}rem;
  flex-wrap: wrap;
}

.links a {
  color: ${primaryColor};
  text-decoration: none;
  font-weight: 500;
}

.links a:hover {
  text-decoration: underline;
}

/* Section Styles */
section {
  margin-bottom: ${spacing * 3}rem;
}

section h2 {
  font-size: ${fontSize * 1.5}px;
  font-weight: 700;
  color: ${primaryColor};
  margin-bottom: ${spacing * 1.5}rem;
  padding-bottom: ${spacing * 0.5}rem;
  border-bottom: 1px solid ${colors.border};
}

section h3 {
  font-size: ${fontSize * 1.2}px;
  font-weight: 600;
  margin-bottom: ${spacing * 0.5}rem;
  color: ${colors.text};
}

/* Summary Section */
.summary-section p {
  line-height: 1.8;
  color: ${colors.text};
}

/* Skills Section */
.skill-category {
  margin-bottom: ${spacing * 1.5}rem;
}

.skill-category h3 {
  font-size: ${fontSize * 1.1}px;
  color: ${colors.text};
  margin-bottom: ${spacing * 0.5}rem;
}

.skill-category ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing * 0.5}rem;
}

.skill-category li {
  background-color: ${primaryColor}20;
  color: ${primaryColor};
  padding: ${spacing * 0.25}rem ${spacing * 0.75}rem;
  border-radius: 4px;
  font-size: ${fontSize * 0.9}px;
}

/* Experience Section */
.experience-item,
.project-item,
.education-item,
.certification-item {
  margin-bottom: ${spacing * 2}rem;
}

.company,
.institution,
.issuer {
  color: ${colors.secondary};
  font-weight: 500;
  margin-bottom: ${spacing * 0.25}rem;
}

.date {
  color: ${colors.secondary};
  font-size: ${fontSize * 0.9}px;
  margin-bottom: ${spacing}rem;
}

.experience-item ul,
.project-item ul {
  list-style-position: inside;
  margin-left: ${spacing}rem;
  margin-top: ${spacing * 0.5}rem;
}

.experience-item li,
.project-item li {
  margin-bottom: ${spacing * 0.5}rem;
  color: ${colors.text};
}

.tech-stack {
  margin-top: ${spacing}rem;
  color: ${colors.secondary};
  font-size: ${fontSize * 0.9}px;
}

/* Projects Section */
.tech-tag {
  display: inline-block;
  background-color: ${colors.border};
  color: ${colors.text};
  padding: ${spacing * 0.25}rem ${spacing * 0.5}rem;
  border-radius: 3px;
  font-size: ${fontSize * 0.85}px;
  margin-right: ${spacing * 0.5}rem;
  margin-bottom: ${spacing * 0.5}rem;
}

.project-links {
  margin-top: ${spacing}rem;
}

.project-links a {
  color: ${primaryColor};
  text-decoration: none;
  margin-right: ${spacing}rem;
  font-weight: 500;
}

.project-links a:hover {
  text-decoration: underline;
}

/* Footer */
footer {
  text-align: center;
  padding: ${spacing * 2}rem 0;
  color: ${colors.secondary};
  font-size: ${fontSize * 0.9}px;
  border-top: 1px solid ${colors.border};
}

/* Responsive Design */
@media (max-width: 768px) {
  .container {
    padding: ${spacing}rem;
  }
  
  .profile h1 {
    font-size: ${fontSize * 1.5}px;
  }
  
  section h2 {
    font-size: ${fontSize * 1.3}px;
  }
  
  .contact,
  .links {
    flex-direction: column;
    align-items: center;
    gap: ${spacing * 0.5}rem;
  }
}

@media print {
  body {
    background-color: white;
    color: black;
  }
  
  .container {
    max-width: 100%;
  }
  
  a {
    color: black;
    text-decoration: underline;
  }
}`;
  }

  /**
   * Generate sitemap.xml
   */
  generateSitemap(baseUrl: string, entries: SitemapEntry[] = []): string {
    const defaultEntry: SitemapEntry = {
      url: baseUrl,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'monthly',
      priority: 1.0,
    };

    const allEntries = entries.length > 0 ? entries : [defaultEntry];

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.map(entry => `  <url>
    <loc>${this.escapeXml(entry.url)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`).join('\n')}
</urlset>`;
  }

  /**
   * Generate robots.txt
   */
  generateRobotsTxt(sitemapUrl?: string): string {
    return `User-agent: *
Allow: /

${sitemapUrl ? `Sitemap: ${sitemapUrl}` : ''}`;
  }

  /**
   * Validate mobile responsiveness
   */
  validateMobileResponsive(html: string, css: string): {
    isResponsive: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for viewport meta tag
    if (!html.includes('name="viewport"')) {
      issues.push('Missing viewport meta tag');
    }

    // Check for media queries in CSS
    if (!css.includes('@media')) {
      issues.push('No media queries found in CSS');
    }

    // Check for responsive units
    const hasResponsiveUnits = /\d+(rem|em|%|vw|vh)/.test(css);
    if (!hasResponsiveUnits) {
      issues.push('CSS should use responsive units (rem, em, %, vw, vh)');
    }

    return {
      isResponsive: issues.length === 0,
      issues,
    };
  }

  /**
   * Extract metadata from resume data
   */
  private extractMetadata(data: ParsedResumeData, seoConfig?: SEOConfig): {
    title: string;
    description: string;
    keywords: string[];
  } {
    return {
      title: seoConfig?.title || `${data.profile.name} - ${data.profile.title}`,
      description: seoConfig?.description || data.summary.substring(0, 160),
      keywords: seoConfig?.keywords || this.extractKeywords(data),
    };
  }

  /**
   * Extract keywords from resume data
   */
  private extractKeywords(data: ParsedResumeData): string[] {
    const keywords = new Set<string>();
    
    // Add skills
    data.skills.forEach(category => {
      category.items.forEach(item => keywords.add(item.toLowerCase()));
    });
    
    // Add tech stack from experience
    data.experience.forEach(exp => {
      exp.techStack.forEach(tech => keywords.add(tech.toLowerCase()));
    });
    
    // Add tech stack from projects
    data.projects.forEach(project => {
      project.techStack.forEach(tech => keywords.add(tech.toLowerCase()));
    });
    
    // Add role-related keywords
    keywords.add(data.profile.title.toLowerCase());
    keywords.add('developer');
    keywords.add('portfolio');
    
    return Array.from(keywords).slice(0, 20);
  }

  /**
   * Get font size value in pixels
   */
  private getFontSizeValue(size: 'small' | 'medium' | 'large'): number {
    const sizes = {
      small: 14,
      medium: 16,
      large: 18,
    };
    return sizes[size];
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Export singleton instance
export const staticSiteGenerator = new StaticSiteGenerator();
