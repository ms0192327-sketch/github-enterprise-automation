const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ISSUE_SYSTEM_PROMPT = `
You are an AI assistant for enterprise GitHub automation.

Your job:
- summarize GitHub issue texts
- create helpful issue comments
- classify issue urgency and type
- recommend labels and priorities

Keep responses concise and actionable.
`;

const PR_REVIEW_SYSTEM_PROMPT = `
You are an expert code reviewer for enterprise GitHub automation.

Your job:
- review code changes
- identify bugs, security issues, performance problems
- suggest improvements
- classify by severity: critical, warning, info, suggestion

Format response as JSON:
{
  "findings": [{"severity": "critical|warning|info|suggestion", "comment": "text"}],
  "summary": "overall assessment"
}
`;

const SECURITY_PROMPT = `
You are a security expert reviewing code for vulnerabilities.

Check for:
- SQL injection
- XSS vulnerabilities
- hardcoded secrets
- insecure APIs
- authentication/authorization issues
- dependency vulnerabilities

Format as JSON with findings array.
`;

async function summarizeIssue(title, body) {
  const response = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      { role: "system", content: ISSUE_SYSTEM_PROMPT },
      { role: "user", content: `Summarize: ${title}\n${body || ""}` }
    ],
    temperature: 0.3
  });

  return response.choices[0].message.content;
}

async function generateComment(title, body) {
  const response = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      { role: "system", content: ISSUE_SYSTEM_PROMPT },
      { role: "user", content: `Draft comment for: ${title}\n${body || ""}` }
    ],
    temperature: 0.5
  });

  return response.choices[0].message.content;
}

async function reviewCode(filePath, diff) {
  const response = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      { role: "system", content: PR_REVIEW_SYSTEM_PROMPT },
      { role: "user", content: `Review: ${filePath}\n${diff}` }
    ],
    temperature: 0.2
  });

  return response.choices[0].message.content;
}

async function securityScan(filePath, code) {
  const response = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      { role: "system", content: SECURITY_PROMPT },
      { role: "user", content: `Scan: ${filePath}\n${code}` }
    ],
    temperature: 0.2
  });

  return response.choices[0].message.content;
}

async function classifyIssue(title, body) {
  const response = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      { role: "system", content: ISSUE_SYSTEM_PROMPT },
      { role: "user", content: `Classify as JSON: {"type": "bug|feature|enhancement|documentation", "priority": "critical|high|medium|low", "suggested_labels": []}\n\n${title}\n${body || ""}` }
    ],
    temperature: 0.2
  });

  return response.choices[0].message.content;
}

module.exports = {
  summarizeIssue,
  generateComment,
  reviewCode,
  securityScan,
  classifyIssue
};