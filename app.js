const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { handleWebhookEvent } = require("./webhooks");
const { getRecentLogs, getOrgStats, getRepositoryStats, getAllEnabledRepositories, getLogsByRepository } = require("./db");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.get("/", (req, res) => {
  res.json({
    message: "GitHub Enterprise Multi-Repo Automation running",
    version: "3.0.0",
    org: process.env.ORG_NAME || "unknown",
    routes: [
      "POST /webhook",
      "GET /org/stats",
      "GET /org/repos",
      "GET /logs",
      "GET /repo/:owner/:name/stats",
      "GET /repo/:owner/:name/logs"
    ]
  });
});

app.post("/webhook", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];
  const payload = req.rawBody;

  if (!signature || !payload) {
    return res.status(401).json({ error: "Missing signature" });
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex")}`;

  try {
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const eventName = req.headers["x-github-event"];
  const body = req.body;

  try {
    await handleWebhookEvent(eventName, body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Processing failed" });
  }
});

app.get("/org/stats", (req, res) => {
  const stats = getOrgStats();
  res.json(stats);
});

app.get("/org/repos", (req, res) => {
  const repos = getAllEnabledRepositories();
  res.json({
    count: repos.length,
    repositories: repos.map(r => ({
      full_name: r.full_name,
      owner: r.owner,
      name: r.name,
      auto_issue_comment: r.auto_issue_comment === 1,
      auto_pr_review: r.auto_pr_review === 1,
      auto_label: r.auto_label === 1,
      security_scan: r.security_scan === 1
    }))
  });
});

app.get("/logs", (req, res) => {
  const limit = Number(req.query.limit || 20);
  const logs = getRecentLogs(limit);
  res.json({
    count: logs.length,
    logs
  });
});

app.get("/repo/:owner/:name/stats", (req, res) => {
  const { owner, name } = req.params;
  const fullName = `${owner}/${name}`;
  const stats = getRepositoryStats(fullName);
  res.json(stats);
});

app.get("/repo/:owner/:name/logs", (req, res) => {
  const { owner, name } = req.params;
  const fullName = `${owner}/${name}`;
  const limit = Number(req.query.limit || 10);
  const logs = getLogsByRepository(fullName, limit);
  res.json({
    repository: fullName,
    count: logs.length,
    logs
  });
});

app.listen(PORT, () => {
  console.log(`GitHub Enterprise App running on http://localhost:${PORT}`);
  console.log(`Org: ${process.env.ORG_NAME || 'not configured'}`);
});

module.exports = app;