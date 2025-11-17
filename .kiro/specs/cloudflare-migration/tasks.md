# Implementation Plan

- [x] 1. Set up Cloudflare infrastructure and Wrangler configuration
  - Create Cloudflare account and obtain account ID and API token
  - Install Wrangler CLI globally using npm install -g wrangler
  - Create R2 bucket for file storage using wrangler r2 bucket create ai-resume-storage
  - Create KV namespace for caching using wrangler kv:namespace create RESUME_CACHE
  - Create D1 database using wrangler d1 create ai-resume-db
  - Create wrangler.toml configuration file with all bindings for R2, KV, D1, and Durable Objects
  - Configure environment variables and secrets using wrangler secret put commands
  - Test local development environment with wrangler dev --local
  - _Requirements: 5.1, 5.2, 12.1, 12.2_

- [x] 2. Update project dependencies and configuration
  - Remove AWS SDK packages (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner) from package.json
  - Remove Redis packages (ioredis, redis, bull) from package.json
  - Add @cloudflare/workers-types for TypeScript support
  - Add wrangler as dev dependency
  - Update tsconfig.json to include Cloudflare Workers types
  - Create next.config.js configuration for Cloudflare Pages compatibility
  - Update .env.example with all Cloudflare-specific variables (R2, KV, D1, account ID, API tokens)
  - Create environment validation utility to check required Cloudflare credentials
  - _Requirements: 6.1, 6.2, 12.1, 12.5_

- [x] 3. Migrate file storage service from S3 to R2
- [x] 3.1 Implement R2-based FileStorageService
  - Create new FileStorageService class that accepts CloudflareEnv with R2Bucket binding
  - Implement uploadFile method using R2 put operation with metadata and encryption
  - Implement getSignedUrl method using R2 presigned URL generation
  - Implement downloadFile method using R2 get operation returning ArrayBuffer
  - Implement deleteFile method using R2 delete operation
  - Implement fileExists method using R2 head operation
  - Implement getFileMetadata method to retrieve file size, content type, and custom metadata
  - Replace all Buffer usage with ArrayBuffer for Workers compatibility
  - Add retry logic with exponential backoff for R2 operations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3.2 Update file upload API routes to use R2
  - Modify src/app/api/upload/route.ts to use new R2-based FileStorageService
  - Update file handling to work with Workers Request/Response objects
  - Replace multer with Workers-compatible file parsing
  - Update response format to include R2 URLs
  - _Requirements: 1.1, 6.3_

- [x] 3.3 Write tests for R2 file storage
  - Create unit tests for FileStorageService using Miniflare R2 mocks
  - Test file upload, download, delete, and metadata operations
  - Test error handling for missing files and R2 failures
  - Test signed URL generation and expiration
  - _Requirements: 10.1, 10.2_

- [x] 4. Implement Durable Objects for job queue processing
- [x] 4.1 Create JobQueueDO Durable Object class
  - Create JobQueueDO class extending DurableObject with state management
  - Implement fetch handler for job operations (add, status, cancel, process)
  - Implement addJob method to store jobs in Durable Object storage
  - Implement processJob method with progress tracking and error handling
  - Implement getJobStatus method to query job state from storage
  - Implement cancelJob method to stop processing and clean up resources
  - Add job persistence to Durable Object storage for crash recovery
  - Implement job retry logic with exponential backoff for failed jobs
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 4.2 Create QueueService client for Durable Objects
  - Create QueueService class that communicates with JobQueueDO
  - Implement addResumeProcessingJob method to create Durable Object stub and call add endpoint
  - Implement getJobStatus method to query job progress from Durable Object
  - Implement cancelJob method to signal cancellation to Durable Object
  - Add KV integration for caching completed job results
  - Replace all Bull queue references with Durable Object calls
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4.3 Update API routes to use Durable Objects queue
  - Modify src/app/api/upload/route.ts to use new QueueService with Durable Objects
  - Update src/app/api/status/[sessionId]/route.ts to query Durable Object job status
  - Update src/app/api/cancel/[sessionId]/route.ts to cancel jobs via Durable Objects
  - Remove all Redis and Bull queue initialization code
  - _Requirements: 2.1, 2.2, 2.4, 6.3_

- [x] 4.4 Write tests for Durable Objects queue
  - Create unit tests for JobQueueDO using Miniflare Durable Objects mocks
  - Test job addition, processing, status queries, and cancellation
  - Test job persistence and recovery after crashes
  - Test concurrent job processing and state management
  - _Requirements: 10.1, 10.3_

