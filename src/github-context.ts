export interface GitHubContext {
  // Git info (required)
  repositoryUrl: string;
  commitSha: string;
  // Git info (optional)
  branch: string | undefined;
  tag: string | undefined;
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
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = process.env.GITHUB_REPOSITORY || '';
  const runId = process.env.GITHUB_RUN_ID || '';
  const runNumber = process.env.GITHUB_RUN_NUMBER || '';
  const job = process.env.GITHUB_JOB || '';

  // Git info - prefer DD_GIT_* env vars, then GitHub env vars
  // Only repositoryUrl and commitSha are required for coverage uploads
  const repositoryUrl =
    process.env.DD_GIT_REPOSITORY_URL ||
    `${serverUrl}/${repository}.git`;

  const commitSha =
    process.env.DD_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    '';

  const branch =
    process.env.DD_GIT_BRANCH ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME;

  const tag = process.env.DD_GIT_TAG;

  return {
    repositoryUrl: filterSensitiveInfo(repositoryUrl),
    commitSha,
    branch,
    tag,
    pipelineId: runId,
    pipelineName: repository,
    pipelineNumber: runNumber,
    pipelineUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    jobName: job,
    jobUrl: `${serverUrl}/${repository}/actions/runs/${runId}/job/${job}`,
    workspacePath: process.env.GITHUB_WORKSPACE || process.cwd(),
  };
}
