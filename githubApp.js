const fs = require("fs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { getRepository } = require("./db");

let cachedTokens = {};

function generateJwt() {
  const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");

  return jwt.sign(
    {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
      iss: process.env.APP_ID
    },
    privateKey,
    { algorithm: "RS256" }
  );
}

async function getInstallations() {
  const jwtToken = generateJwt();

  const response = await axios.get("https://api.github.com/app/installations", {
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  return response.data;
}

async function getInstallationIdForOwner(ownerLogin) {
  const installations = await getInstallations();

  const installation = installations.find(
    item => item.account && item.account.login === ownerLogin
  );

  if (!installation) {
    throw new Error(`No installation for ${ownerLogin}`);
  }

  return installation.id;
}

async function getInstallationToken(owner) {
  if (cachedTokens[owner] && cachedTokens[owner].exp > Date.now()) {
    return cachedTokens[owner].token;
  }

  const installationId = await getInstallationIdForOwner(owner);
  const jwtToken = generateJwt();

  const response = await axios.post(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {},
    {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  const expiresAt = new Date(response.data.expires_at).getTime();
  cachedTokens[owner] = {
    token: response.data.token,
    exp: expiresAt - 60000
  };

  return response.data.token;
}

async function createIssueComment(owner, repo, issueNumber, body) {
  const token = await getInstallationToken(owner);

  const response = await axios.post(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { body },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  return response.data;
}

async function getPrFiles(owner, repo, prNumber) {
  const token = await getInstallationToken(owner);

  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  return response.data;
}

async function getPr(owner, repo, prNumber) {
  const token = await getInstallationToken(owner);

  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  return response.data;
}

module.exports = {
  getInstallationToken,
  createIssueComment,
  getPrFiles,
  getPr
};