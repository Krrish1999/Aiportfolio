import { env } from '../config/env';
import { ParsedResumeData, GitHubData } from '../types';
import { CloudflareWorkersEnv } from '../config/cloudflare-env';
import { CloudflareAIService } from './cloudflare-ai';
import { contentModerationService } from './content-moderation';

export interface AIContentGeneratorService {
  enhanceBio(originalBio: string, experience: ParsedResumeData['experience'], role?: DeveloperRole): Promise<string>;
  rewriteBullets(bullets: string[], role: string, techStack: string[]): Promise<string[]>;
  generateProjectDescriptions(projects: ParsedResumeData['projects']): Promise<ParsedResumeData['projects']>;
  enrichWithGitHub(data: ParsedResumeData, githubData: any): Promise<ParsedResumeData>;
}

export type DeveloperRole = 'frontend' | 'backend' | 'full-stack' | 'ml' | 'devops' | 'mobile' | 'general';

export type AIProvider = 'openrouter' | 'cloudflare';

export interface AIProviderConfig {
  primaryProvider: AIProvider;
  enableFallback: boolean;
  cloudflareEnv?: CloudflareWorkersEnv;
}

class AIContentGenerator implements AIContentGeneratorService {
  private config: AIProviderConfig;
  private cloudflareAI?: CloudflareAIService;

  constructor(config?: Partial<AIProviderConfig>) {
    // Determine provider configuration from environment
    const aiProvider = env.AI_PROVIDER || 'openrouter';
    const enableCloudflareAI = env.ENABLE_CLOUDFLARE_AI === 'true';
    const enableFallback = env.AI_FALLBACK_ENABLED !== 'false';

    this.config = {
      primaryProvider: config?.primaryProvider || (aiProvider === 'cloudflare' ? 'cloudflare' : 'openrouter'),
      enableFallback: config?.enableFallback ?? enableFallback,
      cloudflareEnv: config?.cloudflareEnv,
    };

    // Initialize Cloudflare AI if available and enabled
    if (this.config.cloudflareEnv?.AI && enableCloudflareAI) {
      this.cloudflareAI = new CloudflareAIService(this.config.cloudflareEnv);
    }
  }

  /**
   * Enhance bio and summary with tech-focused language
   * Requirement 3.1: Generate tech-forward introduction based on user's experience and role focus
   * Requirement 3.4: Create bio summary based on experience and role focus
   * Requirement 7.1: Support both OpenRouter and Cloudflare AI Workers as providers
   * Requirement 7.3: Implement automatic fallback when primary provider fails
   */
  async enhanceBio(
    originalBio: string, 
    experience: ParsedResumeData['experience'], 
    role: DeveloperRole = 'general'
  ): Promise<string> {
    const prompt = this.createBioPrompt(originalBio, experience, role);
    
    let enhancedBio: string;
    
    try {
      // Try primary provider
      if (this.config.primaryProvider === 'cloudflare' && this.cloudflareAI) {
        enhancedBio = await this.enhanceBioWithCloudflare(prompt, originalBio, experience, role);
      } else {
        enhancedBio = await this.enhanceBioWithOpenRouter(prompt, originalBio, experience, role);
      }
    } catch (primaryError) {
      console.error(`Error with primary provider (${this.config.primaryProvider}):`, primaryError);
      
      // Try fallback provider if enabled
      if (this.config.enableFallback) {
        try {
          if (this.config.primaryProvider === 'openrouter' && this.cloudflareAI) {
            console.log('Falling back to Cloudflare AI...');
            enhancedBio = await this.enhanceBioWithCloudflare(prompt, originalBio, experience, role);
          } else if (this.config.primaryProvider === 'cloudflare') {
            console.log('Falling back to OpenRouter...');
            enhancedBio = await this.enhanceBioWithOpenRouter(prompt, originalBio, experience, role);
          } else {
            enhancedBio = originalBio || this.generateDefaultBio(experience, role);
          }
        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError);
          enhancedBio = originalBio || this.generateDefaultBio(experience, role);
        }
      } else {
        enhancedBio = originalBio || this.generateDefaultBio(experience, role);
      }
    }
    
    // Moderate content for safety and appropriateness
    const moderationResult = await contentModerationService.moderateContent(enhancedBio, 'bio');
    
    if (!moderationResult.safe) {
      console.warn('Bio content flagged during moderation:', moderationResult.flagged);
      // Return sanitized content or original bio if moderation fails
      return moderationResult.sanitizedContent || originalBio || this.generateDefaultBio(experience, role);
    }
    
