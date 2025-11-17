import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubIntegrationService } from '../github-integration';

// Mock fetch globally
global.fetch = vi.fn();

describe('GitHubIntegrationService', () => {
  let service: GitHubIntegrationService;
  const mockClientId = 'test-client-id';
  const mockClientSecret = 'test-client-secret';
  const mockAccessToken = 'gho_test_token_123';

  beforeEach(() => {
    service = new GitHubIntegrationService(mockClientId, mockClientSecret);
    vi.clearAllMocks();
  });

  describe('OAuth Flow', () => {
    it('should generate correct authorization URL', () => {
      const redirectUri = 'http://localhost:3000/api/auth/github/callback';
      const state = 'random-state-string';

      const authUrl = service.getAuthorizationUrl(redirectUri, state);

      expect(authUrl).toContain('https://github.com/login/oauth/authorize');
      expect(authUrl).toContain(`client_id=${mockClientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('scope=read%3Auser%2Crepo');
    });

    it('should exchange authorization code for access token', async () => {
      const mockCode = 'auth-code-123';
      const redirectUri = 'http://localhost:3000/api/auth/github/callback';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: mockAccessToken,
          token_type: 'bearer',
          scope: 'read:user,repo',
        }),
      });

      const token = await service.exchangeCodeForToken(mockCode, redirectUri);

      expect(token).toBe(mockAccessToken);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      );
    });

    it('should throw error when token exchange fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(
        service.exchangeCodeForToken('invalid-code', 'http://localhost:3000')
      ).rejects.toThrow('GitHub OAuth token exchange failed');
    });
  });

  describe('User Profile', () => {
    it('should fetch user profile successfully', async () => {
      const mockProfile = {
        login: 'testuser',
        name: 'Test User',
        bio: 'Software Engineer',
        location: 'San Francisco, CA',
        email: 'test@example.com',
        blog: 'https://testuser.dev',
        company: 'Tech Corp',
        avatar_url: 'https://avatars.githubusercontent.com/u/123',
        public_repos: 42,
        followers: 100,
        following: 50,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      });

      const profile = await service.getUserProfile(mockAccessToken);

      expect(profile).toEqual({
        login: 'testuser',
        name: 'Test User',
        bio: 'Software Engineer',
        location: 'San Francisco, CA',
        email: 'test@example.com',
        blog: 'https://testuser.dev',
        company: 'Tech Corp',
        avatarUrl: 'https://avatars.githubusercontent.com/u/123',
        publicRepos: 42,
        followers: 100,
        following: 50,
      });
    });
  });

  describe('Pinned Repositories', () => {
    it('should fetch pinned repositories using GraphQL', async () => {
      const mockGraphQLResponse = {
        data: {
          user: {
            pinnedItems: {
              nodes: [
                {
                  name: 'awesome-project',
                  description: 'An awesome project',
                  url: 'https://github.com/testuser/awesome-project',
                  primaryLanguage: { name: 'TypeScript' },
                  stargazerCount: 150,
                  forkCount: 25,
                  repositoryTopics: {
                    nodes: [
                      { topic: { name: 'react' } },
                      { topic: { name: 'nextjs' } },
                    ],
                  },
                  homepageUrl: 'https://awesome-project.com',
                  isPrivate: false,
                  updatedAt: '2024-01-15T10:30:00Z',
                },
                {
                  name: 'ml-toolkit',
                  description: 'Machine learning toolkit',
                  url: 'https://github.com/testuser/ml-toolkit',
                  primaryLanguage: { name: 'Python' },
                  stargazerCount: 300,
                  forkCount: 50,
                  repositoryTopics: {
                    nodes: [
                      { topic: { name: 'machine-learning' } },
                      { topic: { name: 'python' } },
                    ],
                  },
                  homepageUrl: null,
                  isPrivate: false,
                  updatedAt: '2024-02-01T14:20:00Z',
                },
              ],
            },
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGraphQLResponse,
      });

      const repos = await service.getPinnedRepositories('testuser', mockAccessToken);

      expect(repos).toHaveLength(2);
      expect(repos[0]).toEqual({
        name: 'awesome-project',
        description: 'An awesome project',
        url: 'https://github.com/testuser/awesome-project',
        language: 'TypeScript',
        stars: 150,
        forks: 25,
        topics: ['react', 'nextjs'],
        homepage: 'https://awesome-project.com',
        isPrivate: false,
        updatedAt: '2024-01-15T10:30:00Z',
      });
      expect(repos[1].language).toBe('Python');
    });

    it('should handle empty pinned repositories', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: {
              pinnedItems: {
                nodes: [],
              },
            },
          },
        }),
      });

      const repos = await service.getPinnedRepositories('testuser', mockAccessToken);

      expect(repos).toEqual([]);
    });

    it('should throw error on GraphQL errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: 'User not found' }],
        }),
      });

      await expect(
        service.getPinnedRepositories('nonexistent', mockAccessToken)
      ).rejects.toThrow('GraphQL errors');
    });
  });

  describe('Repository Metadata', () => {
    it('should fetch repository metadata', async () => {
      const mockRepo = {
        name: 'test-repo',
        description: 'A test repository',
        html_url: 'https://github.com/testuser/test-repo',
        language: 'JavaScript',
        stargazers_count: 50,
        forks_count: 10,
        topics: ['nodejs', 'api'],
        homepage: 'https://test-repo.com',
        private: false,
        updated_at: '2024-01-20T12:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepo,
      });

      const repo = await service.getRepositoryMetadata('testuser', 'test-repo', mockAccessToken);

      expect(repo).toEqual({
        name: 'test-repo',
        description: 'A test repository',
        url: 'https://github.com/testuser/test-repo',
        language: 'JavaScript',
        stars: 50,
        forks: 10,
        topics: ['nodejs', 'api'],
        homepage: 'https://test-repo.com',
        isPrivate: false,
        updatedAt: '2024-01-20T12:00:00Z',
      });
    });
  });

  describe('README Extraction', () => {
    it('should extract and parse README content', async () => {
      const readmeContent = `# Awesome Project

This is a comprehensive description of an awesome project that does amazing things with modern web technologies.

## Features
- Feature 1
- Feature 2

\`\`\`javascript
const code = 'example';
\`\`\`
`;

      const base64Content = Buffer.from(readmeContent).toString('base64');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: base64Content,
          encoding: 'base64',
        }),
      });

      const readme = await service.getRepositoryReadme('testuser', 'awesome-project', mockAccessToken);

      expect(readme).toBeTruthy();
      expect(readme).toContain('comprehensive description');
      expect(readme).not.toContain('```');
      expect(readme).not.toContain('# Awesome Project');
    });

    it('should handle missing README', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const readme = await service.getRepositoryReadme('testuser', 'no-readme', mockAccessToken);

      expect(readme).toBeNull();
    });

    it('should truncate long README snippets', async () => {
      const longContent = 'A'.repeat(500);
      const base64Content = Buffer.from(longContent).toString('base64');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: base64Content,
        }),
      });

      const readme = await service.getRepositoryReadme('testuser', 'long-readme', mockAccessToken);

      expect(readme).toBeTruthy();
      expect(readme!.length).toBeLessThanOrEqual(303); // 300 + '...'
      expect(readme).toContain('...');
    });
  });

  describe('Technology Tag Parsing', () => {
    it('should parse technology tags from repository', () => {
      const repo = {
        name: 'test-repo',
        description: 'Test',
        url: 'https://github.com/test/repo',
        language: 'TypeScript',
        stars: 10,
        forks: 2,
        topics: ['react', 'nextjs', 'tailwind'],
        isPrivate: false,
        updatedAt: '2024-01-01',
      };

      const tags = service.parseTechnologyTags(repo);

      expect(tags).toContain('TypeScript');
      expect(tags).toContain('react');
      expect(tags).toContain('nextjs');
      expect(tags).toContain('tailwind');
      expect(tags).toHaveLength(4);
    });

    it('should handle repository without language', () => {
      const repo = {
        name: 'test-repo',
        description: 'Test',
        url: 'https://github.com/test/repo',
        language: null,
        stars: 10,
        forks: 2,
        topics: ['documentation'],
        isPrivate: false,
        updatedAt: '2024-01-01',
      };

      const tags = service.parseTechnologyTags(repo);

      expect(tags).toEqual(['documentation']);
    });
  });

  describe('Contribution Graph', () => {
    it('should fetch contribution graph data', async () => {
      const mockContributions = {
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: {
                totalContributions: 1250,
                weeks: [
                  {
                    contributionDays: [
                      { date: '2024-01-01', contributionCount: 5 },
                      { date: '2024-01-02', contributionCount: 3 },
                    ],
                  },
                ],
              },
            },
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockContributions,
      });

      const contributions = await service.getContributionGraph('testuser', mockAccessToken);

      expect(contributions.totalContributions).toBe(1250);
      expect(contributions.weeks).toHaveLength(1);
      expect(contributions.weeks[0].contributionDays).toHaveLength(2);
    });
  });

  describe('Resume Data Enrichment', () => {
    it('should enrich resume data with GitHub information', async () => {
      const mockProfile = {
        login: 'testuser',
        name: 'Test User',
        bio: 'Developer',
        location: 'SF',
        email: 'test@example.com',
        blog: null,
        company: null,
        avatar_url: 'https://avatar.url',
        public_repos: 20,
        followers: 50,
        following: 30,
      };

      const mockPinnedRepos = {
        data: {
          user: {
            pinnedItems: {
              nodes: [
                {
                  name: 'project-one',
                  description: 'First project',
                  url: 'https://github.com/testuser/project-one',
                  primaryLanguage: { name: 'JavaScript' },
                  stargazerCount: 100,
                  forkCount: 20,
                  repositoryTopics: { nodes: [{ topic: { name: 'nodejs' } }] },
                  homepageUrl: null,
                  isPrivate: false,
                  updatedAt: '2024-01-01',
                },
              ],
            },
          },
        },
      };

      const mockReadme = {
        content: Buffer.from('Project description here').toString('base64'),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => mockProfile })
        .mockResolvedValueOnce({ ok: true, json: async () => mockPinnedRepos })
        .mockResolvedValueOnce({ ok: true, json: async () => mockReadme });

      const enrichedData = await service.enrichResumeData('testuser', mockAccessToken);

      expect(enrichedData.username).toBe('testuser');
      expect(enrichedData.repositories).toHaveLength(1);
      expect(enrichedData.repositories[0].name).toBe('project-one');
      expect(enrichedData.repositories[0].language).toBe('JavaScript');
      expect(enrichedData.repositories[0].stars).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(
        service.getRepositoryMetadata('user', 'nonexistent', mockAccessToken)
      ).rejects.toThrow('GitHub resource not found');
    });

    it('should handle rate limit errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(
        service.getUserProfile(mockAccessToken)
      ).rejects.toThrow('GitHub API rate limit exceeded or access forbidden');
    });

    it('should handle general API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        service.getUserProfile(mockAccessToken)
      ).rejects.toThrow('GitHub API request failed');
    });
  });
});
