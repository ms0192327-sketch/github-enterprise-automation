const { summarizeIssue, generateComment, classifyIssue, reviewCode, securityScan } = require("./agent");
const { createIssueComment, getPrFiles, getPr } = require("./githubApp");
const { saveLog, savePrReview, getRepository, getRepositoryConfig } = require("./db");

async function shouldProcessRepository(fullName) {
  const repo = getRepository(fullName);
  if (!repo) return false;
  return repo.enabled === 1;
}

async function handleWebhookEvent(eventName, payload) {
  if (!payload || !payload.repository) {
    return;
  }

  const repoName = payload.repository.name;
  const owner = payload.repository.owner.login;
  const fullName = `${owner}/${repoName}`;
  const repoId = payload.repository.id;

  const shouldProcess = await shouldProcessRepository(fullName);
  if (!shouldProcess) {
    console.log(`Skipping disabled repo: ${fullName}`);
    return;
  }

  const config = getRepositoryConfig(fullName);

  if (eventName === "issues" && payload.action === "opened" && config?.auto_issue_comment) {
    await handleIssueOpened(payload, fullName, owner, repoName, config);
  }

  if (eventName === "pull_request" && payload.action === "opened" && config?.auto_pr_review) {
    await handlePrOpened(payload, fullName, owner, repoName, config);
  }
}

async function handleIssueOpened(payload, fullName, owner, repoName, config) {
  const issue = payload.issue;

  try {
    const summary = await summarizeIssue(issue.title, issue.body || "");
    const comment = await generateComment(issue.title, issue.body || "");
    const classification = await classifyIssue(issue.title, issue.body || "");

    console.log(`[${fullName}] Issue #${issue.number} summary:`, summary);

    if (config.auto_issue_comment !== false) {
      await createIssueComment(owner, repoName, issue.number, comment);
      console.log(`[${fullName}] Comment posted to issue #${issue.number}`);
    }

    saveLog(
      "issues",
      fullName,
      owner,
      issue.number,
      null,
      `Issue: ${issue.title}`,
      `Summary: ${summary}\n\nClassification: ${classification}`,
      "issue_comment",
      1
    );
  } catch (error) {
    console.error(`[${fullName}] Error handling issue:`, error.message);
    saveLog(
      "issues",
      fullName,
      owner,
      issue.number,
      null,
      `Issue: ${issue.title}`,
      `Error: ${error.message}`,
      "issue_comment",
      0
    );
  }
}

async function handlePrOpened(payload, fullName, owner, repoName, config) {
  const pr = payload.pull_request;

  try {
    console.log(`[${fullName}] New PR #${pr.number}: ${pr.title}`);

    const prDetails = await getPr(owner, repoName, pr.number);
    const files = await getPrFiles(owner, repoName, pr.number);

    let reviewComment = `## Automated Code Review\n\n`;
    let findings = [];

    // Review files
    for (const file of files.slice(0, 5)) {
      if (file.patch) {
        const review = await reviewCode(file.filename, file.patch);
        reviewComment += `### ${file.filename}\n${review}\n\n`;
        findings.push({ file: file.filename, review });
      }
    }

    // Security scan
    if (config.security_scan !== false) {
      const firstFile = files.find(f => f.patch);
      if (firstFile) {
        const securityIssues = await securityScan(firstFile.filename, firstFile.patch);
        reviewComment += `\n### Security Review\n${securityIssues}\n`;
      }
    }

    if (config.auto_pr_review !== false) {
      await createIssueComment(owner, repoName, pr.number, reviewComment);
      console.log(`[${fullName}] PR review posted to #${pr.number}`);
    }

    savePrReview(
      fullName,
      pr.number,
      pr.head.sha,
      files.length,
      { files_reviewed: files.length, security_checked: config.security_scan !== false },
      1
    );

    saveLog(
      "pull_request",
      fullName,
      owner,
      null,
      pr.number,
      `PR: ${pr.title}`,
      `Reviewed ${files.length} files`,
      "pr_review",
      1
    );
  } catch (error) {
    console.error(`[${fullName}] Error handling PR:`, error.message);
    saveLog(
      "pull_request",
      fullName,
      owner,
      null,
      pr.number,
      `PR: ${pr.title}`,
      `Error: ${error.message}`,
      "pr_review",
      0
    );
  }
}

module.exports = {
  handleWebhookEvent
};