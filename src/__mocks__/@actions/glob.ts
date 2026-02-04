// Manual mock for @actions/glob
export const create = jest.fn();
export const hashFiles = jest.fn();

export interface Globber {
  getSearchPaths(): string[];
  glob(): Promise<string[]>;
  globGenerator(): AsyncGenerator<string, void>;
}

export interface GlobOptions {
  followSymbolicLinks?: boolean;
  implicitDescendants?: boolean;
  matchDirectories?: boolean;
  omitBrokenSymbolicLinks?: boolean;
}
