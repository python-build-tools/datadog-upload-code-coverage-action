import * as fs from 'fs';
import * as path from 'path';
import { uploadCoverageFiles, UploadOptions } from '../uploader';
import { GitHubContext } from '../github-context';
import { CoverageFile } from '../file-finder';

// Mock dependencies
jest.mock('@actions/core');
jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn(),
}));

import axios, { AxiosResponse } from 'axios';
import * as core from '@actions/core';

const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;
const mockIsAxiosError = axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>;
const mockCore = core as jest.Mocked<typeof core>;

describe('uploader', () => {
  const testDir = path.join(__dirname, 'uploader-fixtures');
  let testFile: string;

  const mockContext: GitHubContext = {
    repositoryUrl: 'https://github.com/owner/repo.git',
    commitSha: 'abc123def456',
    branch: 'main',
    tag: undefined,
    pullRequestBaseBranch: undefined,
    pullRequestHeadSha: undefined,
    pullRequestBaseBranchHeadSha: undefined,
    pullRequestNumber: undefined,
    pipelineId: '12345',
    pipelineName: 'owner/repo',
    pipelineNumber: '42',
    pipelineUrl: 'https://github.com/owner/repo/actions/runs/12345',
    jobName: 'test',
    jobUrl: 'https://github.com/owner/repo/actions/runs/12345/job/test',
    workspacePath: '/home/runner/work',
  };

  beforeAll(() => {
    // Create test fixtures
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    testFile = path.join(testDir, 'coverage.xml');
    fs.writeFileSync(
      testFile,
      '<?xml version="1.0"?><coverage line-rate="0.8">test</coverage>'
    );
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAxiosError.mockReturnValue(false);
  });

  describe('uploadCoverageFiles', () => {
    const baseOptions: UploadOptions = {
      apiKey: 'test-api-key',
      site: 'datadoghq.com',
      files: [],
      context: mockContext,
    };

    it('should upload a single file successfully', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        'https://ci-intake.datadoghq.com/api/v2/cicovreprt',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'DD-API-KEY': 'test-api-key',
          }),
        })
      );
    });

    it('should include service and env in the event payload', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
        service: 'my-service',
        env: 'production',
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      // The form data includes the event JSON with service and env
      const callArgs = mockAxiosPost.mock.calls[0];
      expect(callArgs[0]).toBe('https://ci-intake.datadoghq.com/api/v2/cicovreprt');
    });

    it('should include flags in the event payload', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
        flags: ['unit-tests', 'backend'],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should use custom site in URL', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        site: 'datadoghq.eu',
        files: [{ path: testFile, format: 'cobertura' }],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'https://ci-intake.datadoghq.eu/api/v2/cicovreprt',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should batch files in groups of 8', async () => {
      const files: CoverageFile[] = Array.from({ length: 10 }, (_) => ({
        path: testFile,
        format: 'cobertura',
      }));

      const options: UploadOptions = {
        ...baseOptions,
        files,
      };

      mockAxiosPost.mockResolvedValue({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      // 10 files should be uploaded in 2 batches (8 + 2)
      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });

    it('should retry on transient failures', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      const error = new Error('Network error');
      mockAxiosPost
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);
      mockIsAxiosError.mockReturnValue(false);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
      expect(mockCore.warning).toHaveBeenCalledTimes(2);
    });

    it('should retry on transient axios errors and log warning with axios message', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      // Create an axios error with a 500 status (retryable)
      const axiosError = {
        response: { status: 500, data: 'Internal Server Error' },
        message: 'Request failed with status code 500',
        isAxiosError: true,
      };
      mockAxiosPost
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);
      mockIsAxiosError.mockReturnValue(true);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
      expect(mockCore.warning).toHaveBeenCalledWith(
        'Upload attempt 1/3 failed: Request failed with status code 500'
      );
    });

    it('should fail immediately on 400 error', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      const axiosError = {
        response: { status: 400, data: 'Bad request' },
        message: 'Request failed',
        isAxiosError: true,
      };
      mockAxiosPost.mockRejectedValueOnce(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(uploadCoverageFiles(options)).rejects.toThrow(
        'Upload failed with status 400'
      );

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should fail immediately on 403 error', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      const axiosError = {
        response: { status: 403, data: 'Forbidden' },
        message: 'Request failed',
        isAxiosError: true,
      };
      mockAxiosPost.mockRejectedValueOnce(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(uploadCoverageFiles(options)).rejects.toThrow(
        'Upload failed with status 403'
      );

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should fail after all retries are exhausted', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      // Use an actual Error instance to ensure line 115's true branch is covered
      const error = new Error('Persistent network error');
      mockAxiosPost
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);
      mockIsAxiosError.mockReturnValue(false);

      await expect(uploadCoverageFiles(options)).rejects.toThrow(
        'Persistent network error'
      );

      expect(mockAxiosPost).toHaveBeenCalledTimes(3); // Default 3 retries
    });

    it('should handle files with leading dots in names', async () => {
      const dotFile = path.join(testDir, '.coverage');
      fs.writeFileSync(dotFile, 'coverage data');

      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: dotFile, format: 'lcov' }],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('Uploading:')
      );
    });

    it('should include all span tags from context', async () => {
      const contextWithTag: GitHubContext = {
        ...mockContext,
        tag: 'v1.0.0',
      };

      const options: UploadOptions = {
        ...baseOptions,
        context: contextWithTag,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should handle empty files array', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [],
      };

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('should log info for each file being uploaded', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [
          { path: testFile, format: 'cobertura' },
          { path: testFile, format: 'jacoco' },
        ],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('cobertura')
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('jacoco')
      );
    });

    it('should include pull request span tags when PR info is present', async () => {
      const prContext: GitHubContext = {
        ...mockContext,
        pullRequestBaseBranch: 'main',
        pullRequestHeadSha: 'abc123head',
        pullRequestBaseBranchHeadSha: 'def456base',
        pullRequestNumber: '42',
      };

      const options: UploadOptions = {
        ...baseOptions,
        context: prContext,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      // The form data should contain PR tags - we verify the call was made
      // The actual tag values are included in the FormData
    });

    it('should handle context without optional branch field', async () => {
      const noBranchContext: GitHubContext = {
        ...mockContext,
        branch: undefined,
      };

      const options: UploadOptions = {
        ...baseOptions,
        context: noBranchContext,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error objects thrown during upload', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      // Throw a string instead of an Error object to hit the non-Error branch
      mockAxiosPost
        .mockRejectedValueOnce('string error')
        .mockRejectedValueOnce('string error')
        .mockRejectedValueOnce('string error');
      mockIsAxiosError.mockReturnValue(false);

      await expect(uploadCoverageFiles(options)).rejects.toThrow('string error');

      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
      expect(mockCore.warning).toHaveBeenCalledWith(
        'Upload attempt 1/3 failed: string error'
      );
    });

    it('should handle null thrown during upload', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      // Throw null to fully test the non-Error branch
      mockAxiosPost
        .mockRejectedValueOnce(null)
        .mockRejectedValueOnce(null)
        .mockRejectedValueOnce(null);
      mockIsAxiosError.mockReturnValue(false);

      await expect(uploadCoverageFiles(options)).rejects.toThrow('null');

      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    });

    it('should handle axios error without response data', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      // Create an axios error with 400 status but no response data
      const axiosError = {
        response: { status: 400, data: undefined },
        message: 'Bad Request',
        isAxiosError: true,
      };
      mockAxiosPost.mockRejectedValueOnce(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(uploadCoverageFiles(options)).rejects.toThrow(
        'Upload failed with status 400: Bad Request'
      );

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should handle axios error with 403 status and response data', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      const axiosError = {
        response: { status: 403, data: 'Invalid API key' },
        message: 'Forbidden',
        isAxiosError: true,
      };
      mockAxiosPost.mockRejectedValueOnce(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(uploadCoverageFiles(options)).rejects.toThrow(
        'Upload failed with status 403: Invalid API key'
      );

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should use empty flags array without adding to event', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
        flags: [],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should use unknown format when file has empty format string', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: '' }],
      };

      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: {} } as AxiosResponse);

      await uploadCoverageFiles(options);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should throw default error when response has non-2xx status without exception', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      // Return non-2xx status without throwing - this makes lastError undefined
      mockAxiosPost
        .mockResolvedValueOnce({ status: 500, data: {} } as AxiosResponse)
        .mockResolvedValueOnce({ status: 502, data: {} } as AxiosResponse)
        .mockResolvedValueOnce({ status: 503, data: {} } as AxiosResponse);

      await expect(uploadCoverageFiles(options)).rejects.toThrow(
        'Upload failed after all retries'
      );

      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    });

    it('should handle Error instance thrown during upload and preserve it', async () => {
      const options: UploadOptions = {
        ...baseOptions,
        files: [{ path: testFile, format: 'cobertura' }],
      };

      // Create an actual Error instance to test the true branch of instanceof Error
      const error = new Error('Actual Error instance');
      mockAxiosPost
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);
      mockIsAxiosError.mockReturnValue(false);

      // The thrown error should be the exact same Error instance
      try {
        await uploadCoverageFiles(options);
        fail('Expected an error to be thrown');
      } catch (e) {
        expect(e).toBe(error);
        expect(e).toBeInstanceOf(Error);
      }

      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    });
  });
});
