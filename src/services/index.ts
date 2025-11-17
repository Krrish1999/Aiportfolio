// Export all services from this directory
export { FileStorageService, createFileStorageService } from './file-storage';
export { QueueService, createQueueService } from './queue';
export type { ResumeProcessingJobData, JobProgress, JobResult } from './queue';

// Database service
export { DatabaseService } from './database';
export type { 
  User, 
  ResumeSession, 
  Portfolio, 
  ParsingMetric,
  CreateUserInput,
  CreateResumeSessionInput,
  UpdateResumeSessionInput,
  CreatePortfolioInput,
  UpdatePortfolioInput,
  CreateParsingMetricInput
} from './database';

// Resume parsing services
export { PDFParserService } from './pdf-parser';
export type { PDFExtractionResult, PDFPageData, PDFTextItem } from './pdf-parser';

export { ContentExtractorService } from './content-extractor';
export type { ExtractionResult, ExtractedField, SectionBoundary } from './content-extractor';

export { ResumeParserService } from './resume-parser';
export type { ResumeParsingResult, ParsingOptions } from './resume-parser';

// AI content generation services
export { aiContentGenerator, createAIContentGenerator } from './ai-content-generator';
export type { AIContentGeneratorService, DeveloperRole, AIProvider, AIProviderConfig } from './ai-content-generator';

// Cloudflare AI service
export { 
  CloudflareAIService, 
  createCloudflareAIService,
  AIProviderService,
  createAIProviderService
} from './cloudflare-ai';
export type { 
  CloudflareAIOptions,
  AIProvider as CloudflareAIProvider,
  AIProviderConfig as CloudflareAIProviderConfig
} from './cloudflare-ai';

// External integration services
export { GitHubIntegrationService, githubIntegrationService } from './github-integration';
export type { GitHubRepository, GitHubContributionData, GitHubProfile, GitHubOAuthTokenResponse } from './github-integration';

export { LinkedInIntegrationService, linkedInIntegrationService } from './linkedin-integration';
export type { LinkedInProfile, LinkedInPosition, LinkedInEducation, LinkedInOAuthTokenResponse, LinkedInAPIError } from './linkedin-integration';

// Deployment and static site generation services
export { StaticSiteGenerator, staticSiteGenerator } from './static-site-generator';
export type { CustomizationOptions, StaticSite, SitemapEntry } from './static-site-generator';

export { DeploymentService, deploymentService } from './deployment';
export type { DeploymentResult, DeploymentStatus, CustomDomainConfig, DeploymentFiles } from './deployment';

// Analytics and metrics collection service
export { AnalyticsService } from './analytics';
export type { 
  ParsingMetrics, 
  FieldMetric, 
  SessionAnalytics, 
  AggregatedMetrics, 
  TimeMetrics 
} from './analytics';
