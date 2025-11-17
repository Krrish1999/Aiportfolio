# AI Resume-to-Portfolio

An AI-powered application that transforms resumes into beautiful, deployable portfolio websites using Cloudflare's edge platform.

## Features

- 📄 **Resume Parsing**: Upload PDF/DOCX resumes with intelligent parsing
- 🤖 **AI Enhancement**: Enhance content using OpenRouter or Cloudflare AI
- 🎨 **Multiple Templates**: Choose from various portfolio templates
- ⚡ **Edge Deployment**: Deploy portfolios to Cloudflare Pages
- 🔒 **Secure Storage**: Files stored in Cloudflare R2
- 📊 **Job Processing**: Background jobs with Durable Objects
- 💾 **Serverless Database**: Data stored in Cloudflare D1

## Tech Stack

### Frontend
- **Next.js 15** - React framework
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

### Backend (Cloudflare Edge)
- **Cloudflare Pages** - Static site hosting
- **Cloudflare Workers** - Serverless compute
- **Cloudflare R2** - Object storage (S3-compatible)
- **Cloudflare KV** - Key-value cache
- **Cloudflare D1** - Serverless SQL database
- **Durable Objects** - Stateful serverless compute

### AI Services
- **OpenRouter** - AI content generation (DeepSeek R1)
- **Cloudflare AI** - Edge AI inference (optional)

## Quick Start

### Prerequisites

- Node.js v20.0.0 or higher
- npm v10 or higher
- Cloudflare account
- Wrangler CLI

### Installation

```bash
# Clone repository
git clone <repository-url>
cd ai-resume-portfolio

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Deployment

### Quick Deployment

```bash
# Deploy to staging
npm run cf:deploy:staging

# Deploy to production
npm run cf:deploy:production
```

### First-Time Setup

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Create Cloudflare Resources**
   ```bash
   npm run cf:setup
   ```

3. **Configure Secrets**
   ```bash
   wrangler secret put OPENROUTER_API_KEY
   wrangler secret put NEXTAUTH_SECRET
   ```

4. **Deploy**
   ```bash
   npm run cf:deploy:production
   ```

See [DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md) for detailed instructions.

## Documentation

- 📖 [Deployment Quick Start](./DEPLOYMENT_QUICK_START.md) - Quick deployment guide
- 📚 [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Comprehensive deployment documentation
- 📋 [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Step-by-step checklist
- 🔧 [Cloudflare Setup](./CLOUDFLARE_SETUP.md) - Initial Cloudflare configuration
- 📄 [Pages Environment Setup](./PAGES_ENV_SETUP.md) - Environment variables guide
- 🔄 [Migration Guide](./scripts/MIGRATION_GUIDE.md) - AWS to Cloudflare migration

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Testing
npm run test             # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:ui          # Run tests with UI

# Cloudflare
npm run cf:setup         # Set up Cloudflare resources
npm run cf:dev           # Run with Wrangler dev server
npm run cf:check         # Pre-deployment checks
npm run cf:deploy        # Deploy to staging
npm run cf:deploy:production  # Deploy to production
npm run cf:verify        # Verify deployment
npm run cf:tail          # View logs

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio
```

### Local Development with Cloudflare

```bash
# Start Wrangler dev server (with R2, KV, D1 emulation)
npm run cf:dev

# Or use Next.js dev server
npm run dev
```

### Running Tests

```bash
# Run all tests
npm run test:run

# Run specific test file
npm run test src/services/__tests__/file-storage.test.ts

# Run tests with UI
npm run test:ui
```

## Project Structure

```
ai-resume-portfolio/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── api/            # API routes
│   │   └── page.tsx        # Main page
│   ├── components/         # React components
│   ├── services/           # Business logic
│   │   ├── file-storage.ts      # R2 file storage
│   │   ├── queue.ts             # Durable Objects queue
│   │   ├── database.ts          # D1 database
│   │   ├── deployment.ts        # Pages deployment
│   │   └── durable-objects/     # Durable Objects
│   ├── config/             # Configuration
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── scripts/                # Deployment and migration scripts
├── prisma/                 # Database schema and migrations
├── .kiro/specs/           # Feature specifications
├── wrangler.toml          # Cloudflare configuration
├── next.config.js         # Next.js configuration
├── _worker.js             # Custom Workers configuration
└── package.json           # Dependencies and scripts
```

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Cloudflare Edge Network               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                 │
│  │  Next.js App │───▶│  API Routes  │                 │
│  │  (Pages)     │    │  (Workers)   │                 │
│  └──────────────┘    └──────┬───────┘                 │
│                              │                          │
│         ┌────────────────────┼────────────────────┐    │
│         │                    │                    │    │
│         ▼                    ▼                    ▼    │
│  ┌──────────┐        ┌──────────┐        ┌──────────┐ │
│  │    R2    │        │    KV    │        │    D1    │ │
│  │ Storage  │        │  Cache   │        │ Database │ │
│  └──────────┘        └──────────┘        └──────────┘ │
│                                                         │
│         ┌────────────────────────────────────┐         │
│         │      Durable Objects               │         │
│         │      (Job Processing)              │         │
│         └────────────────────────────────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Components

- **Pages**: Hosts the Next.js frontend
- **Workers**: Executes API routes at the edge
- **R2**: Stores uploaded resumes and generated files
- **KV**: Caches job results and session data
- **D1**: Stores user data, sessions, and portfolios
- **Durable Objects**: Manages stateful job processing

## Environment Variables

### Required Secrets

Set these using `wrangler secret put`:

- `OPENROUTER_API_KEY` - OpenRouter API key
- `GITHUB_CLIENT_SECRET` - GitHub OAuth secret
- `LINKEDIN_CLIENT_SECRET` - LinkedIn OAuth secret
- `NEXTAUTH_SECRET` - NextAuth.js secret
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token

### Public Variables

Set these in `wrangler.toml`:

- `NODE_ENV` - Environment (production/staging)
- `R2_PUBLIC_URL` - R2 bucket public URL
- `OPENROUTER_MODEL` - AI model to use
- `WORKERS_AI_MODEL` - Cloudflare AI model

See [.env.example](./.env.example) for all variables.

## Monitoring

### View Logs

```bash
# Real-time logs
wrangler tail

# Filter by status
wrangler tail --status error
```

### Analytics

Visit Cloudflare Dashboard:
- Workers & Pages → ai-resume-portfolio → Analytics

### Resource Usage

```bash
# R2 storage
wrangler r2 bucket info ai-resume-storage

# D1 database
wrangler d1 execute ai-resume-db --command="SELECT COUNT(*) FROM users;"

# KV namespace (via Dashboard)
```

## Troubleshooting

### Build Issues

```bash
# Clear cache and rebuild
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### Deployment Issues

```bash
# Re-authenticate
wrangler logout
wrangler login

# Check configuration
npm run cf:check
```

### API Issues

```bash
# View logs
wrangler tail

# Check bindings
grep -A 5 "bindings" wrangler.toml

# Verify secrets
wrangler secret list
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed troubleshooting.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:run`
5. Submit a pull request

## License

[Your License Here]

## Support

- 📚 [Documentation](./DEPLOYMENT_GUIDE.md)
- 💬 [Cloudflare Community](https://community.cloudflare.com/)
- 🐛 [Report Issues](https://github.com/your-repo/issues)

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Cloudflare](https://cloudflare.com/)
- AI by [OpenRouter](https://openrouter.ai/)

---

**Made with ❤️ using Cloudflare's edge platform**
