import * as glob from '@actions/glob';
import * as path from 'path';
import * as fs from 'fs';

export interface CoverageFile {
  path: string;
  format: string;
}

export class FileFinder {
  /**
   * Reads file content for format detection. Extracted for testability.
   */
  static sampleFileContent(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8').slice(0, 2000); // Read first 2KB for detection
  }
}

const FORMAT_PATTERNS: { pattern: RegExp; format: string; contentCheck?: (content: string) => boolean }[] = [
  // JaCoCo - XML format with jacoco in root element
  {
    pattern: /\.xml$/i,
    format: 'jacoco',
    contentCheck: (content) => content.includes('<report') && content.includes('jacoco')
  },
  // Cobertura - XML format with cobertura in root
  {
    pattern: /\.xml$/i,
    format: 'cobertura',
    contentCheck: (content) => content.includes('<coverage') && (content.includes('cobertura') || content.includes('line-rate'))
  },
  // Clover - XML format
  {
    pattern: /clover\.xml$/i,
    format: 'clover'
  },
  // LCOV - .info files
  {
    pattern: /\.info$/i,
    format: 'lcov'
  },
  {
    pattern: /lcov.*$/i,
    format: 'lcov'
  },
  // Go coverage
  {
    pattern: /\.out$/i,
    format: 'go',
    contentCheck: (content) => content.startsWith('mode:')
  },
  // SimpleCov (Ruby) - JSON with .resultset.json
  {
    pattern: /\.resultset\.json$/i,
    format: 'simplecov-internal'
  },
  // OpenCover - XML format
  {
    pattern: /\.xml$/i,
    format: 'opencover',
    contentCheck: (content) => content.includes('<CoverageSession') || content.includes('OpenCover')
  },
  // Generic JSON coverage
  {
    pattern: /coverage.*\.json$/i,
    format: 'json'
  },
];

function detectFormat(filePath: string, content?: string): string | null {
  const fileName = path.basename(filePath);

  // First pass: check filename patterns that don't need content
  for (const { pattern, format, contentCheck } of FORMAT_PATTERNS) {
    if (pattern.test(fileName)) {
      if (!contentCheck) {
        return format;
      }
    }
  }

  // Second pass: need to check content for files that require content checking
  if (!content && (filePath.endsWith('.xml') || filePath.endsWith('.json') || filePath.endsWith('.out'))) {
    try {
      content = FileFinder.sampleFileContent(filePath);
    } catch {
      return null;
    }
  }

  if (content) {
    for (const { pattern, format, contentCheck } of FORMAT_PATTERNS) {
      if (pattern.test(fileName) && contentCheck && contentCheck(content)) {
        return format;
      }
    }
  }

  // Fallback for common patterns
  if (fileName.endsWith('.xml')) {
    return 'cobertura'; // Default XML format
  }

  if (fileName.endsWith('.json')) {
    return 'json';
  }

  return null;
}

export async function findCoverageFiles(patterns: string): Promise<CoverageFile[]> {
  const globber = await glob.create(patterns, {
    followSymbolicLinks: true,
  });

  const files: CoverageFile[] = [];

  for await (const filePath of globber.globGenerator()) {
    // Skip directories
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      continue;
    }

    const format = detectFormat(filePath);
    if (format) {
      files.push({
        path: filePath,
        format,
      });
    }
  }

  return files;
}
