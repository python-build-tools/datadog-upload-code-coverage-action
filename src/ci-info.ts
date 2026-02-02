import * as github from '@actions/github';

export interface CIInfo {
  provider: string | undefined;
  pipelineId: string | undefined;
  pipelineName: string | undefined;
  pipelineNumber: string | undefined;
  pipelineUrl: string | undefined;
  jobName: string | undefined;
  jobUrl: string | undefined;
  workspacePath: string | undefined;
}

export function getCIInfo(): CIInfo {
  const context = github.context;

  // GitHub Actions environment
  if (process.env.GITHUB_ACTIONS === 'true') {
    const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
    const repository = process.env.GITHUB_REPOSITORY || '';
    const runId = process.env.GITHUB_RUN_ID || '';
    const runNumber = process.env.GITHUB_RUN_NUMBER || '';
    const runAttempt = process.env.GITHUB_RUN_ATTEMPT || '1';
    const job = process.env.GITHUB_JOB || '';

    return {
      provider: 'github',
      pipelineId: runId,
      pipelineName: repository,
      pipelineNumber: runNumber,
      pipelineUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
      jobName: job,
      jobUrl: `${serverUrl}/${repository}/actions/runs/${runId}/job/${job}`,
      workspacePath: process.env.GITHUB_WORKSPACE,
    };
  }

  // GitLab CI
  if (process.env.GITLAB_CI) {
    return {
      provider: 'gitlab',
      pipelineId: process.env.CI_PIPELINE_ID,
      pipelineName: process.env.CI_PROJECT_PATH,
      pipelineNumber: process.env.CI_PIPELINE_IID,
      pipelineUrl: process.env.CI_PIPELINE_URL,
      jobName: process.env.CI_JOB_NAME,
      jobUrl: process.env.CI_JOB_URL,
      workspacePath: process.env.CI_PROJECT_DIR,
    };
  }

  // CircleCI
  if (process.env.CIRCLECI) {
    return {
      provider: 'circleci',
      pipelineId: process.env.CIRCLE_WORKFLOW_ID,
      pipelineName: process.env.CIRCLE_PROJECT_REPONAME,
      pipelineNumber: process.env.CIRCLE_BUILD_NUM,
      pipelineUrl: process.env.CIRCLE_BUILD_URL,
      jobName: process.env.CIRCLE_JOB,
      jobUrl: process.env.CIRCLE_BUILD_URL,
      workspacePath: process.env.CIRCLE_WORKING_DIRECTORY,
    };
  }

  // Jenkins
  if (process.env.JENKINS_URL) {
    return {
      provider: 'jenkins',
      pipelineId: process.env.BUILD_TAG,
      pipelineName: process.env.JOB_NAME,
      pipelineNumber: process.env.BUILD_NUMBER,
      pipelineUrl: process.env.BUILD_URL,
      jobName: process.env.JOB_NAME,
      jobUrl: process.env.BUILD_URL,
      workspacePath: process.env.WORKSPACE,
    };
  }

  // Azure DevOps
  if (process.env.TF_BUILD) {
    return {
      provider: 'azure',
      pipelineId: process.env.BUILD_BUILDID,
      pipelineName: process.env.BUILD_DEFINITIONNAME,
      pipelineNumber: process.env.BUILD_BUILDNUMBER,
      pipelineUrl: `${process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}`,
      jobName: process.env.SYSTEM_JOBDISPLAYNAME,
      jobUrl: `${process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}`,
      workspacePath: process.env.BUILD_SOURCESDIRECTORY,
    };
  }

  // Bitbucket Pipelines
  if (process.env.BITBUCKET_COMMIT) {
    const pipelineUuid = process.env.BITBUCKET_PIPELINE_UUID?.replace(/{|}/g, '');
    const url = `https://bitbucket.org/${process.env.BITBUCKET_REPO_FULL_NAME}/addon/pipelines/home#!/results/${process.env.BITBUCKET_BUILD_NUMBER}`;

    return {
      provider: 'bitbucket',
      pipelineId: pipelineUuid,
      pipelineName: process.env.BITBUCKET_REPO_FULL_NAME,
      pipelineNumber: process.env.BITBUCKET_BUILD_NUMBER,
      pipelineUrl: url,
      jobName: undefined,
      jobUrl: url,
      workspacePath: process.env.BITBUCKET_CLONE_DIR,
    };
  }

  // Travis CI
  if (process.env.TRAVIS) {
    return {
      provider: 'travis',
      pipelineId: process.env.TRAVIS_BUILD_ID,
      pipelineName: process.env.TRAVIS_REPO_SLUG,
      pipelineNumber: process.env.TRAVIS_BUILD_NUMBER,
      pipelineUrl: process.env.TRAVIS_BUILD_WEB_URL,
      jobName: undefined,
      jobUrl: process.env.TRAVIS_JOB_WEB_URL,
      workspacePath: process.env.TRAVIS_BUILD_DIR,
    };
  }

  // Buildkite
  if (process.env.BUILDKITE) {
    return {
      provider: 'buildkite',
      pipelineId: process.env.BUILDKITE_BUILD_ID,
      pipelineName: process.env.BUILDKITE_PIPELINE_SLUG,
      pipelineNumber: process.env.BUILDKITE_BUILD_NUMBER,
      pipelineUrl: process.env.BUILDKITE_BUILD_URL,
      jobName: process.env.BUILDKITE_STEP_KEY,
      jobUrl: `${process.env.BUILDKITE_BUILD_URL}#${process.env.BUILDKITE_JOB_ID}`,
      workspacePath: process.env.BUILDKITE_BUILD_CHECKOUT_PATH,
    };
  }

  // Unknown CI provider - return empty
  return {
    provider: undefined,
    pipelineId: undefined,
    pipelineName: undefined,
    pipelineNumber: undefined,
    pipelineUrl: undefined,
    jobName: undefined,
    jobUrl: undefined,
    workspacePath: process.env.PWD,
  };
}