- [x] 5. Migrate database from PostgreSQL to D1
- [x] 5.1 Convert Prisma schema to D1-compatible SQLite
  - Update prisma/schema.prisma to use SQLite-compatible types
  - Replace UUID types with String and use crypto.randomUUID() in code
  - Replace JSONB with String and add JSON serialization in code
  - Replace Boolean with Int (0/1) for SQLite compatibility
  - Replace DateTime with String using ISO 8601 format
  - Replace Decimal with Float for numeric fields
  - Generate new Prisma migrations for SQLite syntax
  - Create D1 migration SQL files from Prisma migrations
  - _Requirements: 3.2, 6.3_

- [x] 5.2 Create DatabaseService for D1 operations
  - Create DatabaseService class that accepts CloudflareEnv with D1Database binding
  - Implement user CRUD operations using D1 prepare and bind methods
  - Implement resume session CRUD operations with JSON serialization for parsed_data
  - Implement portfolio CRUD operations with JSON serialization for customizations
  - Implement parsing metrics operations with proper type conversions
  - Add transaction support using D1 exec with BEGIN/COMMIT
  - Add batch operations using D1 batch API for bulk inserts
  - Implement query result mapping to convert D1 results to TypeScript types
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5.3 Update all database consumers to use D1
  - Replace Prisma client imports with DatabaseService in all API routes
  - Update src/app/api/upload/route.ts to use D1 DatabaseService
  - Update src/app/api/status/[sessionId]/route.ts to query D1
  - Update resume parser service to save results to D1
  - Update deployment service to store deployment records in D1
  - Remove Prisma client initialization from src/config/database.ts
  - _Requirements: 3.1, 6.3_

- [x] 5.4 Write tests for D1 database operations
  - Create unit tests for DatabaseService using Miniflare D1 mocks
  - Test CRUD operations for users, sessions, portfolios, and metrics
  - Test JSON serialization and deserialization for JSONB fields
  - Test transaction support and rollback on errors
  - Test batch operations for bulk inserts
  - _Requirements: 10.1, 10.4_

- [x] 6. Update deployment service to use Cloudflare Pages
- [x] 6.1 Implement Cloudflare Pages deployment
  - Create new deployToCloudflarePages method in DeploymentService
  - Implement Cloudflare Pages API integration for project creation
  - Implement file upload to Pages using FormData and multipart requests
  - Implement deployment status polling using Pages API
  - Add custom domain setup using Pages domains API
  - Add SSL certificate validation and status checking
  - Remove Vercel and Netlify deployment methods
  - Update DeploymentConfig type to only support cloudflare-pages platform
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6.2 Update deployment API routes
  - Modify deployment-related API routes to use Cloudflare Pages exclusively
  - Update response format to include Pages-specific URLs (*.pages.dev)
  - Add error handling for Pages API failures
  - _Requirements: 8.1, 8.4, 6.3_

- [ ] 6.3 Write tests for Cloudflare Pages deployment
  - Create unit tests for DeploymentService with mocked Pages API
  - Test project creation, file upload, and deployment status
  - Test custom domain setup and SSL validation
  - Test error handling for deployment failures
  - _Requirements: 10.1, 10.2_

- [-] 7. Implement Cloudflare AI Workers integration (optional)
- [x] 7.1 Create Cloudflare AI service wrapper
  - Create CloudflareAIService class that uses Workers AI binding
  - Implement text generation using @cf/meta/llama-3-8b-instruct model
  - Implement content enhancement methods matching OpenRouter interface
  - Add model selection logic to choose between OpenRouter and Cloudflare AI
  - Implement fallback mechanism from OpenRouter to Cloudflare AI on failures
  - Add response quality validation to ensure >85% similarity between providers
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 7.2 Update AI content generator to support dual providers
  - Modify src/services/ai-content-generator.ts to accept provider configuration
  - Add provider selection logic based on environment variables
  - Implement automatic fallback when primary provider fails
  - Add configuration option to disable Cloudflare AI and use OpenRouter exclusively
  - _Requirements: 7.1, 7.3, 7.5_

- [x] 7.3 Write tests for Cloudflare AI integration
  - Create unit tests for CloudflareAIService with mocked Workers AI responses
  - Test provider selection and fallback logic
  - Test content quality comparison between providers
  - Test error handling when both providers fail
  - _Requirements: 10.1, 10.2_

