import { getGitHubContext, GitHubContext } from '../github-context';

describe('github-context', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all relevant env vars
    delete process.env.GITHUB_SERVER_URL;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_RUN_ID;
    delete process.env.GITHUB_RUN_NUMBER;
    delete process.env.GITHUB_JOB;
    delete process.env.GITHUB_SHA;
    delete process.env.GITHUB_HEAD_REF;
    delete process.env.GITHUB_REF_NAME;
    delete process.env.GITHUB_WORKSPACE;
    delete process.env.DD_GIT_REPOSITORY_URL;
    delete process.env.DD_GIT_COMMIT_SHA;
    delete process.env.DD_GIT_BRANCH;
    delete process.env.DD_GIT_TAG;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getGitHubContext', () => {
    it('should return default values when no env vars are set', () => {
      const context = getGitHubContext();

      expect(context.repositoryUrl).toBe('https://github.com/.git');
      expect(context.commitSha).toBe('');
      expect(context.branch).toBeUndefined();
      expect(context.tag).toBeUndefined();
      expect(context.pipelineId).toBe('');
      expect(context.pipelineName).toBe('');
      expect(context.pipelineNumber).toBe('');
      expect(context.jobName).toBe('');
    });

    it('should use GitHub environment variables', () => {
      process.env.GITHUB_SERVER_URL = 'https://github.com';
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      process.env.GITHUB_RUN_ID = '12345';
      process.env.GITHUB_RUN_NUMBER = '42';
      process.env.GITHUB_JOB = 'test-job';
      process.env.GITHUB_SHA = 'abc123def456';
      process.env.GITHUB_HEAD_REF = 'feature-branch';
      process.env.GITHUB_WORKSPACE = '/home/runner/work/repo';

      const context = getGitHubContext();

      expect(context.repositoryUrl).toBe('https://github.com/owner/repo.git');
      expect(context.commitSha).toBe('abc123def456');
      expect(context.branch).toBe('feature-branch');
      expect(context.pipelineId).toBe('12345');
      expect(context.pipelineName).toBe('owner/repo');
      expect(context.pipelineNumber).toBe('42');
      expect(context.jobName).toBe('test-job');
      expect(context.pipelineUrl).toBe('https://github.com/owner/repo/actions/runs/12345');
      expect(context.jobUrl).toBe('https://github.com/owner/repo/actions/runs/12345/job/test-job');
      expect(context.workspacePath).toBe('/home/runner/work/repo');
    });

    it('should prefer DD_GIT_* env vars over GitHub env vars', () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      process.env.GITHUB_SHA = 'github-sha';
      process.env.GITHUB_HEAD_REF = 'github-branch';

      process.env.DD_GIT_REPOSITORY_URL = 'https://example.com/custom/repo.git';
      process.env.DD_GIT_COMMIT_SHA = 'dd-custom-sha';
      process.env.DD_GIT_BRANCH = 'dd-custom-branch';
      process.env.DD_GIT_TAG = 'v1.0.0';

      const context = getGitHubContext();

      expect(context.repositoryUrl).toBe('https://example.com/custom/repo.git');
      expect(context.commitSha).toBe('dd-custom-sha');
      expect(context.branch).toBe('dd-custom-branch');
      expect(context.tag).toBe('v1.0.0');
    });

    it('should fallback to GITHUB_REF_NAME when GITHUB_HEAD_REF is not set', () => {
      process.env.GITHUB_REF_NAME = 'main';

      const context = getGitHubContext();

      expect(context.branch).toBe('main');
    });

    it('should filter sensitive info from repository URL with credentials', () => {
      process.env.DD_GIT_REPOSITORY_URL = 'https://user:password@github.com/owner/repo.git';

      const context = getGitHubContext();

      expect(context.repositoryUrl).not.toContain('user');
      expect(context.repositoryUrl).not.toContain('password');
      expect(context.repositoryUrl).toBe('https://github.com/owner/repo.git');
    });

    it('should filter sensitive info from malformed URLs', () => {
      process.env.DD_GIT_REPOSITORY_URL = 'git://user:pass@example.com/repo.git';

      const context = getGitHubContext();

      expect(context.repositoryUrl).not.toContain('user');
      expect(context.repositoryUrl).not.toContain('pass');
    });

    it('should handle SSH-style URLs gracefully', () => {
      process.env.DD_GIT_REPOSITORY_URL = 'git@github.com:owner/repo.git';

      const context = getGitHubContext();

      // SSH URLs don't have credentials to filter
      expect(context.repositoryUrl).toBe('git@github.com:owner/repo.git');
    });

    it('should use process.cwd() when GITHUB_WORKSPACE is not set', () => {
      const context = getGitHubContext();

      expect(context.workspacePath).toBe(process.cwd());
    });

    it('should handle GitHub Enterprise Server URLs', () => {
      process.env.GITHUB_SERVER_URL = 'https://github.mycompany.com';
      process.env.GITHUB_REPOSITORY = 'org/project';
      process.env.GITHUB_RUN_ID = '999';
      process.env.GITHUB_JOB = 'build';

      const context = getGitHubContext();

      expect(context.pipelineUrl).toBe('https://github.mycompany.com/org/project/actions/runs/999');
      expect(context.jobUrl).toBe('https://github.mycompany.com/org/project/actions/runs/999/job/build');
    });
  });
});
