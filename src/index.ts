import * as core from '@actions/core';
import { uploadCoverageFiles } from './uploader';
import { findCoverageFiles } from './file-finder';
import { getGitHubContext } from './github-context';

async function run(): Promise<void> {
  try {
    const startTime = Date.now();

    // Get inputs
    const apiKey =
      core.getInput('api-key') || process.env.DD_API_KEY || process.env.DATADOG_API_KEY;
    const site =
      core.getInput('site') || process.env.DD_SITE || process.env.DATADOG_SITE || 'datadoghq.com';
    const filesPattern = core.getInput('files', { required: true });
    const service = core.getInput('service') || process.env.DD_SERVICE;
    const env = core.getInput('env') || process.env.DD_ENV;
    const flagsInput = core.getInput('flags');
    const dryRun = core.getInput('dry-run') === 'true';

    if (!apiKey) {
      throw new Error(
        'Datadog API key is required. Set it via api-key input, DD_API_KEY, or DATADOG_API_KEY environment variable.'
      );
    }

    const flags = flagsInput
      ? flagsInput
          .split(',')
          .map((f) => f.trim())
          .filter((f) => f.length > 0)
      : undefined;

    if (flags && flags.length > 32) {
      throw new Error(`Maximum of 32 flags allowed, but ${flags.length} were provided`);
    }

    // Find coverage files
    core.info(`Searching for coverage files matching: ${filesPattern}`);
    const files = await findCoverageFiles(filesPattern);

    if (files.length === 0) {
      core.warning('No coverage files found matching the pattern');
      core.setOutput('uploaded-files', 0);
      core.setOutput('upload-time', 0);
      return;
    }

    core.info(`Found ${files.length} coverage file(s)`);
    files.forEach((f) => core.info(`  - ${f.path} (${f.format})`));

    // Get GitHub Actions context
    const context = getGitHubContext();

    core.debug(`Context: ${JSON.stringify(context)}`);

    if (!context.repositoryUrl) {
      throw new Error('Could not determine git repository URL');
    }

    if (!context.commitSha) {
      throw new Error('Could not determine git commit SHA');
    }

    // Upload files
    if (dryRun) {
      core.info('[DRY-RUN] Would upload the following files:');
      files.forEach((f) => core.info(`  - ${f.path}`));
    } else {
      await uploadCoverageFiles({
        apiKey,
        site,
        files,
        context,
        service,
        env,
        flags,
      });
    }

    const elapsed = (Date.now() - startTime) / 1000;
    core.info(
      `✅ ${dryRun ? '[DRY-RUN] ' : ''}Uploaded ${files.length} file(s) in ${elapsed.toFixed(2)} seconds`
    );

    core.setOutput('uploaded-files', files.length);
    core.setOutput('upload-time', elapsed.toFixed(2));
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
