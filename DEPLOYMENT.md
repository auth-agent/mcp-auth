# Deployment Guide

Complete guide to deploying Auth-Agent MCP to production.

## Prerequisites

- Cloudflare account
- Supabase account
- Node.js 18+ installed
- Wrangler CLI: `npm install -g wrangler`

## Step 1: Set Up Database

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Create new project
3. Note your project URL and service role key

### 1.2 Run Database Schema

```bash
cd supabase
psql $DATABASE_URL < schema.sql
```

Or use Supabase SQL Editor:
1. Go to SQL Editor in Supabase dashboard
2. Copy contents of `supabase/schema.sql`
3. Run the SQL

### 1.3 Verify Tables

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

You should see:
- mcp_servers
- mcp_server_keys
- clients
- auth_requests
- auth_codes
- tokens
- user_authorizations

## Step 2: Configure Cloudflare Worker

### 2.1 Install Dependencies

```bash
cd workers
npm install
```

### 2.2 Set Secrets

```bash
# JWT Secret (generate a random 32-character string)
wrangler secret put JWT_SECRET --env production

# Supabase URL
wrangler secret put SUPABASE_URL --env production

# Supabase Service Key
wrangler secret put SUPABASE_SERVICE_KEY --env production
```

### 2.3 Update wrangler.toml

Edit `workers/wrangler.toml`:

```toml
[env.production]
name = "auth-agent-mcp-production"
route = "mcp.auth-agent.com/*"  # Change to your domain
vars = {
  ENVIRONMENT = "production",
  ISSUER_URL = "https://mcp.auth-agent.com"  # Change to your domain
}
```

## Step 3: Deploy Worker

```bash
cd workers
npm run deploy
```

Output:
```
Published auth-agent-mcp-production (X.XX sec)
  https://auth-agent-mcp-production.YOUR-SUBDOMAIN.workers.dev
  mcp.auth-agent.com/*
```

## Step 4: Configure DNS

### Option A: Cloudflare Pages

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Go to Settings → Triggers → Custom Domains
4. Add: `mcp.auth-agent.com`

### Option B: External DNS

Add CNAME record:
```
mcp.auth-agent.com → auth-agent-mcp-production.YOUR-SUBDOMAIN.workers.dev
```

## Step 5: Test Deployment

### 5.1 Health Check

```bash
curl https://mcp.auth-agent.com/health
```

Expected:
```json
{
  "status": "ok",
  "service": "auth-agent-mcp",
  "version": "1.0.0",
  "environment": "production"
}
```

### 5.2 Discovery Endpoint

```bash
curl https://mcp.auth-agent.com/.well-known/oauth-authorization-server
```

Expected: OAuth server metadata with all endpoints

### 5.3 Protected Resource Metadata

```bash
curl https://mcp.auth-agent.com/.well-known/oauth-protected-resource
```

Expected: Resource metadata with authorization servers

## Step 6: Register First OAuth Client

```bash
# Create a client for testing
curl -X POST https://mcp.auth-agent.com/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "server_url": "https://your-test-server.com",
    "server_name": "Test MCP Server",
    "scopes": ["files:read", "files:write"],
    "user_id": "test_user_id"
  }'
```

## Step 7: Monitor and Maintain

### Logs

View logs in Cloudflare Dashboard:
```
Workers & Pages → auth-agent-mcp-production → Logs
```

Or via CLI:
```bash
wrangler tail --env production
```

### Metrics

Monitor in Cloudflare Dashboard:
- Request count
- Error rate
- P50/P99 latency
- CPU time

### Database Cleanup

Set up cron job to clean expired records:

```sql
-- Run daily
DELETE FROM auth_requests WHERE expires_at < NOW();
DELETE FROM auth_codes WHERE expires_at < NOW();
```

Or use Supabase Edge Functions for automated cleanup.

## Environment Variables Summary

| Variable | Description | Example |
|----------|-------------|---------|
| JWT_SECRET | Secret for signing JWTs | `your_secret_key_here` |
| SUPABASE_URL | Supabase project URL | `https://xxx.supabase.co` |
| SUPABASE_SERVICE_KEY | Supabase service role key | `eyJhbGciOiJIUzI1NiIs...` |
| ISSUER_URL | Auth server URL | `https://mcp.auth-agent.com` |
| ENVIRONMENT | Deployment environment | `production` |

## Scaling Considerations

### Database

- Enable Supabase connection pooling
- Add indexes for frequently queried fields
- Consider read replicas for high traffic

### Worker

- Cloudflare Workers auto-scale
- No configuration needed
- Globally distributed by default

### Rate Limiting

Add rate limiting in worker:

```typescript
// Simple rate limit example
const rateLimiter = new Map();

app.use('*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP');
  const key = `${ip}:${Date.now() / 60000 | 0}`;
  const count = (rateLimiter.get(key) || 0) + 1;

  if (count > 100) { // 100 requests per minute
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  rateLimiter.set(key, count);
  await next();
});
```

## Security Checklist

- [ ] HTTPS enabled on all endpoints
- [ ] JWT secret is strong (32+ characters)
- [ ] Supabase RLS policies enabled
- [ ] API keys stored in Cloudflare secrets
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting set up
- [ ] Database backups enabled

## Troubleshooting

### Worker not responding

```bash
# Check deployment status
wrangler status --env production

# Check logs
wrangler tail --env production
```

### Database connection errors

```bash
# Test Supabase connection
curl -X POST $SUPABASE_URL/rest/v1/mcp_servers \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### OAuth flow errors

Check:
1. Redirect URIs match exactly
2. PKCE challenge/verifier correct
3. Client ID is valid
4. Scopes are supported

## Backup and Recovery

### Database Backup

Supabase automatic backups:
- Point-in-time recovery
- Daily snapshots
- 7-day retention (free tier)

Manual backup:
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Worker Rollback

```bash
# List deployments
wrangler deployments list --env production

# Rollback to previous
wrangler rollback --env production
```

## Next Steps

- Set up monitoring alerts
- Configure CDN caching
- Add custom error pages
- Implement audit logging
- Set up staging environment
