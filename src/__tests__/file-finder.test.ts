import * as fs from 'fs';
import * as path from 'path';
import { findCoverageFiles, FileFinder } from '../file-finder';

// Mock @actions/glob
jest.mock('@actions/glob', () => ({
  create: jest.fn(),
}));

import * as glob from '@actions/glob';

const mockGlob = glob as jest.Mocked<typeof glob>;

describe('file-finder', () => {
  const testDir = path.join(__dirname, 'fixtures');

  beforeAll(() => {
    // Create test fixtures directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create test files
    fs.writeFileSync(
      path.join(testDir, 'jacoco.xml'),
      '<?xml version="1.0"?><report name="jacoco">jacoco content</report>'
    );

    fs.writeFileSync(
      path.join(testDir, 'cobertura.xml'),
      '<?xml version="1.0"?><coverage line-rate="0.8">cobertura content</coverage>'
    );

    fs.writeFileSync(
      path.join(testDir, 'clover.xml'),
      '<?xml version="1.0"?><coverage>clover content</coverage>'
    );

    fs.writeFileSync(path.join(testDir, 'lcov.info'), 'SF:src/file.ts\nDA:1,1\nend_of_record');

    fs.writeFileSync(path.join(testDir, 'coverage.out'), 'mode: atomic\nfile.go:1.1,2.2 1 1');

    fs.writeFileSync(
      path.join(testDir, 'coverage.resultset.json'),
      '{"RSpec":{"coverage":{}}}'
    );

    fs.writeFileSync(
      path.join(testDir, 'opencover.xml'),
      '<?xml version="1.0"?><CoverageSession>OpenCover content</CoverageSession>'
    );

    fs.writeFileSync(
      path.join(testDir, 'coverage.json'),
      '{"total":{"lines":100}}'
    );

    fs.writeFileSync(path.join(testDir, 'random.txt'), 'not a coverage file');
  });

  afterAll(() => {
    // Cleanup test fixtures
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('findCoverageFiles', () => {
    function createMockGlobber(files: string[]) {
      return {
        glob: jest.fn().mockResolvedValue(files),
        globGenerator: jest.fn().mockImplementation(async function* () {
          for (const file of files) {
            yield file;
          }
        }),
        getSearchPaths: jest.fn().mockReturnValue([]),
      };
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should find and detect JaCoCo XML files', async () => {
      const filePath = path.join(testDir, 'jacoco.xml');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/*.xml');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(filePath);
      expect(files[0].format).toBe('jacoco');
    });

    it('should find and detect Cobertura XML files', async () => {
      const filePath = path.join(testDir, 'cobertura.xml');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/*.xml');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(filePath);
      expect(files[0].format).toBe('cobertura');
    });

    it('should find and detect Clover XML files', async () => {
      const filePath = path.join(testDir, 'clover.xml');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/clover.xml');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(filePath);
      expect(files[0].format).toBe('clover');
    });

    it('should find and detect LCOV files', async () => {
      const filePath = path.join(testDir, 'lcov.info');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/*.info');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(filePath);
      expect(files[0].format).toBe('lcov');
    });

    it('should find and detect Go coverage files', async () => {
      // Go files need content check - the file starts with "mode:"
      const filePath = path.join(testDir, 'coverage.out');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/*.out');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(filePath);
      expect(files[0].format).toBe('go');
    });

    it('should find and detect SimpleCov JSON files', async () => {
      const filePath = path.join(testDir, 'coverage.resultset.json');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/*.resultset.json');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(filePath);
      expect(files[0].format).toBe('simplecov-internal');
    });

    it('should find and detect OpenCover XML files', async () => {
      const filePath = path.join(testDir, 'opencover.xml');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/*.xml');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(filePath);
      expect(files[0].format).toBe('opencover');
    });

    it('should find and detect generic coverage JSON files', async () => {
      const filePath = path.join(testDir, 'coverage.json');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/coverage*.json');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(filePath);
      expect(files[0].format).toBe('json');
    });

    it('should skip directories', async () => {
      mockGlob.create.mockResolvedValue(createMockGlobber([testDir]));

      const files = await findCoverageFiles('**/*');

      expect(files).toHaveLength(0);
    });

    it('should skip unrecognized files', async () => {
      const filePath = path.join(testDir, 'random.txt');
      mockGlob.create.mockResolvedValue(createMockGlobber([filePath]));

      const files = await findCoverageFiles('**/*.txt');

      expect(files).toHaveLength(0);
    });

    it('should handle multiple files', async () => {
      const files = [
        path.join(testDir, 'jacoco.xml'),
        path.join(testDir, 'lcov.info'),
        path.join(testDir, 'coverage.out'),
      ];
      mockGlob.create.mockResolvedValue(createMockGlobber(files));

      const result = await findCoverageFiles('**/*');

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.map((f) => f.format)).toContain('jacoco');
      expect(result.map((f) => f.format)).toContain('lcov');
    });

    it('should handle empty glob results', async () => {
      mockGlob.create.mockResolvedValue(createMockGlobber([]));

      const files = await findCoverageFiles('**/nonexistent.*');

      expect(files).toHaveLength(0);
    });

    it('should use followSymbolicLinks option', async () => {
      mockGlob.create.mockResolvedValue(createMockGlobber([]));

      await findCoverageFiles('**/*');

      expect(mockGlob.create).toHaveBeenCalledWith('**/*', {
        followSymbolicLinks: true,
      });
    });

    it('should fallback to cobertura format for unknown XML files', async () => {
      // Create an XML file that doesn't match any specific format
      const unknownXmlPath = path.join(testDir, 'unknown-format.xml');
      fs.writeFileSync(unknownXmlPath, '<?xml version="1.0"?><unknown>data</unknown>');

      mockGlob.create.mockResolvedValue(createMockGlobber([unknownXmlPath]));

      const files = await findCoverageFiles('**/*.xml');

      expect(files).toHaveLength(1);
      expect(files[0].format).toBe('cobertura');
    });

    it('should fallback to json format for unknown JSON files', async () => {
      // Create a JSON file that doesn't match any specific format pattern
      const unknownJsonPath = path.join(testDir, 'unknown.json');
      fs.writeFileSync(unknownJsonPath, '{"data": "test"}');

      mockGlob.create.mockResolvedValue(createMockGlobber([unknownJsonPath]));

      const files = await findCoverageFiles('**/*.json');

      expect(files).toHaveLength(1);
      expect(files[0].format).toBe('json');
    });

    it('should skip files that cannot be read for content detection', async () => {
      // Create a file path that will trigger content detection but fail to read
      const testPath = path.join(testDir, 'unreadable.xml');
      // Write the file so statSync works (file exists check)
      fs.writeFileSync(testPath, 'dummy content');

      mockGlob.create.mockResolvedValue(createMockGlobber([testPath]));

      const spySampleFileContent = jest.spyOn(FileFinder, 'sampleFileContent').mockImplementation(_ => {
        throw new Error('EACCES: permission denied');
      });

      try {
        const files = await findCoverageFiles('**/*.xml');
        // The file should be skipped due to read error (returns null from detectCoverageFormat)
        expect(files.some((f) => f.path === testPath)).toBe(false);
      } finally {
        spySampleFileContent.mockRestore();
      }
    });
  });
});
