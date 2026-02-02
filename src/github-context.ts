import { execSync } from 'child_process';

export interface GitHubContext {
  // Git info
  repositoryUrl: string;
  commitSha: string;
  branch: string | undefined;
  tag: string | undefined;
  commitMessage: string | undefined;
  authorName: string | undefined;
  authorEmail: string | undefined;
  committerName: string | undefined;
  committerEmail: string | undefined;
  // CI info
  pipelineId: string;
  pipelineName: string;
  pipelineNumber: string;
  pipelineUrl: string;
  jobName: string;
  jobUrl: string;
  workspacePath: string;
}

function execGit(args: string): string | undefined {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
}

function filterSensitiveInfo(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.replace(/\/\/[^@]+@/, '//');
  }
}

export function getGitHubContext(): GitHubContext {
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = process.env.GITHUB_REPOSITORY || '';
  const runId = process.env.GITHUB_RUN_ID || '';
  const runNumber = process.env.GITHUB_RUN_NUMBER || '';
  const job = process.env.GITHUB_JOB || '';

  // Git info - prefer DD_GIT_* env vars, then GitHub env vars, then git commands
  let repositoryUrl =
    process.env.DD_GIT_REPOSITORY_URL ||
    `https://github.com/${repository}.git`;

  const commitSha =
    process.env.DD_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    execGit('rev-parse HEAD') ||
    '';

  const branch =
    process.env.DD_GIT_BRANCH ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    execGit('rev-parse --abbrev-ref HEAD');

  const tag = process.env.DD_GIT_TAG;

  const commitMessage =
    process.env.DD_GIT_COMMIT_MESSAGE || execGit('log -1 --format=%s');

  const authorName =
    process.env.DD_GIT_COMMIT_AUTHOR_NAME || execGit('log -1 --format=%an');

  const authorEmail =
    process.env.DD_GIT_COMMIT_AUTHOR_EMAIL || execGit('log -1 --format=%ae');

  const committerName =
    process.env.DD_GIT_COMMIT_COMMITTER_NAME || execGit('log -1 --format=%cn');

  const committerEmail =
    process.env.DD_GIT_COMMIT_COMMITTER_EMAIL || execGit('log -1 --format=%ce');

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
    pipelineId: runId,
    pipelineName: repository,
    pipelineNumber: runNumber,
    pipelineUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    jobName: job,
    jobUrl: `${serverUrl}/${repository}/actions/runs/${runId}/job/${job}`,
    workspacePath: process.env.GITHUB_WORKSPACE || process.cwd(),
  };
}
