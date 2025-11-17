import { GitHubData } from '@/types';

export interface GitHubRepository {
  name: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  readme?: string;
  homepage?: string | null;
  isPrivate: boolean;
  updatedAt: string;
}

export interface GitHubContributionData {
  totalContributions: number;
  weeks: {
    contributionDays: {
      date: string;
      contributionCount: number;
    }[];
  }[];
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  email: string | null;
  blog: string | null;
  company: string | null;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
}

export interface GitHubOAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export class GitHubIntegrationService {
  private readonly baseUrl = 'https://api.github.com';
  private readonly oauthUrl = 'https://github.com/login/oauth';
  
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  /**
   * Generate OAuth authorization URL for GitHub
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user,repo',
      state,
    });
    
    return `${this.oauthUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    const response = await fetch(`${this.oauthUrl}/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub OAuth token exchange failed: ${response.statusText}`);
    }

    const data: GitHubOAuthTokenResponse = await response.json();
    return data.access_token;
  }

  /**
   * Fetch user profile information
   */
  async getUserProfile(accessToken: string): Promise<GitHubProfile> {
    const response = await this.makeRequest('/user', accessToken);
    
    return {
      login: response.login,
      name: response.name,
      bio: response.bio,
      location: response.location,
      email: response.email,
      blog: response.blog,
      company: response.company,
      avatarUrl: response.avatar_url,
      publicRepos: response.public_repos,
      followers: response.followers,
      following: response.following,
    };
  }

  /**
   * Fetch pinned repositories for a user
   */
  async getPinnedRepositories(username: string, accessToken: string): Promise<GitHubRepository[]> {
    // GitHub GraphQL API for pinned repos
    const query = `
      query {
        user(login: "${username}") {
          pinnedItems(first: 6, types: REPOSITORY) {
            nodes {
              ... on Repository {
                name
                description
                url
                primaryLanguage {
                  name
                }
                stargazerCount
                forkCount
                repositoryTopics(first: 10) {
                  nodes {
                    topic {
                      name
                    }
                  }
                }
                homepageUrl
                isPrivate
                updatedAt
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pinned repositories: ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const pinnedItems = data.data?.user?.pinnedItems?.nodes || [];
    
    return pinnedItems.map((repo: any) => ({
      name: repo.name,
      description: repo.description,
      url: repo.url,
      language: repo.primaryLanguage?.name || null,
      stars: repo.stargazerCount,
      forks: repo.forkCount,
      topics: repo.repositoryTopics.nodes.map((t: any) => t.topic.name),
      homepage: repo.homepageUrl,
      isPrivate: repo.isPrivate,
      updatedAt: repo.updatedAt,
    }));
  }

  /**
   * Fetch repository metadata
   */
  async getRepositoryMetadata(
    owner: string,
    repo: string,
    accessToken: string
  ): Promise<GitHubRepository> {
    const response = await this.makeRequest(`/repos/${owner}/${repo}`, accessToken);
    
    return {
      name: response.name,
      description: response.description,
      url: response.html_url,
      language: response.language,
      stars: response.stargazers_count,
      forks: response.forks_count,
      topics: response.topics || [],
      homepage: response.homepage,
      isPrivate: response.private,
      updatedAt: response.updated_at,
    };
  }

  /**
   * Extract README content from a repository
   */
  async getRepositoryReadme(
    owner: string,
    repo: string,
    accessToken: string
  ): Promise<string | null> {
    try {
      const response = await this.makeRequest(`/repos/${owner}/${repo}/readme`, accessToken);
      
      // README content is base64 encoded
      if (response.content) {
        const decoded = Buffer.from(response.content, 'base64').toString('utf-8');
        return this.extractReadmeSnippet(decoded);
      }
      
      return null;
    } catch (error) {
      // README might not exist
      return null;
    }
  }

  /**
   * Extract a meaningful snippet from README (first paragraph or description)
   */
  private extractReadmeSnippet(readme: string, maxLength: number = 300): string {
    // Remove markdown headers
    let content = readme.replace(/^#+\s+.+$/gm, '');
    
    // Remove code blocks
    content = content.replace(/```[\s\S]*?```/g, '');
    
    // Remove inline code
    content = content.replace(/`[^`]+`/g, '');
    
    // Remove links but keep text
    content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Remove images
    content = content.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    
    // Get first meaningful paragraph
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 20);
    
    if (paragraphs.length === 0) {
      return '';
    }
    
    let snippet = paragraphs[0].trim().replace(/\s+/g, ' ');
    
    if (snippet.length > maxLength) {
      snippet = snippet.substring(0, maxLength).trim() + '...';
    }
    
    return snippet;
  }

  /**
   * Parse technology tags from repository topics and language
   */
  parseTechnologyTags(repository: GitHubRepository): string[] {
    const tags = new Set<string>();
    
    // Add primary language
    if (repository.language) {
      tags.add(repository.language);
    }
    
    // Add topics (GitHub topics are already technology-focused)
    repository.topics.forEach(topic => {
      tags.add(topic);
    });
    
    return Array.from(tags);
  }

  /**
   * Fetch contribution graph data
   */
  async getContributionGraph(username: string, accessToken: string): Promise<GitHubContributionData> {
    const query = `
      query {
        user(login: "${username}") {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch contribution graph: ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data?.user?.contributionsCollection?.contributionCalendar || {
      totalContributions: 0,
      weeks: [],
    };
  }

  /**
   * Enrich resume data with GitHub information
   */
  async enrichResumeData(
    username: string,
    accessToken: string
  ): Promise<GitHubData> {
    const [profile, pinnedRepos] = await Promise.all([
      this.getUserProfile(accessToken),
      this.getPinnedRepositories(username, accessToken),
    ]);

    // Fetch README snippets for pinned repos
    const reposWithReadme = await Promise.all(
      pinnedRepos.map(async (repo) => {
        const readme = await this.getRepositoryReadme(username, repo.name, accessToken);
        return {
          ...repo,
          readme: readme || undefined,
        };
      })
    );

    return {
      username: profile.login,
      repositories: reposWithReadme.map(repo => ({
        name: repo.name,
        description: repo.description || repo.readme || '',
        url: repo.url,
        language: repo.language || 'Unknown',
        stars: repo.stars,
        forks: repo.forks,
        topics: repo.topics,
      })),
    };
  }

  /**
   * Make authenticated request to GitHub API
   */
  private async makeRequest(endpoint: string, accessToken: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`GitHub resource not found: ${endpoint}`);
      }
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded or access forbidden');
      }
      throw new Error(`GitHub API request failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const githubIntegrationService = new GitHubIntegrationService(
  process.env.GITHUB_CLIENT_ID || '',
  process.env.GITHUB_CLIENT_SECRET || ''
);
