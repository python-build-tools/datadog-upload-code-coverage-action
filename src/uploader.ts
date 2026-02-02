import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as os from 'os';
import * as core from '@actions/core';
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { CoverageFile } from './file-finder';
import { GitInfo } from './git-info';
import { CIInfo } from './ci-info';

export interface UploadOptions {
  apiKey: string;
  site: string;
  files: CoverageFile[];
  gitInfo: GitInfo;
  ciInfo: CIInfo;
  service?: string;
  env?: string;
  flags?: string[];
}

interface SpanTags {
  [key: string]: string | undefined;
}

function buildSpanTags(gitInfo: GitInfo, ciInfo: CIInfo): SpanTags {
  const tags: SpanTags = {};

  // Git tags
  if (gitInfo.repositoryUrl) tags['git.repository_url'] = gitInfo.repositoryUrl;
  if (gitInfo.commitSha) tags['git.commit.sha'] = gitInfo.commitSha;
  if (gitInfo.branch) tags['git.branch'] = gitInfo.branch;
  if (gitInfo.tag) tags['git.tag'] = gitInfo.tag;
  if (gitInfo.commitMessage) tags['git.commit.message'] = gitInfo.commitMessage?.slice(0, 500); // Limit message size
  if (gitInfo.authorName) tags['git.commit.author.name'] = gitInfo.authorName;
  if (gitInfo.authorEmail) tags['git.commit.author.email'] = gitInfo.authorEmail;
  if (gitInfo.committerName) tags['git.commit.committer.name'] = gitInfo.committerName;
  if (gitInfo.committerEmail) tags['git.commit.committer.email'] = gitInfo.committerEmail;

  // CI tags
  if (ciInfo.provider) tags['ci.provider.name'] = ciInfo.provider;
  if (ciInfo.pipelineId) tags['ci.pipeline.id'] = ciInfo.pipelineId;
  if (ciInfo.pipelineName) tags['ci.pipeline.name'] = ciInfo.pipelineName;
  if (ciInfo.pipelineNumber) tags['ci.pipeline.number'] = ciInfo.pipelineNumber;
  if (ciInfo.pipelineUrl) tags['ci.pipeline.url'] = ciInfo.pipelineUrl;
  if (ciInfo.jobName) tags['ci.job.name'] = ciInfo.jobName;
  if (ciInfo.jobUrl) tags['ci.job.url'] = ciInfo.jobUrl;
  if (ciInfo.workspacePath) tags['ci.workspace_path'] = ciInfo.workspacePath;

  return tags;
}

function gzipFile(filePath: string): Buffer {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content);
}

function getReportFilename(filePath: string): string {
  let filename = path.basename(filePath);
  // Remove leading dot as backend doesn't accept filenames starting with a dot
  if (filename.startsWith('.')) {
    filename = filename.slice(1);
  }
  return filename;
}

async function uploadBatch(
  options: UploadOptions,
  files: CoverageFile[],
  spanTags: SpanTags,
  retries = 3
): Promise<void> {
  const intakeUrl = `https://ci-intake.${options.site}`;
  const form = new FormData();

  // Build event metadata
  const event: Record<string, unknown> = {
    type: 'coverage_report',
    '_dd.hostname': os.hostname(),
    ...spanTags,
  };

  // Add service if provided
  if (options.service) {
    event['service'] = options.service;
  }

  // Add environment if provided
  if (options.env) {
    event['env'] = options.env;
  }

  // Add flags if provided
  if (options.flags && options.flags.length > 0) {
    event['report.flags'] = options.flags;
  }

  // Add format from first file (they should all be grouped by format ideally)
  const format = files[0]?.format || 'unknown';
  event['format'] = format;

  form.append('event', JSON.stringify(event), { filename: 'event.json' });

  // Add coverage files (gzipped)
  for (const file of files) {
    const gzippedContent = gzipFile(file.path);
    const filename = `${getReportFilename(file.path)}.gz`;

    form.append('code_coverage_report_file', gzippedContent, {
      filename,
      contentType: 'application/gzip',
    });

    core.info(`Uploading: ${file.path} (${file.format})`);
  }

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(`${intakeUrl}/api/v2/cicovreprt`, form, {
        headers: {
          ...form.getHeaders(),
          'DD-API-KEY': options.apiKey,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000, // 60 second timeout
      });

      if (response.status >= 200 && response.status < 300) {
        return; // Success
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;

        // Don't retry on 400 or 403 errors (client errors that won't change)
        if (status === 400 || status === 403) {
          throw new Error(`Upload failed with status ${status}: ${axiosError.response?.data || axiosError.message}`);
        }

        core.warning(`Upload attempt ${attempt}/${retries} failed: ${axiosError.message}`);
      } else {
        core.warning(`Upload attempt ${attempt}/${retries} failed: ${lastError.message}`);
      }

      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Upload failed after all retries');
}

export async function uploadCoverageFiles(options: UploadOptions): Promise<void> {
  const spanTags = buildSpanTags(options.gitInfo, options.ciInfo);

  // Upload files in batches of 8 (backend supports 10 attachments, but we leave room for metadata)
  const batchSize = 8;

  for (let i = 0; i < options.files.length; i += batchSize) {
    const batch = options.files.slice(i, i + batchSize);
    await uploadBatch(options, batch, spanTags);
  }
}
