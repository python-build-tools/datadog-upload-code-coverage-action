import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as os from 'os';
import * as core from '@actions/core';
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { CoverageFile } from './file-finder';
import { GitHubContext } from './github-context';

export interface UploadOptions {
  apiKey: string;
  site: string;
  files: CoverageFile[];
  context: GitHubContext;
  service?: string;
  env?: string;
  flags?: string[];
}

function buildSpanTags(ctx: GitHubContext): Record<string, string> {
  const tags: Record<string, string> = {};

  // Git tags (only repositoryUrl and commitSha are required)
  tags['git.repository_url'] = ctx.repositoryUrl;
  tags['git.commit.sha'] = ctx.commitSha;
  if (ctx.branch) tags['git.branch'] = ctx.branch;
  if (ctx.tag) tags['git.tag'] = ctx.tag;

  // CI tags (GitHub Actions)
  tags['ci.provider.name'] = 'github';
  tags['ci.pipeline.id'] = ctx.pipelineId;
  tags['ci.pipeline.name'] = ctx.pipelineName;
  tags['ci.pipeline.number'] = ctx.pipelineNumber;
  tags['ci.pipeline.url'] = ctx.pipelineUrl;
  tags['ci.job.name'] = ctx.jobName;
  tags['ci.job.url'] = ctx.jobUrl;
  tags['ci.workspace_path'] = ctx.workspacePath;

  return tags;
}

function gzipFile(filePath: string): Buffer {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content);
}

function getReportFilename(filePath: string): string {
  let filename = path.basename(filePath);
  if (filename.startsWith('.')) {
    filename = filename.slice(1);
  }
  return filename;
}

async function uploadBatch(
  options: UploadOptions,
  files: CoverageFile[],
  spanTags: Record<string, string>,
  retries = 3
): Promise<void> {
  const intakeUrl = `https://ci-intake.${options.site}`;
  const form = new FormData();

  const event: Record<string, unknown> = {
    type: 'coverage_report',
    '_dd.hostname': os.hostname(),
    format: files[0]?.format || 'unknown',
    ...spanTags,
  };

  if (options.service) event['service'] = options.service;
  if (options.env) event['env'] = options.env;
  if (options.flags?.length) event['report.flags'] = options.flags;

  form.append('event', JSON.stringify(event), { filename: 'event.json' });

  for (const file of files) {
    const gzippedContent = gzipFile(file.path);
    form.append('code_coverage_report_file', gzippedContent, {
      filename: `${getReportFilename(file.path)}.gz`,
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
        timeout: 60000,
      });

      if (response.status >= 200 && response.status < 300) {
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;

        if (status === 400 || status === 403) {
          throw new Error(
            `Upload failed with status ${status}: ${axiosError.response?.data || axiosError.message}`
          );
        }

        core.warning(`Upload attempt ${attempt}/${retries} failed: ${axiosError.message}`);
      } else {
        core.warning(`Upload attempt ${attempt}/${retries} failed: ${lastError.message}`);
      }

      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Upload failed after all retries');
}

export async function uploadCoverageFiles(options: UploadOptions): Promise<void> {
  const spanTags = buildSpanTags(options.context);
  const batchSize = 8;

  for (let i = 0; i < options.files.length; i += batchSize) {
    const batch = options.files.slice(i, i + batchSize);
    await uploadBatch(options, batch, spanTags);
  }
}
