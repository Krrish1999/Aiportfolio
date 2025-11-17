# Wrangler CLI Quick Reference

Essential Wrangler commands for managing Cloudflare infrastructure.

## Authentication

```bash
# Login to Cloudflare
wrangler login

# Check authentication status
wrangler whoami

# Logout
wrangler logout
```

## R2 (Object Storage)

```bash
# Create bucket
wrangler r2 bucket create <bucket-name>

# List buckets
wrangler r2 bucket list

# Delete bucket
wrangler r2 bucket delete <bucket-name>

# Upload object
wrangler r2 object put <bucket-name>/<key> --file=<local-file>

# Download object
wrangler r2 object get <bucket-name>/<key> --file=<local-file>

# List objects
wrangler r2 object list <bucket-name>

# Delete object
wrangler r2 object delete <bucket-name>/<key>
```

## KV (Key-Value Storage)

```bash
# Create namespace
wrangler kv:namespace create <namespace-name>

# Create preview namespace
wrangler kv:namespace create <namespace-name> --preview

# List namespaces
wrangler kv:namespace list

# Delete namespace
wrangler kv:namespace delete --namespace-id=<id>

# Put key-value
wrangler kv:key put --namespace-id=<id> "<key>" "<value>"

# Get value
wrangler kv:key get --namespace-id=<id> "<key>"

# List keys
wrangler kv:key list --namespace-id=<id>

# Delete key
wrangler kv:key delete --namespace-id=<id> "<key>"

# Bulk operations
wrangler kv:bulk put --namespace-id=<id> <file.json>
wrangler kv:bulk delete --namespace-id=<id> <file.json>
```

## D1 (SQL Database)

```bash
# Create database
wrangler d1 create <database-name>

# List databases
wrangler d1 list

# Delete database
wrangler d1 delete <database-name>

# Execute SQL command
wrangler d1 execute <database-name> --command="<sql>"

# Execute SQL file
wrangler d1 execute <database-name> --file=<schema.sql>

# Execute with local database
wrangler d1 execute <database-name> --local --command="<sql>"

# Export database
wrangler d1 export <database-name> --output=<backup.sql>

# Time travel (restore to point in time)
wrangler d1 time-travel restore <database-name> --timestamp=<timestamp>
```

## Secrets Management

```bash
# Set secret (interactive)
wrangler secret put <SECRET_NAME>

# List secrets
wrangler secret list

# Delete secret
wrangler secret delete <SECRET_NAME>

# Bulk upload secrets from file
wrangler secret bulk <secrets.json>
```

## Development

```bash
# Start local development server
wrangler dev

# Start with local bindings (no cloud resources)
wrangler dev --local

# Start with remote bindings (uses cloud resources)
wrangler dev --remote

# Start on specific port
wrangler dev --port=8787

# Start with specific environment
wrangler dev --env=staging
```

## Deployment

```bash
# Deploy Worker
wrangler deploy

# Deploy to specific environment
wrangler deploy --env=production

# Deploy Pages project
wrangler pages deploy <directory>

# Deploy with specific project name
wrangler pages deploy <directory> --project-name=<name>

# Deploy with specific branch
wrangler pages deploy <directory> --branch=<branch>
```

## Pages

```bash
# Create Pages project
wrangler pages project create <project-name>

# List Pages projects
wrangler pages project list

# Delete Pages project
wrangler pages project delete <project-name>

# List deployments
wrangler pages deployment list --project-name=<name>

# Tail deployment logs
wrangler pages deployment tail --project-name=<name>
```

## Logs and Monitoring

```bash
# Tail Worker logs (real-time)
wrangler tail

# Tail with filters
wrangler tail --status=error
wrangler tail --method=POST
wrangler tail --search="error"

# Tail specific Worker
wrangler tail --name=<worker-name>

# Tail with sampling rate
wrangler tail --sampling-rate=0.5
```

## Configuration

```bash
# Initialize new project
wrangler init

# Validate wrangler.toml
wrangler deploy --dry-run

# Generate types for bindings
wrangler types

# Show configuration
wrangler whoami
```

## Durable Objects

```bash
# List Durable Objects
wrangler durable-objects list

# Get Durable Object details
wrangler durable-objects get <object-id>

# Delete Durable Object
wrangler durable-objects delete <object-id>
```

## Environment Management

```bash
# Deploy to staging
wrangler deploy --env=staging

# Deploy to production
wrangler deploy --env=production

# Set secret for specific environment
wrangler secret put <SECRET_NAME> --env=production
```

## Troubleshooting

```bash
# Check Wrangler version
wrangler --version

# Update Wrangler
npm install -g wrangler@latest

# Clear cache
rm -rf ~/.wrangler

# Verbose output
wrangler deploy --verbose

# Debug mode
wrangler dev --log-level=debug
```

## Common Workflows

### Initial Setup
```bash
wrangler login
wrangler r2 bucket create ai-resume-storage
wrangler kv:namespace create RESUME_CACHE
wrangler d1 create ai-resume-db
wrangler secret put OPENROUTER_API_KEY
```

### Local Development
```bash
wrangler dev --local
# or
npm run cf:dev
```

### Deploy to Production
```bash
wrangler deploy --env=production
# or
npm run cf:deploy
```

### Database Migration
```bash
wrangler d1 execute ai-resume-db --file=migrations/001_initial.sql
wrangler d1 execute ai-resume-db --command="SELECT * FROM users LIMIT 5"
```

### Monitor Production
```bash
wrangler tail --env=production
wrangler pages deployment tail --project-name=ai-resume-portfolio
```

## Resources

- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Wrangler Commands Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Configuration Reference](https://developers.cloudflare.com/workers/wrangler/configuration/)
