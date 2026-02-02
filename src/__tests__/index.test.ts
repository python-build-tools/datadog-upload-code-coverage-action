import * as core from '@actions/core';

// Mock all dependencies before importing the module
jest.mock('@actions/core');
jest.mock('../uploader');
jest.mock('../file-finder');
jest.mock('../github-context');

import { uploadCoverageFiles } from '../uploader';
import { findCoverageFiles } from '../file-finder';
import { getGitHubContext } from '../github-context';

const mockCore = core as jest.Mocked<typeof core>;
const mockUploadCoverageFiles = uploadCoverageFiles as jest.MockedFunction<typeof uploadCoverageFiles>;
const mockFindCoverageFiles = findCoverageFiles as jest.MockedFunction<typeof findCoverageFiles>;
const mockGetGitHubContext = getGitHubContext as jest.MockedFunction<typeof getGitHubContext>;

describe('index (run)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    // Default mock implementations
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'api-key': 'test-api-key',
        site: 'datadoghq.com',
        files: '**/coverage.xml',
        service: '',
        env: '',
        flags: '',
        'dry-run': 'false',
      };
      return inputs[name] || '';
    });

    mockGetGitHubContext.mockReturnValue({
      repositoryUrl: 'https://github.com/owner/repo.git',
      commitSha: 'abc123',
      branch: 'main',
      tag: undefined,
      pipelineId: '12345',
      pipelineName: 'owner/repo',
      pipelineNumber: '1',
      pipelineUrl: 'https://github.com/owner/repo/actions/runs/12345',
      jobName: 'test',
      jobUrl: 'https://github.com/owner/repo/actions/runs/12345/job/test',
      workspacePath: '/workspace',
    });

    mockFindCoverageFiles.mockResolvedValue([
      { path: '/path/to/coverage.xml', format: 'cobertura' },
    ]);

    mockUploadCoverageFiles.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to import and run the module fresh
  async function runAction() {
    // Clear the module cache to get a fresh run
    jest.resetModules();

    // Re-mock all modules after reset
    jest.doMock('@actions/core', () => mockCore);
    jest.doMock('../uploader', () => ({ uploadCoverageFiles: mockUploadCoverageFiles }));
    jest.doMock('../file-finder', () => ({ findCoverageFiles: mockFindCoverageFiles }));
    jest.doMock('../github-context', () => ({ getGitHubContext: mockGetGitHubContext }));

    // Import and run
    await import('../index');

    // Wait for the async run() to complete
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  it('should upload coverage files successfully', async () => {
    await runAction();

    expect(mockFindCoverageFiles).toHaveBeenCalledWith('**/coverage.xml');
    expect(mockUploadCoverageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-api-key',
        site: 'datadoghq.com',
      })
    );
    expect(mockCore.setOutput).toHaveBeenCalledWith('uploaded-files', 1);
  });

  it('should use DD_API_KEY environment variable when input not provided', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'api-key') return '';
      if (name === 'files') return '**/coverage.xml';
      return '';
    });
    process.env.DD_API_KEY = 'env-api-key';

    await runAction();

    expect(mockUploadCoverageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'env-api-key',
      })
    );
  });

  it('should use DATADOG_API_KEY environment variable as fallback', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'api-key') return '';
      if (name === 'files') return '**/coverage.xml';
      return '';
    });
    process.env.DATADOG_API_KEY = 'datadog-env-api-key';

    await runAction();

    expect(mockUploadCoverageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'datadog-env-api-key',
      })
    );
  });

  it('should fail when API key is not provided', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'api-key') return '';
      if (name === 'files') return '**/coverage.xml';
      return '';
    });
    delete process.env.DD_API_KEY;
    delete process.env.DATADOG_API_KEY;

    await runAction();

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('API key is required')
    );
  });

  it('should warn and exit when no coverage files are found', async () => {
    mockFindCoverageFiles.mockResolvedValue([]);

    await runAction();

    expect(mockCore.warning).toHaveBeenCalledWith(
      'No coverage files found matching the pattern'
    );
    expect(mockCore.setOutput).toHaveBeenCalledWith('uploaded-files', 0);
    expect(mockUploadCoverageFiles).not.toHaveBeenCalled();
  });

  it('should fail when repository URL cannot be determined', async () => {
    mockGetGitHubContext.mockReturnValue({
      repositoryUrl: '',
      commitSha: 'abc123',
      branch: 'main',
      tag: undefined,
      pipelineId: '12345',
      pipelineName: '',
      pipelineNumber: '1',
      pipelineUrl: '',
      jobName: 'test',
      jobUrl: '',
      workspacePath: '/workspace',
    });

    await runAction();

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Could not determine git repository URL'
    );
  });

  it('should fail when commit SHA cannot be determined', async () => {
    mockGetGitHubContext.mockReturnValue({
      repositoryUrl: 'https://github.com/owner/repo.git',
      commitSha: '',
      branch: 'main',
      tag: undefined,
      pipelineId: '12345',
      pipelineName: 'owner/repo',
      pipelineNumber: '1',
      pipelineUrl: '',
      jobName: 'test',
      jobUrl: '',
      workspacePath: '/workspace',
    });

    await runAction();

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Could not determine git commit SHA'
    );
  });

  it('should run in dry-run mode without uploading', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'api-key': 'test-api-key',
        files: '**/coverage.xml',
        'dry-run': 'true',
      };
      return inputs[name] || '';
    });

    await runAction();

    expect(mockUploadCoverageFiles).not.toHaveBeenCalled();
    expect(mockCore.info).toHaveBeenCalledWith(
      expect.stringContaining('[DRY-RUN]')
    );
  });

  it('should parse flags correctly', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'api-key': 'test-api-key',
        files: '**/coverage.xml',
        flags: 'unit-tests, backend, integration',
      };
      return inputs[name] || '';
    });

    await runAction();

    expect(mockUploadCoverageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: ['unit-tests', 'backend', 'integration'],
      })
    );
  });

  it('should fail when more than 32 flags are provided', async () => {
    const manyFlags = Array.from({ length: 33 }, (_, i) => `flag${i}`).join(',');
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'api-key': 'test-api-key',
        files: '**/coverage.xml',
        flags: manyFlags,
      };
      return inputs[name] || '';
    });

    await runAction();

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Maximum of 32 flags')
    );
  });

  it('should use default site when not specified', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'api-key': 'test-api-key',
        files: '**/coverage.xml',
        site: '',
      };
      return inputs[name] || '';
    });

    await runAction();

    expect(mockUploadCoverageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        site: 'datadoghq.com',
      })
    );
  });

  it('should pass service and env to uploader', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'api-key': 'test-api-key',
        files: '**/coverage.xml',
        service: 'my-service',
        env: 'production',
      };
      return inputs[name] || '';
    });

    await runAction();

    expect(mockUploadCoverageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'my-service',
        env: 'production',
      })
    );
  });

  it('should handle upload errors', async () => {
    mockUploadCoverageFiles.mockRejectedValue(new Error('Upload failed'));

    await runAction();

    expect(mockCore.setFailed).toHaveBeenCalledWith('Upload failed');
  });

  it('should handle non-Error exceptions', async () => {
    mockUploadCoverageFiles.mockRejectedValue('string error');

    await runAction();

    expect(mockCore.setFailed).toHaveBeenCalledWith('An unexpected error occurred');
  });

  it('should set upload-time output', async () => {
    await runAction();

    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'upload-time',
      expect.any(String)
    );
  });
});
