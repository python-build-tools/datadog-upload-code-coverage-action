// Manual mock for @actions/core
export const getInput = jest.fn();
export const setOutput = jest.fn();
export const setFailed = jest.fn();
export const info = jest.fn();
export const warning = jest.fn();
export const error = jest.fn();
export const debug = jest.fn();
export const startGroup = jest.fn();
export const endGroup = jest.fn();
export const saveState = jest.fn();
export const getState = jest.fn();
export const group = jest.fn();
export const getBooleanInput = jest.fn();
export const getMultilineInput = jest.fn();
export const setSecret = jest.fn();
export const addPath = jest.fn();
export const exportVariable = jest.fn();
export const setCommandEcho = jest.fn();
export const isDebug = jest.fn();

// Summary and platform exports
export const summary = {
  addRaw: jest.fn(),
  addEOL: jest.fn(),
  addCodeBlock: jest.fn(),
  addList: jest.fn(),
  addTable: jest.fn(),
  addDetails: jest.fn(),
  addImage: jest.fn(),
  addHeading: jest.fn(),
  addSeparator: jest.fn(),
  addBreak: jest.fn(),
  addQuote: jest.fn(),
  addLink: jest.fn(),
  clear: jest.fn(),
  stringify: jest.fn(),
  isEmptyBuffer: jest.fn(),
  emptyBuffer: jest.fn(),
  filePath: jest.fn(),
  wrap: jest.fn(),
  write: jest.fn(),
};

export const markdownSummary = summary;

export const toPosixPath = jest.fn((p: string) => p.replace(/\\/g, '/'));
export const toWin32Path = jest.fn((p: string) => p.replace(/\//g, '\\'));
export const toPlatformPath = jest.fn((p: string) => p);

export const platform = {
  getDetails: jest.fn(),
  isWindows: jest.fn(() => process.platform === 'win32'),
  isMacOS: jest.fn(() => process.platform === 'darwin'),
  isLinux: jest.fn(() => process.platform === 'linux'),
};