    return enhancedBio;
  }

  /**
   * Enhance bio using OpenRouter
   */
  private async enhanceBioWithOpenRouter(
    prompt: string,
    originalBio: string,
    experience: ParsedResumeData['experience'],
    role: DeveloperRole
  ): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-resume-portfolio.pages.dev',
        'X-Title': 'AI Resume Portfolio',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical writer specializing in developer portfolios. Create compelling, professional bio summaries that highlight technical expertise and career achievements.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const enhancedBio = data.choices?.[0]?.message?.content?.trim();
    
    if (!enhancedBio) {
      throw new Error('Failed to generate enhanced bio from OpenRouter');
    }

    return enhancedBio;
  }

  /**
   * Enhance bio using Cloudflare AI
   */
  private async enhanceBioWithCloudflare(
    prompt: string,
    originalBio: string,
    experience: ParsedResumeData['experience'],
    role: DeveloperRole
  ): Promise<string> {
    if (!this.cloudflareAI) {
      throw new Error('Cloudflare AI not available');
    }

    const context = `${role} developer with ${this.calculateYearsOfExperience(experience)} years experience`;
    return await this.cloudflareAI.enhanceBio(originalBio, context);
  }

  /**
   * Rewrite experience bullets with impact-focused language
   * Requirement 3.1: Rewrite job responsibilities into impact-focused bullets with metrics
   * Requirement 3.2: Identify and highlight relevant technical skills and technologies
   * Requirement 7.1: Support both OpenRouter and Cloudflare AI Workers as providers
   * Requirement 7.3: Implement automatic fallback when primary provider fails
   */
  async rewriteBullets(bullets: string[], role: string, techStack: string[]): Promise<string[]> {
    if (!bullets.length) return [];

    // Extract existing metrics and enhance them
    const metricsEnhanced = this.extractAndEnhanceMetrics(bullets);
    const prompt = this.createBulletPrompt(metricsEnhanced, role, techStack);
    
    let parsedBullets: string[];
    
    try {
      // Try primary provider
      if (this.config.primaryProvider === 'cloudflare' && this.cloudflareAI) {
        parsedBullets = await this.rewriteBulletsWithCloudflare(metricsEnhanced, role, techStack);
      } else {
        parsedBullets = await this.rewriteBulletsWithOpenRouter(prompt);
      }
    } catch (primaryError) {
      console.error(`Error with primary provider (${this.config.primaryProvider}):`, primaryError);
      
      // Try fallback provider if enabled
      if (this.config.enableFallback) {
        try {
          if (this.config.primaryProvider === 'openrouter' && this.cloudflareAI) {
            console.log('Falling back to Cloudflare AI...');
            parsedBullets = await this.rewriteBulletsWithCloudflare(metricsEnhanced, role, techStack);
          } else if (this.config.primaryProvider === 'cloudflare') {
            console.log('Falling back to OpenRouter...');
            parsedBullets = await this.rewriteBulletsWithOpenRouter(prompt);
          } else {
            parsedBullets = bullets;
          }
        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError);
          parsedBullets = bullets;
        }
      } else {
        parsedBullets = bullets;
      }
    }
    
    // Moderate each bullet point for safety
    const moderationResults = await contentModerationService.moderateBatch(parsedBullets, 'bullet');
    const moderatedBullets = parsedBullets.map((bullet, index) => {
      const result = moderationResults[index];
      if (!result.safe) {
        console.warn(`Bullet point flagged during moderation:`, result.flagged);
        return result.sanitizedContent || bullets[index] || bullet;
      }
      return bullet;
    });
    
    // Identify and highlight technical skills in the enhanced bullets
    return this.highlightTechnicalSkills(moderatedBullets, techStack);
  }

  /**
   * Rewrite bullets using OpenRouter
   */
  private async rewriteBulletsWithOpenRouter(prompt: string): Promise<string[]> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-resume-portfolio.pages.dev',
        'X-Title': 'AI Resume Portfolio',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert resume writer specializing in technical roles. Transform job responsibilities into impact-focused bullet points that highlight achievements, metrics, and technical skills.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const enhancedBullets = data.choices?.[0]?.message?.content?.trim();
    
    if (!enhancedBullets) {
      throw new Error('Failed to generate enhanced bullets from OpenRouter');
    }

    return this.parseBulletResponse(enhancedBullets);
  }

  /**
   * Rewrite bullets using Cloudflare AI
   */
  private async rewriteBulletsWithCloudflare(
    bullets: string[],
    role: string,
    techStack: string[]
  ): Promise<string[]> {
    if (!this.cloudflareAI) {
      throw new Error('Cloudflare AI not available');
    }

    return await this.cloudflareAI.rewriteBullets(bullets, role, techStack);
  }

  /**
   * Extract existing metrics from bullets and suggest enhancements
   * Requirement 3.1: Implement metric extraction and enhancement for quantifiable achievements
   */
  private extractAndEnhanceMetrics(bullets: string[]): string[] {
    return bullets.map(bullet => {
      // Look for existing metrics and suggest improvements
      const metricPatterns = [
        /(\d+)%/g,           // Percentages
        /(\d+) users?/gi,    // User counts
        /(\d+) months?/gi,   // Time periods
        /(\d+) weeks?/gi,
        /(\d+) years?/gi,
        /\$(\d+)/g,          // Dollar amounts
        /(\d+)x/gi,          // Multipliers
        /(\d+) times?/gi,    // Frequency
      ];

      let enhancedBullet = bullet;
      
      // If no metrics found, suggest where they could be added
      const hasMetrics = metricPatterns.some(pattern => pattern.test(bullet));
      if (!hasMetrics) {
        // Add placeholder suggestions for common metrics
        if (bullet.toLowerCase().includes('improve') || bullet.toLowerCase().includes('increase')) {
          enhancedBullet += ' [Consider adding: by X% or X amount]';
        }
        if (bullet.toLowerCase().includes('reduce') || bullet.toLowerCase().includes('decrease')) {
          enhancedBullet += ' [Consider adding: by X% or X time]';
        }
        if (bullet.toLowerCase().includes('develop') || bullet.toLowerCase().includes('build')) {
          enhancedBullet += ' [Consider adding: serving X users or handling X requests]';
        }
      }

      return enhancedBullet;
    });
  }

  /**
   * Identify and highlight technical skills in bullet points
   * Requirement 3.2: Add technical skill identification and highlighting in job descriptions
   */
  private highlightTechnicalSkills(bullets: string[], techStack: string[]): string[] {
    // Common technical skills and technologies to identify with their variations
    const skillMappings = new Map([
      // Frontend
      ['React', ['react', 'reactjs', 'react.js']],
      ['Vue', ['vue', 'vuejs', 'vue.js']],
      ['Angular', ['angular', 'angularjs']],
      ['JavaScript', ['javascript', 'js']],
      ['TypeScript', ['typescript', 'ts']],
      // Backend
      ['Node.js', ['nodejs', 'node.js', 'node']],
      ['Python', ['python']],
      ['Java', ['java']],
      ['C#', ['c#', 'csharp']],
      // Databases
      ['PostgreSQL', ['postgresql', 'postgres']],
      ['MySQL', ['mysql']],
      ['MongoDB', ['mongodb', 'mongo']],
      ['Redis', ['redis']],
      // Cloud & DevOps
      ['AWS', ['aws', 'amazon web services']],
      ['Docker', ['docker']],
      ['Kubernetes', ['kubernetes', 'k8s']],
      // Tools & Frameworks
      ['REST', ['rest', 'restful']],
      ['API', ['api', 'apis']],
      ['GraphQL', ['graphql']],
      ['Git', ['git']],
    ]);

    // Add tech stack items to skill mappings
    techStack.forEach(skill => {
      if (!skillMappings.has(skill)) {
        skillMappings.set(skill, [skill.toLowerCase()]);
      }
    });

    return bullets.map(bullet => {
      let enhancedBullet = bullet;
      
      // Replace variations with proper capitalization
      skillMappings.forEach((variations, properName) => {
        variations.forEach(variation => {
          const regex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          enhancedBullet = enhancedBullet.replace(regex, properName);
        });
      });

      return enhancedBullet;
    });
  }

  /**
   * Generate project descriptions with problem/approach/results structure
   * Requirement 3.3: Create concise summaries including problem, approach, technologies, and results
   * Requirement 4.2: Extract README snippets and technology tags from repositories
   */
  async generateProjectDescriptions(projects: ParsedResumeData['projects']): Promise<ParsedResumeData['projects']> {
    const enhancedProjects = await Promise.all(
      projects.map(async (project) => {
        let enhancedProject = { ...project };

        // Extract and categorize technology stack
        enhancedProject.techStack = this.extractAndCategorizeTechStack(project.techStack, project.description);

        if (!project.description || project.description.length <= 25) {
          // Only enhance if description is missing or very short
          const enhancedDescription = await this.enhanceProjectDescription(enhancedProject);
          
          // Moderate project description for safety
          const moderationResult = await contentModerationService.moderateContent(enhancedDescription, 'project');
          
          if (!moderationResult.safe) {
            console.warn('Project description flagged during moderation:', moderationResult.flagged);
            enhancedProject.description = moderationResult.sanitizedContent || project.description;
          } else {
            enhancedProject.description = enhancedDescription;
          }
        }

        return enhancedProject;
      })
    );

    return enhancedProjects;
  }

  /**
   * Extract and categorize technology stack from project data
   * Requirement 4.2: Implement technology stack extraction and categorization
   */
  private extractAndCategorizeTechStack(existingTechStack: string[], description: string): string[] {
    // Technology categories for better organization with variations
    const techCategories = {
      frontend: ['React', 'Vue', 'Angular', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'SCSS', 'Tailwind', 'Bootstrap', 'Material-UI', 'Chakra UI'],
      backend: ['Node.js', 'Python', 'Java', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Express', 'FastAPI', 'Spring', 'Django', 'Flask'],
      database: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Elasticsearch', 'DynamoDB', 'Firestore'],
      cloud: ['AWS', 'Azure', 'GCP', 'Vercel', 'Netlify', 'Heroku', 'DigitalOcean'],
      tools: ['Docker', 'Kubernetes', 'Git', 'Jenkins', 'GitHub Actions', 'Webpack', 'Vite', 'Babel'],
      mobile: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Ionic'],
      ai: ['TensorFlow', 'PyTorch', 'OpenAI', 'Hugging Face', 'Scikit-learn', 'Pandas', 'NumPy']
    };

    // Technology name variations for case-insensitive and format-insensitive matching
    const techVariations: Map<string, string[]> = new Map([
      ['React', ['react', 'reactjs', 'react.js']],
      ['Vue', ['vue', 'vuejs', 'vue.js']],
      ['Angular', ['angular', 'angularjs']],
      ['JavaScript', ['javascript', 'js']],
      ['TypeScript', ['typescript', 'ts']],
      ['Node.js', ['nodejs', 'node.js', 'node']],
      ['PostgreSQL', ['postgresql', 'postgres', 'psql']],
      ['MongoDB', ['mongodb', 'mongo']],
      ['React Native', ['react native', 'react-native', 'reactnative']],
      ['Material-UI', ['material-ui', 'material ui', 'mui']],
      ['Chakra UI', ['chakra-ui', 'chakra ui', 'chakraui']],
      ['Tailwind', ['tailwind', 'tailwindcss', 'tailwind css']],
      ['GitHub Actions', ['github actions', 'github-actions']],
      ['Hugging Face', ['hugging face', 'huggingface']],
      ['Scikit-learn', ['scikit-learn', 'scikit learn', 'sklearn']],
    ]);

    // Extract technologies from description
    const allTechnologies = Object.values(techCategories).flat();
    const extractedTech = new Set(existingTechStack);

    // Look for technologies mentioned in the description
    allTechnologies.forEach(tech => {
      // Check main name
      const mainRegex = new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (mainRegex.test(description)) {
        extractedTech.add(tech);
        return;
      }

      // Check variations
      const variations = techVariations.get(tech);
      if (variations) {
        for (const variation of variations) {
          const varRegex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          if (varRegex.test(description)) {
            extractedTech.add(tech);
            return;
          }
        }
      }
    });

    // Sort technologies by category for better presentation
    const sortedTech: string[] = [];
    Object.values(techCategories).forEach(categoryTechs => {
      categoryTechs.forEach(tech => {
        if (extractedTech.has(tech)) {
          sortedTech.push(tech);
        }
      });
    });

    // Add any remaining technologies not in categories
    extractedTech.forEach(tech => {
      if (!sortedTech.includes(tech)) {
        sortedTech.push(tech);
      }
    });

    return sortedTech;
  }

  /**
   * Enrich resume data with GitHub information
   * Requirement 4.2: Extract README snippets and technology tags from repositories
   */
  async enrichWithGitHub(data: ParsedResumeData, githubData: GitHubData): Promise<ParsedResumeData> {
    if (!githubData || !githubData.repositories) {
      return data;
    }

    // Enrich existing projects with GitHub repository data
    const enrichedProjects = data.projects.map(project => {
      // Try to match project with GitHub repository
      const matchingRepo = this.findMatchingRepository(project, githubData.repositories);
      
      if (matchingRepo) {
        return {
          ...project,
          description: project.description || matchingRepo.description,
          techStack: this.mergeTechStacks(project.techStack, [matchingRepo.language, ...matchingRepo.topics]),
          links: {
            ...project.links,
            repo: project.links.repo || matchingRepo.url
          }
        };
      }
      
      return project;
    });

    // Add new projects from GitHub repositories not already in the resume
    const newProjects = githubData.repositories
      .filter(repo => !this.isRepositoryAlreadyIncluded(repo, enrichedProjects))
      .slice(0, 2) // Limit to top 2 additional projects
      .map(repo => ({
        name: repo.name,
        description: repo.description || `${repo.name} - A ${repo.language} project with ${repo.stars} stars`,
        techStack: [repo.language, ...repo.topics].filter(Boolean),
        links: {
          repo: repo.url
        },
        confidence: 0.7 // Lower confidence for auto-added projects
      }));

    return {
      ...data,
      projects: [...enrichedProjects, ...newProjects]
    };
  }

  /**
   * Find matching GitHub repository for a project
   */
  private findMatchingRepository(project: ParsedResumeData['projects'][0], repositories: GitHubData['repositories']): GitHubData['repositories'][0] | null {
    // Try URL match first if project has a repo link
    if (project.links.repo) {
      const match = repositories.find(repo => repo.url === project.links.repo);
      if (match) return match;
    }

    // Try exact name match
    let match = repositories.find(repo => 
      repo.name.toLowerCase() === project.name.toLowerCase()
    );

    if (match) return match;

    // Try partial name match with normalized names
    const normalizedProjectName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    match = repositories.find(repo => {
      const normalizedRepoName = repo.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedProjectName.includes(normalizedRepoName) ||
             normalizedRepoName.includes(normalizedProjectName) ||
             this.calculateSimilarity(normalizedProjectName, normalizedRepoName) > 0.6;
    });

    return match || null;
  }

  /**
   * Check if a repository is already included in projects
   */
  private isRepositoryAlreadyIncluded(repo: GitHubData['repositories'][0], projects: ParsedResumeData['projects']): boolean {
    return projects.some(project => 
      project.name.toLowerCase() === repo.name.toLowerCase() ||
      project.links.repo === repo.url
    );
  }

  /**
   * Merge technology stacks, removing duplicates and maintaining order
   */
  private mergeTechStacks(existing: string[], additional: string[]): string[] {
    const merged = [...existing];
    
    additional.forEach(tech => {
      if (tech && !merged.some(existingTech => 
        existingTech.toLowerCase() === tech.toLowerCase()
      )) {
        merged.push(tech);
      }
    });

    return merged;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
  }

  // Private helper methods

  private createBioPrompt(originalBio: string, experience: ParsedResumeData['experience'], role: DeveloperRole): string {
    const rolePrompts = {
      'frontend': 'Focus on UI/UX development, modern JavaScript frameworks (React, Vue, Angular), responsive design, user experience optimization, and frontend performance. Highlight skills in CSS, TypeScript, and modern build tools.',
      'backend': 'Emphasize server-side development, RESTful/GraphQL APIs, databases (SQL/NoSQL), system architecture, microservices, and scalability. Highlight experience with cloud platforms and performance optimization.',
      'full-stack': 'Highlight both frontend and backend expertise, end-to-end development capabilities, versatility across the tech stack, and ability to architect complete solutions from database to user interface.',
      'ml': 'Focus on machine learning, data science, AI model development, statistical analysis, deep learning frameworks (TensorFlow, PyTorch), and production ML systems. Emphasize experience with Python, data pipelines, and model deployment.',
      'devops': 'Emphasize infrastructure as code, CI/CD pipelines, cloud platforms (AWS, Azure, GCP), containerization (Docker, Kubernetes), automation, monitoring, and system reliability engineering.',
      'mobile': 'Focus on mobile app development, cross-platform solutions (React Native, Flutter), native development (iOS/Android), mobile-first design, and app store deployment.',
      'general': 'Highlight overall software development expertise, technical problem-solving skills, adaptability across technologies, and strong engineering fundamentals.'
    };

    const techStack = experience.flatMap(exp => exp.techStack).filter(Boolean);
    const yearsOfExperience = this.calculateYearsOfExperience(experience);
    
    const experienceLevel = this.getExperienceLevel(yearsOfExperience);
    const topTechnologies = this.getTopTechnologies(techStack, role);
    const impactKeywords = this.getImpactKeywords(role);
    
    return `
Create a compelling 2-3 sentence professional bio for a ${experienceLevel} ${role} developer with ${yearsOfExperience} years of experience.

Original bio: "${originalBio}"

Key technologies: ${topTechnologies.join(', ')}

Role focus: ${rolePrompts[role]}

Impact areas to highlight: ${impactKeywords.join(', ')}

Requirements:
- Start with a strong opening that establishes ${experienceLevel} expertise
- Mention 3-4 key technologies from the provided list
- Include a brief mention of impact, achievements, or business value delivered
- Use active voice and confident, professional language
- Emphasize technical depth and problem-solving capabilities
- Keep it concise but impactful (2-3 sentences maximum)
- Make it suitable for a developer portfolio and LinkedIn
- Avoid buzzwords and focus on concrete technical skills

Return only the enhanced bio text, no additional formatting or explanations.
    `.trim();
  }

  private createBulletPrompt(bullets: string[], role: string, techStack: string[]): string {
    return `
Transform these job responsibility bullets into impact-focused achievements for a ${role} role:

Original bullets:
${bullets.map((bullet, i) => `${i + 1}. ${bullet}`).join('\n')}

Technologies used: ${techStack.join(', ')}

Requirements:
- Start each bullet with a strong action verb
- Include specific metrics, percentages, or quantifiable results where possible
- Highlight technical skills and technologies used
- Focus on business impact and outcomes
- Use past tense for completed work
- Keep each bullet to 1-2 lines maximum
- Return exactly ${bullets.length} enhanced bullets

Format: Return as a numbered list (1., 2., 3., etc.) with each bullet on a new line.
    `.trim();
  }

  private async enhanceProjectDescription(project: ParsedResumeData['projects'][0]): Promise<string> {
    const prompt = `
Create a compelling project description following the problem/approach/results structure:

Project: ${project.name}
Current description: "${project.description}"
Technologies: ${project.techStack.join(', ')}
Repository: ${project.links.repo || 'Not provided'}
Demo: ${project.links.demo || 'Not provided'}

Requirements:
- Start with the problem or challenge addressed
- Explain the technical approach and key technologies
- Highlight results, impact, or key features
- Keep it concise (2-3 sentences maximum)
- Use technical language appropriate for developers
- Focus on what makes this project impressive

Return only the enhanced description, no additional formatting.
    `.trim();

    try {
      // Try primary provider
      if (this.config.primaryProvider === 'cloudflare' && this.cloudflareAI) {
        return await this.cloudflareAI.generateText(prompt, { maxTokens: 200, temperature: 0.7 });
      } else {
        return await this.enhanceProjectDescriptionWithOpenRouter(prompt, project);
      }
    } catch (primaryError) {
      console.error(`Error with primary provider (${this.config.primaryProvider}):`, primaryError);
      
      // Try fallback provider if enabled
      if (this.config.enableFallback) {
        try {
          if (this.config.primaryProvider === 'openrouter' && this.cloudflareAI) {
            return await this.cloudflareAI.generateText(prompt, { maxTokens: 200, temperature: 0.7 });
          } else if (this.config.primaryProvider === 'cloudflare') {
            return await this.enhanceProjectDescriptionWithOpenRouter(prompt, project);
          }
        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError);
        }
      }
      
      return project.description;
    }
  }

  /**
   * Enhance project description using OpenRouter
   */
  private async enhanceProjectDescriptionWithOpenRouter(
    prompt: string,
    project: ParsedResumeData['projects'][0]
  ): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-resume-portfolio.pages.dev',
        'X-Title': 'AI Resume Portfolio',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical writer creating project descriptions for developer portfolios. Focus on technical achievements and impact.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || project.description;
  }

  private parseBulletResponse(response: string): string[] {
    // Parse numbered list format (1., 2., 3., etc.)
    const bullets = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove numbering (1., 2., etc.) and clean up
        return line.replace(/^\d+\.\s*/, '').trim();
      })
      .filter(line => line.length > 0);

    return bullets;
  }

  private calculateYearsOfExperience(experience: ParsedResumeData['experience']): number {
    if (!experience.length) return 0;

    const totalMonths = experience.reduce((total, exp) => {
      const start = new Date(exp.startDate);
      const end = exp.endDate ? new Date(exp.endDate) : new Date();
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return total + Math.max(0, months);
    }, 0);

    return Math.round(totalMonths / 12);
  }

  private getExperienceLevel(years: number): string {
    if (years < 2) return 'Junior';
    if (years < 5) return 'Mid-level';
    if (years < 8) return 'Senior';
    return 'Lead';
  }

  private getTopTechnologies(techStack: string[], role: DeveloperRole): string[] {
    // Role-specific technology priorities
    const rolePriorities = {
      'frontend': ['React', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'CSS', 'HTML', 'Next.js', 'Tailwind'],
      'backend': ['Node.js', 'Python', 'Java', 'C#', 'Go', 'PostgreSQL', 'MongoDB', 'Redis', 'AWS', 'Docker'],
      'full-stack': ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'AWS', 'Docker', 'Next.js'],
      'ml': ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy', 'Jupyter', 'AWS', 'Docker'],
      'devops': ['AWS', 'Docker', 'Kubernetes', 'Jenkins', 'Terraform', 'Ansible', 'Git', 'Linux', 'Python'],
      'mobile': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS', 'Android', 'Firebase', 'TypeScript'],
      'general': ['JavaScript', 'Python', 'React', 'Node.js', 'Git', 'AWS', 'Docker', 'PostgreSQL']
    };

    const priorities = rolePriorities[role] || rolePriorities['general'];
    const prioritized: string[] = [];
    const remaining: string[] = [];

    // First, add technologies that match role priorities
    techStack.forEach(tech => {
      const matchesPriority = priorities.some(priority => 
        tech.toLowerCase().includes(priority.toLowerCase()) || 
        priority.toLowerCase().includes(tech.toLowerCase())
      );
      
      if (matchesPriority) {
        prioritized.push(tech);
      } else {
        remaining.push(tech);
      }
    });

    // Return top 6 technologies (prioritized first, then remaining)
    return [...prioritized, ...remaining].slice(0, 6);
  }

  private getImpactKeywords(role: DeveloperRole): string[] {
    const impactKeywords = {
      'frontend': ['user experience', 'performance optimization', 'responsive design', 'accessibility', 'conversion rates'],
      'backend': ['scalability', 'performance', 'system reliability', 'API design', 'data processing'],
      'full-stack': ['end-to-end solutions', 'system architecture', 'user experience', 'scalability', 'product delivery'],
      'ml': ['model accuracy', 'data insights', 'automation', 'predictive analytics', 'business intelligence'],
      'devops': ['deployment efficiency', 'system reliability', 'automation', 'infrastructure optimization', 'monitoring'],
      'mobile': ['user engagement', 'app performance', 'cross-platform solutions', 'user retention', 'mobile optimization'],
      'general': ['code quality', 'problem solving', 'system efficiency', 'team collaboration', 'technical innovation']
    };

    return impactKeywords[role] || impactKeywords['general'];
  }

  private generateDefaultBio(experience: ParsedResumeData['experience'], role: DeveloperRole): string {
    const yearsOfExperience = this.calculateYearsOfExperience(experience);
    const experienceLevel = this.getExperienceLevel(yearsOfExperience);
    const techStack = experience.flatMap(exp => exp.techStack).filter(Boolean).slice(0, 3);
    
    const roleDescriptions = {
      'frontend': 'Frontend Developer',
      'backend': 'Backend Developer', 
      'full-stack': 'Full-Stack Developer',
      'ml': 'Machine Learning Engineer',
      'devops': 'DevOps Engineer',
      'mobile': 'Mobile Developer',
      'general': 'Software Developer'
    };

    const impactKeywords = this.getImpactKeywords(role);
    const primaryImpact = impactKeywords[0];

    return `${experienceLevel} ${roleDescriptions[role]} with ${yearsOfExperience}+ years of experience building scalable applications using ${techStack.join(', ')}. Passionate about ${primaryImpact} and delivering high-quality software solutions that drive business value.`;
  }
}

// Export default instance with environment-based configuration
export const aiContentGenerator = new AIContentGenerator();

// Export factory function for custom configuration
export function createAIContentGenerator(config?: Partial<AIProviderConfig>): AIContentGenerator {
  return new AIContentGenerator(config);
}