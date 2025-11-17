# GitHub Integration Usage Guide

This guide explains how to use the GitHub integration service to enrich resume data with GitHub profile information.

## Overview

The GitHub integration provides:
- OAuth authentication flow
- Fetching pinned repositories
- Extracting repository metadata and README snippets
- Parsing technology tags from repositories
- Contribution graph data
- Complete resume data enrichment

## Setup

### Environment Variables

Add the following to your `.env` file:

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### GitHub OAuth App Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL to: `http://localhost:3000/api/auth/github/callback` (for development)
4. Copy the Client ID and Client Secret to your `.env` file

## API Endpoints

### 1. Initiate OAuth Flow

**Endpoint:** `GET /api/auth/github`

**Query Parameters:**
- `returnUrl` (optional): URL to redirect after successful authentication

**Example:**
```javascript
// Redirect user to GitHub OAuth
window.location.href = '/api/auth/github?returnUrl=/editor';
```

### 2. OAuth Callback

**Endpoint:** `GET /api/auth/github/callback`

This endpoint is automatically called by GitHub after user authorization. It:
- Validates the OAuth state
- Exchanges the authorization code for an access token
- Stores the token in a secure HTTP-only cookie
- Redirects to the return URL

### 3. Get User Profile

**Endpoint:** `GET /api/github/profile`

**Response:**
```json
{
  "login": "username",
  "name": "Full Name",
  "bio": "Software Engineer",
  "location": "San Francisco, CA",
  "email": "user@example.com",
  "blog": "https://user.dev",
  "company": "Tech Corp",
  "avatarUrl": "https://avatars.githubusercontent.com/u/123",
  "publicRepos": 42,
  "followers": 100,
  "following": 50
}
```

### 4. Enrich Resume Data

**Endpoint:** `GET /api/github/enrich`

**Response:**
```json
{
  "username": "username",
  "repositories": [
    {
      "name": "awesome-project",
      "description": "An awesome project description",
      "url": "https://github.com/username/awesome-project",
      "language": "TypeScript",
      "stars": 150,
      "forks": 25,
      "topics": ["react", "nextjs", "typescript"]
    }
  ]
}
```

## Direct Service Usage

### Initialize Service

```typescript
import { GitHubIntegrationService } from '@/services/github-integration';

const githubService = new GitHubIntegrationService(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!
);
```

### Fetch Pinned Repositories

```typescript
const repos = await githubService.getPinnedRepositories(
  'username',
  accessToken
);

console.log(repos);
// [
//   {
//     name: 'project-name',
//     description: 'Project description',
//     url: 'https://github.com/username/project-name',
//     language: 'TypeScript',
//     stars: 100,
//     forks: 20,
//     topics: ['react', 'nextjs'],
//     homepage: 'https://project.com',
//     isPrivate: false,
//     updatedAt: '2024-01-15T10:30:00Z'
//   }
// ]
```

### Extract README Snippet

```typescript
const readme = await githubService.getRepositoryReadme(
  'username',
  'repo-name',
  accessToken
);

console.log(readme);
// "This is a comprehensive description of the project..."
```

### Parse Technology Tags

```typescript
const tags = githubService.parseTechnologyTags(repository);

console.log(tags);
// ['TypeScript', 'react', 'nextjs', 'tailwind']
```

### Get Contribution Graph

```typescript
const contributions = await githubService.getContributionGraph(
  'username',
  accessToken
);

console.log(contributions);
// {
//   totalContributions: 1250,
//   weeks: [
//     {
//       contributionDays: [
//         { date: '2024-01-01', contributionCount: 5 },
//         { date: '2024-01-02', contributionCount: 3 }
//       ]
//     }
//   ]
// }
```

### Complete Resume Enrichment

```typescript
const enrichedData = await githubService.enrichResumeData(
  'username',
  accessToken
);

// Use enrichedData to populate resume projects section
```

## Frontend Integration Example

### React Component

```typescript
'use client';

import { useState } from 'react';
import { GitHubData } from '@/types';

export function GitHubConnect() {
  const [githubData, setGithubData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    window.location.href = '/api/auth/github?returnUrl=/editor';
  };

  const fetchGitHubData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/github/enrich');
      if (response.ok) {
        const data = await response.json();
        setGithubData(data);
      }
    } catch (error) {
      console.error('Failed to fetch GitHub data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleConnect}>
        Connect GitHub
      </button>
      
      {githubData && (
        <div>
          <h3>GitHub Projects</h3>
          {githubData.repositories.map(repo => (
            <div key={repo.name}>
              <h4>{repo.name}</h4>
              <p>{repo.description}</p>
              <p>⭐ {repo.stars} | Language: {repo.language}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Error Handling

The service handles various error scenarios:

- **404 Not Found**: Resource doesn't exist
- **403 Forbidden**: Rate limit exceeded or access denied
- **OAuth Errors**: Invalid state, missing code, or authorization denied
- **Network Errors**: Connection issues or API downtime

All errors are logged and returned with appropriate HTTP status codes.

## Security Considerations

1. **CSRF Protection**: OAuth state parameter prevents CSRF attacks
2. **Secure Cookies**: Access tokens stored in HTTP-only cookies
3. **Token Expiration**: Tokens expire after 30 days
4. **HTTPS Only**: Secure cookies only sent over HTTPS in production

## Rate Limits

GitHub API has rate limits:
- **Authenticated requests**: 5,000 requests per hour
- **GraphQL API**: 5,000 points per hour

The service automatically handles rate limit errors and returns appropriate error messages.

## Testing

Run tests with:

```bash
npm test -- src/services/__tests__/github-integration.test.ts --run
```

See test files for examples of mocking GitHub API responses.
