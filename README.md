# GitHub Enterprise Multi-Repo Automation

An enterprise-grade GitHub App for organization-wide automation across multiple repositories.

## Features

### Organization-Wide
- Single GitHub App handles all org repositories
- Centralized webhook listener
- Organization-level statistics and dashboards
- Per-repository configuration and policies

### Per-Repository Automation
- Selective issue auto-commenting
- PR review automation
- Automatic labeling
- Security scanning
- Individual repo stats and logs

### Capabilities
- **Issue Automation**: Auto-summarize, comment, classify
- **PR Review**: Code review, security scan, improvements
- **Multi-Repo Support**: Different settings per repository
- **Logging**: Centralized SQLite database
- **Stats**: Organization and repository-level metrics

## Architecture

```
GitHub Organization
  ├── Repo 1 (auto_issue_comment: enabled, auto_pr_review: enabled)
  ├── Repo 2 (auto_issue_comment: disabled, auto_pr_review: enabled)
  ├── Repo 3 (all disabled)
  └── ...
    ↓
GitHub App (installed at org level)
    ↓
Webhook Listener (single endpoint)
    ↓
Repository Router (checks config)
    ↓
AI Agent (OpenAI)
    ↓
GitHub API (creates comments via installation tokens)
    ↓
Database (centralized logs and stats)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create keys directory

```bash
mkdir -p keys
```

### 3. Place GitHub App private key

```bash
keys/github-private-key.pem
```

### 4. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
APP_ID=123456
WEBHOOK_SECRET=your_webhook_secret
PRIVATE_KEY_PATH=./keys/github-private-key.pem
OPENAI_API_KEY=your_openai_api_key
MODEL_NAME=gpt-4o-mini
PORT=3000
ORG_NAME=your_organization
EXCLUDED_REPOS=archived-repo,old-project
INCLUDED_REPOS=all
```

### 5. Run

```bash
npm start
```

Or dev mode:

```bash
npm run dev
```

## GitHub App Configuration

### Permissions

- **Issues**: Read & Write
- **Pull Requests**: Read & Write
- **Contents**: Read-only
- **Metadata**: Read-only

### Events

- Issues
- Pull Request

### Webhook URL

```
https://your-domain.com/webhook
```

### Installation

Install at organization level to cover all repositories.

## API Endpoints

### GET `/`
Health check

### POST `/webhook`
GitHub webhook listener (signature validated)

### GET `/org/stats`
Organization-wide statistics

```bash
curl http://localhost:3000/org/stats
```

Response:
```json
{
  "total_repos": 10,
  "enabled_repos": 8,
  "total_issues_processed": 156,
  "total_prs_processed": 89,
  "success_rate": 95.6
}
```

### GET `/org/repos`
List all enabled repositories

```bash
curl http://localhost:3000/org/repos
```

### GET `/logs?limit=20`
Recent events across all repos

```bash
curl http://localhost:3000/logs?limit=10
```

### GET `/repo/:owner/:name/stats`
Stats for specific repository

```bash
curl http://localhost:3000/repo/myorg/backend-service/stats
```

### GET `/repo/:owner/:name/logs?limit=10`
Events for specific repository

```bash
curl http://localhost:3000/repo/myorg/frontend-app/logs?limit=5
```

## Per-Repository Configuration

Repositories are configured in the database via:

1. **auto_issue_comment**: Auto-comment on new issues (default: enabled)
2. **auto_pr_review**: Auto-review pull requests (default: enabled)
3. **auto_label**: Auto-label issues (default: enabled)
4. **security_scan**: Security scanning on PRs (default: enabled)

### Register a Repository

In code:

```javascript
const { registerRepository } = require('./db');

registerRepository(
  123456,  // repo ID
  'myorg/backend-service',  // full name
  'myorg',  // owner
  'backend-service',  // name
  {
    auto_issue_comment: true,
    auto_pr_review: true,
    security_scan: true
  }
);
```

## How It Works

### Issue Event Flow

1. User opens issue in any org repository
2. GitHub sends webhook to `/webhook`
3. Signature is validated
4. Repository config is checked
5. If enabled, AI summarizes and comments
6. Event is logged with repository context
7. Organization stats are updated

### PR Event Flow

1. User opens PR in any org repository
2. GitHub sends webhook
3. Repository config checked
4. App fetches PR files
5. AI reviews code (up to 5 files)
6. Security scan runs
7. Comment posted with review
8. PR review logged

## Monitoring

Check organization health:

```bash
curl http://localhost:3000/org/stats
```

Check specific repo performance:

```bash
curl http://localhost:3000/repo/myorg/service-name/stats
```

View recent activity:

```bash
curl http://localhost:3000/logs?limit=50
```

## Database Schema

### repositories
- repo_id (unique)
- full_name
- owner
- name
- enabled
- auto_issue_comment
- auto_pr_review
- auto_label
- security_scan
- config (JSON)
- created_at
- updated_at

### logs
- timestamp
- event_name
- repository
- owner
- issue_number
- pr_number
- action_type
- success

### pr_reviews
- timestamp
- repository
- pr_number
- commit_sha
- review_count
- severity_stats
- success

## Next Features

- [ ] Dashboard UI (React)
- [ ] Manual repo enable/disable API
- [ ] Custom prompts per org/team
- [ ] Slack/Discord notifications
- [ ] Advanced filtering and search
- [ ] Auto-labeling implementation
- [ ] Scheduled repo scans
- [ ] Multi-org support
- [ ] API key management
- [ ] Webhook payload encryption

## Production Deployment

### Using Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Using PM2

```bash
npm install -g pm2
pm2 start server.js --name "github-enterprise-bot"
pm2 save
pm2 startup
```

### Using Systemd

```ini
[Unit]
Description=GitHub Enterprise Automation
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/github-bot
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

**Webhook not being processed**
- Check webhook signature validation
- Verify WEBHOOK_SECRET matches GitHub settings
- Check logs for errors

**Repository not found**
- Ensure app is installed at organization level
- Verify repository is registered in database
- Check APP_ID and private key

**No comments being posted**
- Check repository config (enabled flags)
- Verify OpenAI API key is valid
- Check token permissions

## License

MIT
