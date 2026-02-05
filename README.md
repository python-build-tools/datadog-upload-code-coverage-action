# Datadog Upload Code Coverage Action

A fast, lightweight GitHub Action to upload code coverage files to Datadog without installing the `datadog-ci` CLI.

## Why use this instead of `datadog-ci`?

The official `datadog-ci` CLI requires installing a large npm package with many dependencies, which can add significant time to your CI pipeline. This action is a focused, minimal implementation that:

- ⚡ **Fast** - No npm install required, just runs the bundled JavaScript
- 🎯 **Focused** - Does one thing well: upload coverage files
- 📦 **Lightweight** - Minimal dependencies bundled into a single file
- 🔧 **Simple** - Easy to configure with sensible defaults

## Usage

### Basic Example

```yaml
- name: Upload coverage to Datadog
  uses: python-build-tools/datadog-upload-code-coverage-action@v1
  with:
    api-key: ${{ secrets.DD_API_KEY }}
    files: '**/coverage/*.xml'
```

### Full Example

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests with coverage
        run: npm test -- --coverage

      - name: Upload coverage to Datadog
        uses: python-build-tools/datadog-upload-code-coverage-action@v1
        with:
          api-key: ${{ secrets.DD_API_KEY }}
          site: 'datadoghq.com'
          files: |
            coverage/lcov.info
            coverage/cobertura.xml
          service: 'my-service'
          env: 'ci'
          flags: 'type:unit-tests,node-20'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api-key` | Datadog API key. Can also use `DD_API_KEY` env var | No* | - |
| `site` | Datadog site (e.g., `datadoghq.com`, `datadoghq.eu`) | No | `datadoghq.com` |
| `files` | Glob pattern(s) for coverage files to upload | **Yes** | - |
| `service` | Service name for the coverage report | No | - |
| `env` | Environment name (e.g., `ci`, `staging`) | No | - |
| `flags` | Comma-separated flags for grouping (max 32) | No | - |
| `dry-run` | Run without uploading (for testing) | No | `false` |

*Required via input or `DD_API_KEY` / `DATADOG_API_KEY` environment variable

## Outputs

| Output | Description |
|--------|-------------|
| `uploaded-files` | Number of files uploaded |
| `upload-time` | Time taken to upload in seconds |

## Supported Coverage Formats

The action automatically detects the format of your coverage files:

- **JaCoCo** - XML format (Java)
- **Cobertura** - XML format (Python, .NET, etc.)
- **Clover** - XML format (PHP, etc.)
- **LCOV** - `.info` files (JavaScript, Go, etc.)
- **Go** - `.out` files
- **SimpleCov** - `.resultset.json` files (Ruby)
- **OpenCover** - XML format (.NET)

## Environment Variables

You can also configure the action using environment variables:

| Variable | Description |
|----------|-------------|
| `DD_API_KEY` / `DATADOG_API_KEY` | Datadog API key |
| `DD_SITE` / `DATADOG_SITE` | Datadog site |
| `DD_SERVICE` | Service name |
| `DD_ENV` | Environment name |

Git metadata can be overridden with:

| Variable | Description |
|----------|-------------|
| `DD_GIT_REPOSITORY_URL` | Repository URL |
| `DD_GIT_COMMIT_SHA` | Commit SHA |
| `DD_GIT_BRANCH` | Branch name |
| `DD_GIT_TAG` | Tag name |
| `DD_GIT_COMMIT_MESSAGE` | Commit message |
| `DD_GIT_COMMIT_AUTHOR_NAME` | Author name |
| `DD_GIT_COMMIT_AUTHOR_EMAIL` | Author email |
| `DD_GIT_COMMIT_COMMITTER_NAME` | Committer name |
| `DD_GIT_COMMIT_COMMITTER_EMAIL` | Committer email |

## Development

### Building

```bash
npm install
npm run build
```

### Testing

```bash
npm test
```

The build output is in the `dist/` directory and should be committed with changes.

## License

MIT
