import { getGitHubContext } from '../github-context';
import { resetContext, setContext } from '../__mocks__/@actions/github';

// Mock @actions/github
jest.mock('@actions/github');

describe('github-context', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Reset the mock context to defaults
    resetContext();
    // Clear relevant env vars
    delete process.env.GITHUB_HEAD_REF;
    delete process.env.GITHUB_REF_NAME;
    delete process.env.GITHUB_WORKSPACE;
    delete process.env.GITHUB_BASE_REF;
    delete process.env.DD_GIT_REPOSITORY_URL;
    delete process.env.DD_GIT_COMMIT_SHA;
    delete process.env.DD_GIT_BRANCH;
    delete process.env.DD_GIT_TAG;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getGitHubContext', () => {
    it('should return default values when context is empty', () => {
      const result = getGitHubContext();

      expect(result.repositoryUrl).toBe('https://github.com//.git');
      expect(result.commitSha).toBe('');
      expect(result.branch).toBeUndefined();
      expect(result.tag).toBeUndefined();
      expect(result.pullRequestBaseBranch).toBeUndefined();
      expect(result.pullRequestHeadSha).toBeUndefined();
      expect(result.pullRequestBaseBranchHeadSha).toBeUndefined();
      expect(result.pullRequestNumber).toBeUndefined();
      expect(result.pipelineId).toBe('0');
      expect(result.pipelineName).toBe('/');
      expect(result.pipelineNumber).toBe('0');
      expect(result.jobName).toBe('');
    });

    it('should use GitHub context values', () => {
      setContext({
        serverUrl: 'https://github.com',
        repo: { owner: 'owner', repo: 'repo' },
        runId: 12345,
        runNumber: 42,
        job: 'test-job',
        sha: 'abc123def456',
      });
      process.env.GITHUB_HEAD_REF = 'feature-branch';
      process.env.GITHUB_WORKSPACE = '/home/runner/work/repo';

      const result = getGitHubContext();

      expect(result.repositoryUrl).toBe('https://github.com/owner/repo.git');
      expect(result.commitSha).toBe('abc123def456');
      expect(result.branch).toBe('feature-branch');
      expect(result.pipelineId).toBe('12345');
      expect(result.pipelineName).toBe('owner/repo');
      expect(result.pipelineNumber).toBe('42');
      expect(result.jobName).toBe('test-job');
      expect(result.pipelineUrl).toBe('https://github.com/owner/repo/actions/runs/12345');
      expect(result.jobUrl).toBe('https://github.com/owner/repo/actions/runs/12345/job/test-job');
      expect(result.workspacePath).toBe('/home/runner/work/repo');
    });

    it('should prefer DD_GIT_* env vars over GitHub context', () => {
      setContext({
        repo: { owner: 'owner', repo: 'repo' },
        sha: 'github-sha',
      });
      process.env.GITHUB_HEAD_REF = 'github-branch';

      process.env.DD_GIT_REPOSITORY_URL = 'https://example.com/custom/repo.git';
      process.env.DD_GIT_COMMIT_SHA = 'dd-custom-sha';
      process.env.DD_GIT_BRANCH = 'dd-custom-branch';
      process.env.DD_GIT_TAG = 'v1.0.0';

      const result = getGitHubContext();

      expect(result.repositoryUrl).toBe('https://example.com/custom/repo.git');
      expect(result.commitSha).toBe('dd-custom-sha');
      expect(result.branch).toBe('dd-custom-branch');
      expect(result.tag).toBe('v1.0.0');
    });

    it('should fallback to GITHUB_REF_NAME when GITHUB_HEAD_REF is not set', () => {
      process.env.GITHUB_REF_NAME = 'main';

      const result = getGitHubContext();

      expect(result.branch).toBe('main');
    });

    it('should filter sensitive info from repository URL with credentials', () => {
      process.env.DD_GIT_REPOSITORY_URL = 'https://user:password@github.com/owner/repo.git';

      const result = getGitHubContext();

      expect(result.repositoryUrl).not.toContain('user');
      expect(result.repositoryUrl).not.toContain('password');
      expect(result.repositoryUrl).toBe('https://github.com/owner/repo.git');
    });

    it('should filter sensitive info from malformed URLs', () => {
      process.env.DD_GIT_REPOSITORY_URL = 'git://user:pass@example.com/repo.git';

      const result = getGitHubContext();

      expect(result.repositoryUrl).not.toContain('user');
      expect(result.repositoryUrl).not.toContain('pass');
    });

    it('should handle SSH-style URLs gracefully', () => {
      process.env.DD_GIT_REPOSITORY_URL = 'git@github.com:owner/repo.git';

      const result = getGitHubContext();

      // SSH URLs don't have credentials to filter
      expect(result.repositoryUrl).toBe('git@github.com:owner/repo.git');
    });

    it('should use process.cwd() when GITHUB_WORKSPACE is not set', () => {
      const result = getGitHubContext();

      expect(result.workspacePath).toBe(process.cwd());
    });

    it('should handle GitHub Enterprise Server URLs', () => {
      setContext({
        serverUrl: 'https://github.mycompany.com',
        repo: { owner: 'org', repo: 'project' },
        runId: 999,
        job: 'build',
      });

      const result = getGitHubContext();

      expect(result.pipelineUrl).toBe('https://github.mycompany.com/org/project/actions/runs/999');
      expect(result.jobUrl).toBe('https://github.mycompany.com/org/project/actions/runs/999/job/build');
    });

    describe('pull request info', () => {
      it('should populate PR info when GITHUB_BASE_REF is set and payload has pull_request', () => {
        setContext({
          payload: {
            pull_request: {
              number: 42,
              head: { sha: 'df289512a51123083a8e6931dd6f57bb3883d4c4' },
              base: { sha: '52e0974c74d41160a03d59ddc73bb9f5adab054b' },
            },
          },
        });
        process.env.GITHUB_BASE_REF = 'main';

        const result = getGitHubContext();

        expect(result.pullRequestBaseBranch).toBe('main');
        expect(result.pullRequestHeadSha).toBe('df289512a51123083a8e6931dd6f57bb3883d4c4');
        expect(result.pullRequestBaseBranchHeadSha).toBe('52e0974c74d41160a03d59ddc73bb9f5adab054b');
        expect(result.pullRequestNumber).toBe('42');
      });

      it('should set only pullRequestBaseBranch when GITHUB_BASE_REF is set but no payload', () => {
        process.env.GITHUB_BASE_REF = 'develop';

        const result = getGitHubContext();

        expect(result.pullRequestBaseBranch).toBe('develop');
        expect(result.pullRequestHeadSha).toBeUndefined();
        expect(result.pullRequestBaseBranchHeadSha).toBeUndefined();
        expect(result.pullRequestNumber).toBeUndefined();
      });

      it('should handle partial pull_request payload gracefully', () => {
        setContext({
          payload: {
            pull_request: {
              number: 42,
              // head and base are missing
            },
          },
        });
        process.env.GITHUB_BASE_REF = 'main';

        const result = getGitHubContext();

        expect(result.pullRequestBaseBranch).toBe('main');
        expect(result.pullRequestHeadSha).toBeUndefined();
        expect(result.pullRequestBaseBranchHeadSha).toBeUndefined();
        expect(result.pullRequestNumber).toBe('42');
      });

      it('should not set PR info when GITHUB_BASE_REF is not set', () => {
        setContext({
          payload: {
            pull_request: {
              number: 42,
              head: { sha: 'head-sha' },
              base: { sha: 'base-sha' },
            },
          },
        });
        // GITHUB_BASE_REF is not set

        const result = getGitHubContext();

        expect(result.pullRequestBaseBranch).toBeUndefined();
        expect(result.pullRequestHeadSha).toBeUndefined();
        expect(result.pullRequestBaseBranchHeadSha).toBeUndefined();
        expect(result.pullRequestNumber).toBeUndefined();
      });

      it('should handle empty payload gracefully', () => {
        setContext({
          payload: {},
        });
        process.env.GITHUB_BASE_REF = 'main';

        const result = getGitHubContext();

        expect(result.pullRequestBaseBranch).toBe('main');
        expect(result.pullRequestHeadSha).toBeUndefined();
        expect(result.pullRequestBaseBranchHeadSha).toBeUndefined();
        expect(result.pullRequestNumber).toBeUndefined();
      });
    });
  });
});
