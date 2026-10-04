const Database = require("better-sqlite3");
const db = new Database("enterprise_logs.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER UNIQUE,
    full_name TEXT UNIQUE,
    owner TEXT,
    name TEXT,
    enabled INTEGER DEFAULT 1,
    auto_issue_comment INTEGER DEFAULT 1,
    auto_pr_review INTEGER DEFAULT 1,
    auto_label INTEGER DEFAULT 1,
    security_scan INTEGER DEFAULT 1,
    config TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    event_name TEXT,
    repository TEXT,
    owner TEXT,
    issue_number INTEGER,
    pr_number INTEGER,
    user_input TEXT,
    agent_output TEXT,
    action_type TEXT,
    success INTEGER
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pr_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    repository TEXT,
    pr_number INTEGER,
    commit_sha TEXT,
    review_count INTEGER,
    severity_stats TEXT,
    success INTEGER
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS org_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    total_repos INTEGER,
    enabled_repos INTEGER,
    total_issues_processed INTEGER,
    total_prs_processed INTEGER,
    success_rate REAL
  )
`);

function registerRepository(repoId, fullName, owner, name, config = {}) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO repositories (repo_id, full_name, owner, name, auto_issue_comment, auto_pr_review, auto_label, security_scan, config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    repoId,
    fullName,
    owner,
    name,
    config.auto_issue_comment !== false ? 1 : 0,
    config.auto_pr_review !== false ? 1 : 0,
    config.auto_label !== false ? 1 : 0,
    config.security_scan !== false ? 1 : 0,
    JSON.stringify(config),
    new Date().toISOString(),
    new Date().toISOString()
  );
}

function getRepository(fullName) {
  const stmt = db.prepare(`
    SELECT * FROM repositories WHERE full_name = ? AND enabled = 1
  `);

  return stmt.get(fullName);
}

function getRepositoryConfig(fullName) {
  const repo = getRepository(fullName);
  if (!repo) return null;
  return JSON.parse(repo.config || '{}');
}

function getAllEnabledRepositories() {
  const stmt = db.prepare(`
    SELECT * FROM repositories WHERE enabled = 1
  `);

  return stmt.all();
}

function saveLog(eventName, repository, owner, issueNumber, prNumber, userInput, agentOutput, actionType, success) {
  const stmt = db.prepare(`
    INSERT INTO logs (timestamp, event_name, repository, owner, issue_number, pr_number, user_input, agent_output, action_type, success)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    new Date().toISOString(),
    eventName,
    repository,
    owner,
    issueNumber || null,
    prNumber || null,
    userInput,
    agentOutput,
    actionType,
    success
  );
}

function savePrReview(repository, prNumber, commitSha, reviewCount, severityStats, success) {
  const stmt = db.prepare(`
    INSERT INTO pr_reviews (timestamp, repository, pr_number, commit_sha, review_count, severity_stats, success)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    new Date().toISOString(),
    repository,
    prNumber,
    commitSha,
    reviewCount,
    JSON.stringify(severityStats),
    success
  );
}

function getRecentLogs(limit = 20) {
  const stmt = db.prepare(`
    SELECT timestamp, event_name, repository, owner, issue_number, pr_number, action_type, success
    FROM logs
    ORDER BY id DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

function getLogsByRepository(repository, limit = 10) {
  const stmt = db.prepare(`
    SELECT timestamp, event_name, issue_number, pr_number, action_type, success
    FROM logs
    WHERE repository = ?
    ORDER BY id DESC
    LIMIT ?
  `);

  return stmt.all(repository, limit);
}

function getOrgStats() {
  const totalRepos = db.prepare(`SELECT COUNT(*) as count FROM repositories`).get().count;
  const enabledRepos = db.prepare(`SELECT COUNT(*) as count FROM repositories WHERE enabled = 1`).get().count;
  const totalIssuesProcessed = db.prepare(`SELECT COUNT(*) as count FROM logs WHERE event_name = 'issues'`).get().count;
  const totalPrsProcessed = db.prepare(`SELECT COUNT(*) as count FROM logs WHERE event_name = 'pull_request'`).get().count;
  const successRows = db.prepare(`SELECT COUNT(*) as total, SUM(success) as success_count FROM logs`).get();
  const successRate = successRows.total ? ((successRows.success_count / successRows.total) * 100).toFixed(2) : 0;

  return {
    total_repos: totalRepos,
    enabled_repos: enabledRepos,
    total_issues_processed: totalIssuesProcessed,
    total_prs_processed: totalPrsProcessed,
    success_rate: parseFloat(successRate)
  };
}

function getRepositoryStats(repository) {
  const logsStmt = db.prepare(`
    SELECT COUNT(*) as total, SUM(success) as success_count FROM logs WHERE repository = ?
  `);
  const result = logsStmt.get(repository);
  const total = result.total || 0;
  const success = result.success_count || 0;

  const prReviews = db.prepare(`
    SELECT COUNT(*) as count FROM pr_reviews WHERE repository = ?
  `).get(repository).count;

  return {
    repository,
    total_events: total,
    success_count: success,
    success_rate: total ? ((success / total) * 100).toFixed(2) : 0,
    pr_reviews: prReviews
  };
}

module.exports = {
  registerRepository,
  getRepository,
  getRepositoryConfig,
  getAllEnabledRepositories,
  saveLog,
  savePrReview,
  getRecentLogs,
  getLogsByRepository,
  getOrgStats,
  getRepositoryStats
};