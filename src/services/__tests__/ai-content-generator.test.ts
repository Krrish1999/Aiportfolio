import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';
import { aiContentGenerator } from '../ai-content-generator';
import { ParsedResumeData, GitHubData } from '../../types';

// Mock OpenAI
vi.mock('openai');
const MockedOpenAI = vi.mocked(OpenAI);

// Mock environment
vi.mock('../../config/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-api-key'
  }
}));

describe('AIContentGenerator', () => {
  let mockOpenAI: any;
  let mockChatCompletions: any;

  beforeEach(() => {
    mockChatCompletions = {
      create: vi.fn()
    };
    
    mockOpenAI = {
      chat: {
        completions: mockChatCompletions,
        _client: {} as any
      }
    };

    // Clear the constructor mock and set up the instance
    MockedOpenAI.mockClear();
    MockedOpenAI.prototype.chat = {
      completions: mockChatCompletions,
      _client: {} as any
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('enhanceBio', () => {
    const mockExperience: ParsedResumeData['experience'] = [
      {
        company: 'Tech Corp',
        role: 'Senior Frontend Developer',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-01-01'),
        bullets: ['Built React applications'],
        techStack: ['React', 'TypeScript', 'Node.js'],
        confidence: 0.9
      },
      {
        company: 'Startup Inc',
        role: 'Full Stack Developer',
        startDate: new Date('2018-01-01'),
        endDate: new Date('2020-01-01'),
        bullets: ['Developed web applications'],
        techStack: ['Vue.js', 'Python', 'PostgreSQL'],
        confidence: 0.8
      }
    ];

    it('should enhance bio with AI-generated content for frontend role', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Experienced Frontend Developer with 5+ years building responsive web applications using React, TypeScript, and modern JavaScript frameworks. Proven track record of delivering high-performance user interfaces and optimizing user experience across diverse projects.'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.enhanceBio(
        'I am a developer with experience in web development.',
        mockExperience,
        'frontend'
      );

      expect(result).toBe(mockResponse.choices[0].message.content);
      expect(mockChatCompletions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('expert technical writer')
          },
          {
            role: 'user',
            content: expect.stringContaining('frontend developer')
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });
    });

    it('should enhance bio with AI-generated content for backend role', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Backend Developer with 5+ years of experience designing scalable server-side applications using Node.js, Python, and PostgreSQL. Expertise in API development, database optimization, and building robust microservices architectures.'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.enhanceBio(
        'Backend developer with API experience.',
        mockExperience,
        'backend'
      );

      expect(result).toBe(mockResponse.choices[0].message.content);
      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('server-side development')
            })
          ])
        })
      );
    });

    it('should enhance bio with AI-generated content for full-stack role', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Full-Stack Developer with 5+ years of experience building end-to-end web applications using React, Node.js, and PostgreSQL. Versatile engineer capable of handling both frontend user experiences and backend system architecture with equal expertise.'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.enhanceBio(
        'Full stack developer.',
        mockExperience,
        'full-stack'
      );

      expect(result).toBe(mockResponse.choices[0].message.content);
      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('end-to-end development')
            })
          ])
        })
      );
    });

    it('should enhance bio with AI-generated content for ML role', async () => {
      const mlExperience: ParsedResumeData['experience'] = [
        {
          company: 'AI Labs',
          role: 'ML Engineer',
          startDate: new Date('2020-01-01'),
          endDate: new Date('2023-01-01'),
          bullets: ['Built ML models'],
          techStack: ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn'],
          confidence: 0.9
        }
      ];

      const mockResponse = {
        choices: [{
          message: {
            content: 'Machine Learning Engineer with 3+ years of experience developing and deploying ML models using Python, TensorFlow, and PyTorch. Specialized in deep learning, statistical analysis, and building production-ready AI systems that drive business insights.'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.enhanceBio(
        'ML engineer with model development experience.',
        mlExperience,
        'ml'
      );

      expect(result).toBe(mockResponse.choices[0].message.content);
      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('machine learning')
            })
          ])
        })
      );
    });

    it('should fallback to original bio when AI generation fails', async () => {
      const originalBio = 'Original bio content';
      mockChatCompletions.create.mockRejectedValue(new Error('API Error'));

      const result = await aiContentGenerator.enhanceBio(
        originalBio,
        mockExperience,
        'frontend'
      );

      expect(result).toBe(originalBio);
    });

    it('should generate default bio when AI fails and no original bio provided', async () => {
      mockChatCompletions.create.mockRejectedValue(new Error('API Error'));

      const result = await aiContentGenerator.enhanceBio(
        '',
        mockExperience,
        'frontend'
      );

      expect(result).toContain('Frontend Developer');
      expect(result).toContain('5+ years');
      expect(result).toContain('React');
    });

    it('should handle empty experience array', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Passionate Frontend Developer eager to build innovative web applications and contribute to dynamic development teams.'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.enhanceBio(
        'New developer',
        [],
        'frontend'
      );

      expect(result).toBe(mockResponse.choices[0].message.content);
    });

    it('should handle missing response content', async () => {
      const originalBio = 'Original bio';
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.enhanceBio(
        originalBio,
        mockExperience,
        'frontend'
      );

      expect(result).toBe(originalBio);
    });

    it('should include relevant technologies in prompt', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Enhanced bio content'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      await aiContentGenerator.enhanceBio(
        'Developer bio',
        mockExperience,
        'frontend'
      );

      const callArgs = mockChatCompletions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      expect(userMessage.content).toContain('React');
      expect(userMessage.content).toContain('TypeScript');
      expect(userMessage.content).toContain('Node.js');
      expect(userMessage.content).toContain('Vue.js');
      expect(userMessage.content).toContain('Python');
    });

    it('should calculate years of experience correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Enhanced bio content'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      await aiContentGenerator.enhanceBio(
        'Developer bio',
        mockExperience,
        'frontend'
      );

      const callArgs = mockChatCompletions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      // Should calculate ~5 years from the mock experience (2018-2023)
      expect(userMessage.content).toContain('5 years');
    });

    it('should include experience level in prompt based on years of experience', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Enhanced bio content'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      await aiContentGenerator.enhanceBio(
        'Developer bio',
        mockExperience,
        'frontend'
      );

      const callArgs = mockChatCompletions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      // Should include Senior level for 5 years of experience
      expect(userMessage.content).toContain('Senior');
    });

    it('should prioritize role-specific technologies in prompt', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Enhanced bio content'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const frontendExperience: ParsedResumeData['experience'] = [
        {
          company: 'Tech Corp',
          role: 'Frontend Developer',
          startDate: new Date('2020-01-01'),
          endDate: new Date('2023-01-01'),
          bullets: ['Built React applications'],
          techStack: ['React', 'TypeScript', 'Python', 'PostgreSQL', 'Docker'],
          confidence: 0.9
        }
      ];

      await aiContentGenerator.enhanceBio(
        'Developer bio',
        frontendExperience,
        'frontend'
      );

      const callArgs = mockChatCompletions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      // Should prioritize frontend technologies (React, TypeScript) over backend ones
      const techSection = userMessage.content.split('Key technologies:')[1].split('Role focus:')[0];
      const reactIndex = techSection.indexOf('React');
      const pythonIndex = techSection.indexOf('Python');
      
      expect(reactIndex).toBeGreaterThan(-1);
      expect(reactIndex).toBeLessThan(pythonIndex);
    });

    it('should include impact keywords for different roles', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Enhanced bio content'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      await aiContentGenerator.enhanceBio(
        'Developer bio',
        mockExperience,
        'frontend'
      );

      const callArgs = mockChatCompletions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      expect(userMessage.content).toContain('Impact areas to highlight:');
      expect(userMessage.content).toContain('user experience');
    });
  });

  describe('rewriteBullets', () => {
    const mockBullets = [
      'Developed web applications using React',
      'Worked on backend APIs',
      'Collaborated with team members'
    ];
    const mockTechStack = ['React', 'Node.js', 'PostgreSQL'];

    it('should rewrite bullets with impact-focused language', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: `1. Built 5 responsive web applications using React and TypeScript, improving user engagement by 40%
2. Architected RESTful APIs with Node.js and PostgreSQL, reducing response times by 60%
3. Led cross-functional team of 4 developers, delivering projects 2 weeks ahead of schedule`
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.rewriteBullets(
        mockBullets,
        'Full Stack Developer',
        mockTechStack
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toContain('Built 5 responsive web applications');
      expect(result[1]).toContain('REST API');
      expect(result[2]).toContain('Led cross-functional team');
    });

    it('should handle empty bullets array', async () => {
      const result = await aiContentGenerator.rewriteBullets(
        [],
        'Developer',
        mockTechStack
      );

      expect(result).toEqual([]);
      expect(mockChatCompletions.create).not.toHaveBeenCalled();
    });

    it('should fallback to original bullets when AI generation fails', async () => {
      mockChatCompletions.create.mockRejectedValue(new Error('API Error'));

      const result = await aiContentGenerator.rewriteBullets(
        mockBullets,
        'Developer',
        mockTechStack
      );

      expect(result).toEqual(mockBullets);
    });

    it('should include role and tech stack in prompt', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '1. Enhanced bullet\n2. Another bullet\n3. Third bullet'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      await aiContentGenerator.rewriteBullets(
        mockBullets,
        'Senior Frontend Developer',
        mockTechStack
      );

      const callArgs = mockChatCompletions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      expect(userMessage.content).toContain('Senior Frontend Developer');
      expect(userMessage.content).toContain('React, Node.js, PostgreSQL');
    });

    it('should parse bullet response correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: `1. First enhanced bullet point
2. Second enhanced bullet point  
3. Third enhanced bullet point`
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.rewriteBullets(
        mockBullets,
        'Developer',
        mockTechStack
      );

      expect(result).toEqual([
        'First enhanced bullet point',
        'Second enhanced bullet point',
        'Third enhanced bullet point'
      ]);
    });

    it('should handle malformed response gracefully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.rewriteBullets(
        mockBullets,
        'Developer',
        mockTechStack
      );

      expect(result).toEqual(mockBullets);
    });

    it('should extract and enhance metrics in bullets', async () => {
      const bulletsWithMetrics = [
        'Improved application performance by 50%',
        'Reduced load times from 3 seconds to 1 second',
        'Built system serving 10000 users daily'
      ];

      const mockResponse = {
        choices: [{
          message: {
            content: `1. Optimized application performance, achieving 50% improvement in response times
2. Reduced page load times by 67%, decreasing from 3 seconds to 1 second
3. Architected scalable system serving 10,000+ daily active users`
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.rewriteBullets(
        bulletsWithMetrics,
        'Full Stack Developer',
        ['React', 'Node.js']
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toContain('50%');
      expect(result[1]).toContain('67%');
      expect(result[2]).toContain('10,000+');
    });

    it('should highlight technical skills in bullets', async () => {
      const bulletsWithTech = [
        'Developed web applications using react and nodejs',
        'Implemented rest apis with postgresql database',
        'Used docker for containerization'
      ];

      const mockResponse = {
        choices: [{
          message: {
            content: `1. Developed responsive web applications using react and nodejs frameworks
2. Implemented rest apis with postgresql database for data persistence
3. Used docker for application containerization and deployment`
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.rewriteBullets(
        bulletsWithTech,
        'Full Stack Developer',
        ['React', 'Node.js', 'PostgreSQL', 'Docker']
      );

      expect(result).toHaveLength(3);
      // Should properly capitalize technical skills
      expect(result[0]).toContain('React');
      expect(result[0]).toContain('Node.js');
      expect(result[1]).toContain('PostgreSQL');
      expect(result[2]).toContain('Docker');
    });

    it('should suggest metrics for bullets without quantifiable data', async () => {
      const bulletsWithoutMetrics = [
        'Improved system performance',
        'Reduced processing time',
        'Built new features'
      ];

      const mockResponse = {
        choices: [{
          message: {
            content: `1. Enhanced system performance through optimization techniques
2. Reduced processing time via efficient algorithms
3. Developed new features to expand application capabilities`
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const result = await aiContentGenerator.rewriteBullets(
        bulletsWithoutMetrics,
        'Software Engineer',
        ['Python', 'Django']
      );

      expect(result).toHaveLength(3);
      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('[Consider adding:')
            })
          ])
        })
      );
    });
  });

  describe('generateProjectDescriptions', () => {
    const mockProjects: ParsedResumeData['projects'] = [
      {
        name: 'E-commerce Platform',
        description: 'Built an online store',
        techStack: ['React', 'Node.js', 'MongoDB'],
        links: {
          repo: 'https://github.com/user/ecommerce',
          demo: 'https://ecommerce-demo.com'
        },
        confidence: 0.8
      },
      {
        name: 'Task Manager',
        description: 'A comprehensive task management application built with React and Firebase, featuring real-time collaboration, drag-and-drop functionality, and advanced filtering options.',
        techStack: ['React', 'Firebase', 'Material-UI'],
        links: {
          repo: 'https://github.com/user/taskmanager'
        },
        confidence: 0.9
      }
    ];

    it('should enhance short project descriptions', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Developed a full-featured e-commerce platform to solve online retail challenges using React, Node.js, and MongoDB. Implemented secure payment processing, inventory management, and real-time order tracking, resulting in a scalable solution supporting 1000+ concurrent users.'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      // Use only the first project which has a short description
      const result = await aiContentGenerator.generateProjectDescriptions([mockProjects[0]]);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe(mockResponse.choices[0].message.content);
    });

    it('should not enhance already detailed descriptions', async () => {
      // Use only the second project which has a detailed description
      const result = await aiContentGenerator.generateProjectDescriptions([mockProjects[1]]);

      // Should not call AI for detailed descriptions
      expect(mockChatCompletions.create).not.toHaveBeenCalled();
      expect(result[0].description).toBe(mockProjects[1].description);
    });

    it('should handle empty projects array', async () => {
      const result = await aiContentGenerator.generateProjectDescriptions([]);

      expect(result).toEqual([]);
      expect(mockChatCompletions.create).not.toHaveBeenCalled();
    });

    it('should fallback to original description when AI generation fails', async () => {
      mockChatCompletions.create.mockRejectedValue(new Error('API Error'));

      const result = await aiContentGenerator.generateProjectDescriptions(mockProjects);

      expect(result[0].description).toBe(mockProjects[0].description);
    });

    it('should include project details in prompt', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Enhanced project description'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      await aiContentGenerator.generateProjectDescriptions([mockProjects[0]]);

      expect(mockChatCompletions.create).toHaveBeenCalledTimes(1);
      const callArgs = mockChatCompletions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      expect(userMessage.content).toContain('E-commerce Platform');
      expect(userMessage.content).toContain('React, Node.js, MongoDB');
      expect(userMessage.content).toContain('https://github.com/user/ecommerce');
    });

    it('should extract and categorize technology stack from description', async () => {
      const projectWithTechInDescription: ParsedResumeData['projects'] = [
        {
          name: 'Web App',
          description: 'Built with React and TypeScript, deployed on AWS using Docker containers',
          techStack: ['JavaScript'],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(projectWithTechInDescription);

      expect(result[0].techStack).toContain('React');
      expect(result[0].techStack).toContain('TypeScript');
      expect(result[0].techStack).toContain('AWS');
      expect(result[0].techStack).toContain('Docker');
      expect(result[0].techStack).toContain('JavaScript'); // Original tech should be preserved
    });

    it('should organize tech stack by categories', async () => {
      const projectWithMixedTech: ParsedResumeData['projects'] = [
        {
          name: 'Full Stack App',
          description: 'Frontend with React, backend with Node.js, database PostgreSQL, deployed on AWS',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(projectWithMixedTech);

      const techStack = result[0].techStack;
      
      // Frontend technologies should come first
      expect(techStack.indexOf('React')).toBeLessThan(techStack.indexOf('Node.js'));
      // Backend should come before database
      expect(techStack.indexOf('Node.js')).toBeLessThan(techStack.indexOf('PostgreSQL'));
      // Database should come before cloud
      expect(techStack.indexOf('PostgreSQL')).toBeLessThan(techStack.indexOf('AWS'));
    });

    it('should extract frontend technologies from description', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'UI Dashboard',
          description: 'Built a responsive dashboard using React, TypeScript, and Tailwind CSS with Material-UI components',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('React');
      expect(result[0].techStack).toContain('TypeScript');
      expect(result[0].techStack).toContain('Tailwind');
      expect(result[0].techStack).toContain('Material-UI');
    });

    it('should extract backend technologies from description', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'API Service',
          description: 'Developed RESTful API using Node.js, Express, and Python with Django framework',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('Node.js');
      expect(result[0].techStack).toContain('Express');
      expect(result[0].techStack).toContain('Python');
      expect(result[0].techStack).toContain('Django');
    });

    it('should extract database technologies from description', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'Data Platform',
          description: 'Built data platform with PostgreSQL, MongoDB, and Redis caching layer',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('PostgreSQL');
      expect(result[0].techStack).toContain('MongoDB');
      expect(result[0].techStack).toContain('Redis');
    });

    it('should extract cloud and DevOps technologies from description', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'Cloud Infrastructure',
          description: 'Deployed on AWS using Docker containers orchestrated with Kubernetes',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('AWS');
      expect(result[0].techStack).toContain('Docker');
      expect(result[0].techStack).toContain('Kubernetes');
    });

    it('should extract mobile technologies from description', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'Mobile App',
          description: 'Cross-platform mobile app built with React Native and Flutter',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('React Native');
      expect(result[0].techStack).toContain('Flutter');
    });

    it('should extract AI/ML technologies from description', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'ML Pipeline',
          description: 'Machine learning pipeline using TensorFlow, PyTorch, and Scikit-learn with Pandas for data processing',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('TensorFlow');
      expect(result[0].techStack).toContain('PyTorch');
      expect(result[0].techStack).toContain('Scikit-learn');
      expect(result[0].techStack).toContain('Pandas');
    });

    it('should preserve existing tech stack and merge with extracted technologies', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'Web App',
          description: 'Built with React and deployed on AWS',
          techStack: ['TypeScript', 'Webpack'],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('TypeScript');
      expect(result[0].techStack).toContain('Webpack');
      expect(result[0].techStack).toContain('React');
      expect(result[0].techStack).toContain('AWS');
    });

    it('should not duplicate technologies when extracting from description', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'Web App',
          description: 'Built with React and React Native using React hooks',
          techStack: ['React'],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      const reactCount = result[0].techStack.filter(tech => tech === 'React').length;
      expect(reactCount).toBe(1);
    });

    it('should handle case-insensitive technology matching', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'Web App',
          description: 'Built with REACT, nodejs, and POSTGRESQL',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('React');
      expect(result[0].techStack).toContain('Node.js');
      expect(result[0].techStack).toContain('PostgreSQL');
    });

    it('should maintain category order in tech stack', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'Full Stack App',
          description: 'Deployed on AWS with PostgreSQL database, Node.js backend, and React frontend using Docker',
          techStack: [],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      const techStack = result[0].techStack;
      const reactIndex = techStack.indexOf('React');
      const nodeIndex = techStack.indexOf('Node.js');
      const postgresIndex = techStack.indexOf('PostgreSQL');
      const awsIndex = techStack.indexOf('AWS');
      const dockerIndex = techStack.indexOf('Docker');

      // Frontend (React) should come before backend (Node.js)
      expect(reactIndex).toBeLessThan(nodeIndex);
      // Backend (Node.js) should come before database (PostgreSQL)
      expect(nodeIndex).toBeLessThan(postgresIndex);
      // Database (PostgreSQL) should come before cloud (AWS)
      expect(postgresIndex).toBeLessThan(awsIndex);
      // Cloud (AWS) should come before tools (Docker)
      expect(awsIndex).toBeLessThan(dockerIndex);
    });

    it('should handle projects with no recognizable technologies', async () => {
      const project: ParsedResumeData['projects'] = [
        {
          name: 'Custom App',
          description: 'Built a custom application using proprietary frameworks',
          techStack: ['CustomFramework', 'InternalTool'],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      expect(result[0].techStack).toContain('CustomFramework');
      expect(result[0].techStack).toContain('InternalTool');
      expect(result[0].techStack.length).toBe(2);
    });

    it('should generate problem/approach/results structure in description', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Addressed the challenge of slow checkout processes in e-commerce by implementing a streamlined payment flow using React and Stripe API. Reduced checkout time by 40% and increased conversion rates by 25%, handling 10,000+ transactions monthly.'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const project: ParsedResumeData['projects'] = [
        {
          name: 'E-commerce Checkout',
          description: 'Payment system',
          techStack: ['React', 'Stripe'],
          links: {},
          confidence: 0.8
        }
      ];

      const result = await aiContentGenerator.generateProjectDescriptions(project);

      const description = result[0].description;
      // Should contain problem statement
      expect(description.toLowerCase()).toMatch(/challenge|problem|addressed/);
      // Should contain approach/solution
      expect(description.toLowerCase()).toMatch(/implement|using|built/);
      // Should contain results/impact
      expect(description.toLowerCase()).toMatch(/reduced|increased|handling|\d+%/);
    });

    it('should include repository and demo links in enhancement prompt', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Enhanced description with links'
          }
        }]
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse);

      const project: ParsedResumeData['projects'] = [
        {
          name: 'Portfolio Site',
          description: 'My site',
          techStack: ['Next.js'],
          links: {
            repo: 'https://github.com/user/portfolio',
            demo: 'https://portfolio.com'
          },
          confidence: 0.8
        }
      ];

      await aiContentGenerator.generateProjectDescriptions(project);

      const callArgs = mockChatCompletions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      expect(userMessage.content).toContain('https://github.com/user/portfolio');
      expect(userMessage.content).toContain('https://portfolio.com');
    });
  });

  describe('enrichWithGitHub', () => {
    const mockGitHubData: GitHubData = {
      username: 'testuser',
      repositories: [
        {
          name: 'e-commerce-platform',
          description: 'Modern e-commerce solution with React and Node.js',
          url: 'https://github.com/testuser/e-commerce-platform',
          language: 'TypeScript',
          stars: 45,
          forks: 12,
          topics: ['react', 'nodejs', 'ecommerce', 'typescript']
        },
        {
          name: 'task-manager',
          description: 'Task management app with real-time updates',
          url: 'https://github.com/testuser/task-manager',
          language: 'JavaScript',
          stars: 23,
          forks: 5,
          topics: ['react', 'firebase', 'realtime']
        },
        {
          name: 'ml-classifier',
          description: 'Machine learning image classifier',
          url: 'https://github.com/testuser/ml-classifier',
          language: 'Python',
          stars: 67,
          forks: 18,
          topics: ['machine-learning', 'tensorflow', 'python']
        }
      ]
    };

    const mockData: ParsedResumeData = {
      profile: {
        name: 'John Doe',
        title: 'Developer',
        email: 'john@example.com',
        links: {}
      },
      summary: 'Developer summary',
      skills: [],
      experience: [],
      projects: [
        {
          name: 'E-commerce Platform',
          description: '', // Empty description should be replaced
          techStack: ['React'],
          links: {},
          confidence: 0.8
        }
      ],
      education: []
    };

    it('should enrich existing projects with GitHub repository data', async () => {
      const result = await aiContentGenerator.enrichWithGitHub(mockData, mockGitHubData);

      expect(result.projects).toHaveLength(3); // 1 existing + 2 new from GitHub
      
      const enrichedProject = result.projects[0];
      expect(enrichedProject.name).toBe('E-commerce Platform');
      expect(enrichedProject.description).toBe('Modern e-commerce solution with React and Node.js');
      expect(enrichedProject.techStack).toContain('TypeScript');
      expect(enrichedProject.techStack).toContain('React');
      expect(enrichedProject.links.repo).toBe('https://github.com/testuser/e-commerce-platform');
    });

    it('should add new projects from GitHub repositories', async () => {
      const result = await aiContentGenerator.enrichWithGitHub(mockData, mockGitHubData);

      const newProjects = result.projects.slice(1); // Skip the first existing project
      expect(newProjects).toHaveLength(2);
      
      const taskManagerProject = newProjects.find(p => p.name === 'task-manager');
      expect(taskManagerProject).toBeDefined();
      expect(taskManagerProject?.techStack).toContain('JavaScript');
      expect(taskManagerProject?.confidence).toBe(0.7);
    });

    it('should handle missing GitHub data gracefully', async () => {
      const result = await aiContentGenerator.enrichWithGitHub(mockData, null as any);
      expect(result).toBe(mockData);
    });

    it('should not duplicate existing projects', async () => {
      const dataWithExistingRepo: ParsedResumeData = {
        ...mockData,
        projects: [
          {
            name: 'task-manager',
            description: 'Existing task manager',
            techStack: ['Vue'],
            links: {
              repo: 'https://github.com/testuser/task-manager'
            },
            confidence: 0.9
          }
        ]
      };

      const result = await aiContentGenerator.enrichWithGitHub(dataWithExistingRepo, mockGitHubData);

      // Should not add duplicate task-manager project
      const taskManagerProjects = result.projects.filter(p => p.name === 'task-manager');
      expect(taskManagerProjects).toHaveLength(1);
    });

    it('should merge technology stacks without duplicates', async () => {
      const dataWithTech: ParsedResumeData = {
        ...mockData,
        projects: [
          {
            name: 'E-commerce Platform',
            description: 'Built an online store',
            techStack: ['React', 'CSS'],
            links: {},
            confidence: 0.8
          }
        ]
      };

      const result = await aiContentGenerator.enrichWithGitHub(dataWithTech, mockGitHubData);

      const enrichedProject = result.projects[0];
      expect(enrichedProject.techStack).toContain('React'); // Original
      expect(enrichedProject.techStack).toContain('CSS'); // Original
      expect(enrichedProject.techStack).toContain('TypeScript'); // From GitHub
      
      // Should not have duplicate React entries
      const reactCount = enrichedProject.techStack.filter(tech => 
        tech.toLowerCase() === 'react'
      ).length;
      expect(reactCount).toBe(1);
    });

    it('should limit new projects to top 3', async () => {
      const largeGitHubData: GitHubData = {
        username: 'testuser',
        repositories: Array.from({ length: 10 }, (_, i) => ({
          name: `project-${i}`,
          description: `Project ${i}`,
          url: `https://github.com/testuser/project-${i}`,
          language: 'JavaScript',
          stars: i,
          forks: i,
          topics: []
        }))
      };

      const emptyData: ParsedResumeData = {
        ...mockData,
        projects: []
      };

      const result = await aiContentGenerator.enrichWithGitHub(emptyData, largeGitHubData);

      expect(result.projects).toHaveLength(2); // Should be limited to 2
    });
  });
});