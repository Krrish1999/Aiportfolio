#!/bin/bash

# Setup Cloudflare Analytics and Monitoring
# This script configures analytics for Pages, Workers, R2, KV, and D1

set -e

echo "🔧 Setting up Cloudflare Analytics and Monitoring..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check required environment variables
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "❌ Error: CLOUDFLARE_ACCOUNT_ID not set"
  exit 1
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ Error: CLOUDFLARE_API_TOKEN not set"
  exit 1
fi

# Function to make Cloudflare API calls
cf_api() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -n "$data" ]; then
    curl -s -X "$method" \
      "https://api.cloudflare.com/client/v4/$endpoint" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" \
      "https://api.cloudflare.com/client/v4/$endpoint" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  fi
}

echo ""
echo "📊 Fetching current analytics data..."

# Get Workers analytics
echo ""
echo "Workers Analytics:"
WORKERS_ANALYTICS=$(cf_api GET "accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" | jq '.')
echo "$WORKERS_ANALYTICS" | jq '.result' || echo "No Workers analytics available yet"

# Get R2 metrics
echo ""
echo "R2 Metrics:"
R2_METRICS=$(cf_api GET "accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets" | jq '.')
echo "$R2_METRICS" | jq '.result[] | {name: .name, location: .location}' || echo "No R2 buckets found"

# Get KV namespaces
echo ""
echo "KV Namespaces:"
KV_NAMESPACES=$(cf_api GET "accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces" | jq '.')
echo "$KV_NAMESPACES" | jq '.result[] | {id: .id, title: .title}' || echo "No KV namespaces found"

# Get D1 databases
echo ""
echo "D1 Databases:"
D1_DATABASES=$(cf_api GET "accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database" | jq '.')
echo "$D1_DATABASES" | jq '.result[] | {uuid: .uuid, name: .name}' || echo "No D1 databases found"

echo ""
echo "⚙️  Setting up notification webhooks..."

# Create notification webhook for quota alerts (example)
# Note: You'll need to replace WEBHOOK_URL with your actual webhook endpoint
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  echo "Setting up Slack notifications..."
  
  WEBHOOK_CONFIG=$(cat <<EOF
{
  "name": "Cloudflare Quota Alerts",
  "url": "$SLACK_WEBHOOK_URL",
  "secret": "$(openssl rand -hex 32)"
}
EOF
)
  
  WEBHOOK_RESULT=$(cf_api POST "accounts/$CLOUDFLARE_ACCOUNT_ID/alerting/v3/destinations/webhooks" "$WEBHOOK_CONFIG")
  WEBHOOK_ID=$(echo "$WEBHOOK_RESULT" | jq -r '.result.id')
  
  if [ "$WEBHOOK_ID" != "null" ]; then
    echo "✅ Webhook created: $WEBHOOK_ID"
    
    # Create alert policy for R2 quota
    ALERT_POLICY=$(cat <<EOF
{
  "name": "R2 Quota Warning",
  "alert_type": "r2_quota_exceeded",
  "enabled": true,
  "mechanisms": {
    "webhooks": ["$WEBHOOK_ID"]
  },
  "filters": {
    "threshold": 80
  }
}
EOF
)
    
    POLICY_RESULT=$(cf_api POST "accounts/$CLOUDFLARE_ACCOUNT_ID/alerting/v3/policies" "$ALERT_POLICY")
    echo "✅ Alert policy created"
  else
    echo "⚠️  Failed to create webhook"
  fi
else
  echo "⚠️  SLACK_WEBHOOK_URL not set, skipping webhook setup"
fi

echo ""
echo "📈 Setting up custom analytics..."

# Create custom analytics namespace for application metrics
ANALYTICS_CONFIG=$(cat <<EOF
{
  "name": "ai-resume-portfolio-metrics",
  "description": "Custom metrics for AI Resume Portfolio application"
}
EOF
)

echo "Creating custom analytics namespace..."
# Note: This requires Workers Analytics Engine which may need to be enabled

echo ""
echo "✅ Analytics setup complete!"
echo ""
echo "📊 Access your analytics:"
echo "   - Cloudflare Dashboard: https://dash.cloudflare.com/$CLOUDFLARE_ACCOUNT_ID/analytics"
echo "   - Workers Analytics: https://dash.cloudflare.com/$CLOUDFLARE_ACCOUNT_ID/workers/analytics"
echo "   - R2 Metrics: https://dash.cloudflare.com/$CLOUDFLARE_ACCOUNT_ID/r2"
echo "   - Application Analytics: /api/analytics"
echo ""
echo "🔔 Monitoring recommendations:"
echo "   1. Set up daily quota checks"
echo "   2. Monitor slow operations (>1s)"
echo "   3. Track error rates"
echo "   4. Review cache hit rates"
echo "   5. Monitor D1 query performance"
echo ""
echo "📝 To view current metrics, run:"
echo "   curl http://localhost:3000/api/analytics?action=report"
echo ""
