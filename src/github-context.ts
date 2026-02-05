import * as github from '@actions/github';

export interface GitHubContext {
  // Git info (required)
  repositoryUrl: string;
  commitSha: string;
  // Git info (optional)
  branch: string | undefined;
  tag: string | undefined;
  // Pull request info (set when GITHUB_BASE_REF is defined)
  pullRequestBaseBranch: string | undefined;
  pullRequestHeadSha: string | undefined;
  pullRequestBaseBranchHeadSha: string | undefined;
  pullRequestNumber: string | undefined;
  // CI info
  pipelineId: string;
  pipelineName: string;
  pipelineNumber: string;
  pipelineUrl: string;
  jobName: string;
  jobUrl: string;
  workspacePath: string;
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
  const ctx = github.context;
  const serverUrl = ctx.serverUrl || 'https://github.com';
  const repository = `${ctx.repo.owner}/${ctx.repo.repo}`;
  const runId = ctx.runId.toString();
  const runNumber = ctx.runNumber.toString();
  const job = ctx.job;

  // Git info - prefer DD_GIT_* env vars, then GitHub context
  // Only repositoryUrl and commitSha are required for coverage uploads
  const repositoryUrl =
    process.env.DD_GIT_REPOSITORY_URL ||
    `${serverUrl}/${repository}.git`;

  const commitSha =
    process.env.DD_GIT_COMMIT_SHA ||
    ctx.sha ||
    '';

  const branch =
    process.env.DD_GIT_BRANCH ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME;

  const tag = process.env.DD_GIT_TAG;

  // Pull request info - GITHUB_BASE_REF is defined for pull_request and pull_request_target triggers
  let pullRequestBaseBranch: string | undefined;
  let pullRequestHeadSha: string | undefined;
  let pullRequestBaseBranchHeadSha: string | undefined;
  let pullRequestNumber: string | undefined;

  const githubBaseRef = process.env.GITHUB_BASE_REF;
  if (githubBaseRef) {
    pullRequestBaseBranch = githubBaseRef;
    // Use @actions/github context.payload for PR info
    const pullRequest = ctx.payload.pull_request;
    if (pullRequest) {
      pullRequestHeadSha = pullRequest.head?.sha;
      pullRequestBaseBranchHeadSha = pullRequest.base?.sha;
      pullRequestNumber = pullRequest.number?.toString();
    }
  }

  return {
    repositoryUrl: filterSensitiveInfo(repositoryUrl),
    commitSha,
    branch,
    tag,
    pullRequestBaseBranch,
    pullRequestHeadSha,
    pullRequestBaseBranchHeadSha,
    pullRequestNumber,
    pipelineId: runId,
    pipelineName: repository,
    pipelineNumber: runNumber,
    pipelineUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    jobName: job,
    jobUrl: `${serverUrl}/${repository}/actions/runs/${runId}/job/${job}`,
    workspacePath: process.env.GITHUB_WORKSPACE || process.cwd(),
  };
}