- [x] 8. Implement Cloudflare-specific error handling
  - Create CloudflareErrorHandler utility class with methods for R2, D1, KV, and Workers errors
  - Implement handleR2Error method for NoSuchKey, EntityTooLarge, and rate limit errors
  - Implement handleD1Error method for UNIQUE constraint, FOREIGN KEY, and syntax errors
  - Implement handleKVError method for quota exceeded and rate limit errors
  - Implement handleWorkerError method for CPU time limit and memory limit errors
  - Create withRetry utility function with exponential backoff for transient failures
  - Add retry logic to all R2, D1, and KV operations with max 3 attempts
  - Update all service error handling to use CloudflareErrorHandler
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. Configure Next.js for Cloudflare Pages deployment
  - Update next.config.js to enable edge runtime for API routes
  - Configure output: 'export' for static site generation where applicable
  - Add edge runtime configuration for API routes that need Workers
  - Create _worker.js file for custom Workers configuration if needed
  - Update build scripts in package.json to use wrangler pages deploy
  - Configure environment variables for Pages deployment
  - Test local build with wrangler pages dev
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 10. Create data migration scripts
- [x] 10.1 Create S3 to R2 migration script
  - Create migration script to list all objects in S3 bucket
  - Implement parallel file transfer from S3 to R2 with progress tracking
  - Add checksum verification for each transferred file
  - Implement resume capability for interrupted migrations
  - Add logging for successful and failed transfers
  - Create rollback mechanism to delete R2 files if migration fails
  - _Requirements: 11.1, 11.4_

- [x] 10.2 Create PostgreSQL to D1 migration script
  - Create script to export all tables from PostgreSQL to JSON
  - Implement data transformation for PostgreSQL to SQLite type conversions
  - Create D1 import script using batch API for performance
  - Add referential integrity validation after import
  - Implement data verification by comparing row counts and sample records
  - Create rollback script to clear D1 database if migration fails
  - _Requirements: 11.2, 11.4, 11.5_

- [x] 10.3 Create Redis to KV/Durable Objects migration script
  - Create script to export active job states from Redis
  - Transform Redis job data to Durable Object format
  - Import job states to KV for caching
  - Recreate active jobs in Durable Objects
  - Verify all jobs are accessible after migration
  - _Requirements: 11.3, 11.4_

- [x] 10.4 Test migration scripts with sample data
  - Create sample dataset mimicking production data
  - Run migration scripts against sample data
  - Verify data integrity and completeness
  - Test rollback mechanisms
  - Document migration procedures and troubleshooting steps
  - _Requirements: 11.4, 11.5_

- [x] 11. Update all tests to work with Cloudflare services
  - Update vitest.config.mts to use miniflare environment
  - Configure Miniflare with mock bindings for R2, KV, D1, and Durable Objects
  - Update all existing tests to use Cloudflare service mocks instead of AWS/Redis mocks
  - Replace AWS SDK mocks with R2 mocks in file storage tests
  - Replace Redis mocks with Durable Object mocks in queue tests
  - Replace PostgreSQL mocks with D1 mocks in database tests
  - Update test setup to initialize Miniflare bindings
  - Ensure all tests pass with Cloudflare services
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 12. Deploy to Cloudflare Pages and verify functionality
  - Run final build using npm run build
  - Deploy to Cloudflare Pages using wrangler pages deploy
  - Verify all API routes are working correctly
  - Test file upload and storage in R2
  - Test job processing with Durable Objects
  - Test database operations with D1
  - Test portfolio deployment to Pages
  - Monitor error logs and performance metrics
  - Configure custom domain if needed
  - Update DNS records to point to Cloudflare Pages
  - _Requirements: 4.1, 4.2, 4.5, 8.1, 8.2, 8.3_

- [x] 13. Perform production data migration
  - Schedule maintenance window for migration
  - Run S3 to R2 migration script with production data
  - Run PostgreSQL to D1 migration script with production data
  - Run Redis to KV/Durable Objects migration script
  - Verify 100% data transfer with checksums and row counts
  - Test application functionality with migrated data
  - Monitor for errors and performance issues
  - Keep AWS infrastructure running in parallel for rollback capability
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 14. Monitor and optimize Cloudflare deployment
  - Set up Cloudflare Analytics for Pages and Workers
  - Monitor R2 operation counts and costs
  - Monitor KV read/write operations and quota usage
  - Monitor D1 query performance and row counts
  - Monitor Workers CPU time and memory usage
  - Identify and optimize slow queries and operations
  - Implement caching strategies to reduce D1 and R2 operations
  - Configure alerts for quota limits and errors
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 15. Decommission AWS infrastructure
  - Verify all functionality working on Cloudflare for at least 7 days
  - Confirm no errors or data issues reported
  - Create final backup of AWS S3 and PostgreSQL data
  - Delete all objects from S3 bucket
  - Delete S3 bucket
  - Terminate PostgreSQL database instance
  - Terminate Redis instance
  - Remove AWS credentials from environment variables
  - Remove AWS SDK packages from package.json
  - Update documentation to reflect Cloudflare-only infrastructure
  - _Requirements: 11.5, 6.1_
