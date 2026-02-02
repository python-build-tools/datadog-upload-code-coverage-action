import { execSync } from 'child_process';
import * as github from '@actions/github';

export interface GitInfo {
  repositoryUrl: string | undefined;
  commitSha: string | undefined;
  branch: string | undefined;
  tag: string | undefined;
  commitMessage: string | undefined;
  authorName: string | undefined;
  authorEmail: string | undefined;
  committerName: string | undefined;
  committerEmail: string | undefined;
}

function execGit(args: string): string | undefined {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch {
    return undefined;
  }
}

function filterSensitiveInfo(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Remove credentials from URL
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    // If not a valid URL, try to clean up SSH-style URLs
    return url.replace(/\/\/[^@]+@/, '//');
  }
}

export async function getGitInfo(): Promise<GitInfo> {
  const context = github.context;

  // Try environment variables first (GitHub Actions context)
  let repositoryUrl = process.env.DD_GIT_REPOSITORY_URL;
  let commitSha = process.env.DD_GIT_COMMIT_SHA;
  let branch = process.env.DD_GIT_BRANCH;
  let tag = process.env.DD_GIT_TAG;
  let commitMessage = process.env.DD_GIT_COMMIT_MESSAGE;
  let authorName = process.env.DD_GIT_COMMIT_AUTHOR_NAME;
  let authorEmail = process.env.DD_GIT_COMMIT_AUTHOR_EMAIL;
  let committerName = process.env.DD_GIT_COMMIT_COMMITTER_NAME;
  let committerEmail = process.env.DD_GIT_COMMIT_COMMITTER_EMAIL;

  // Fall back to GitHub context
  if (!repositoryUrl && context.payload.repository) {
    repositoryUrl = context.payload.repository.clone_url ||
                   `https://github.com/${context.repo.owner}/${context.repo.repo}.git`;
  }

  if (!commitSha) {
    commitSha = process.env.GITHUB_SHA || context.sha;
  }

  if (!branch) {
    branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || context.ref?.replace('refs/heads/', '');
  }

  // Fall back to git commands
  if (!repositoryUrl) {
    repositoryUrl = execGit('remote get-url origin');
  }

  if (!commitSha) {
    commitSha = execGit('rev-parse HEAD');
  }

  if (!branch) {
    branch = execGit('rev-parse --abbrev-ref HEAD');
  }

  if (!commitMessage) {
    commitMessage = execGit('log -1 --format=%s');
  }

  if (!authorName) {
    authorName = execGit('log -1 --format=%an');
  }

  if (!authorEmail) {
    authorEmail = execGit('log -1 --format=%ae');
  }

  if (!committerName) {
    committerName = execGit('log -1 --format=%cn');
  }

  if (!committerEmail) {
    committerEmail = execGit('log -1 --format=%ce');
  }

  return {
    repositoryUrl: filterSensitiveInfo(repositoryUrl),
    commitSha,
    branch,
    tag,
    commitMessage,
    authorName,
    authorEmail,
    committerName,
    committerEmail,
  };
}
