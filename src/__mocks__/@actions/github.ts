// Manual mock for @actions/github

// Default mock context values - can be overridden in tests
let mockContext = {
  payload: {} as Record<string, unknown>,
  eventName: 'push',
  sha: '',
  ref: '',
  workflow: '',
  action: '',
  actor: '',
  job: '',
  runAttempt: 1,
  runNumber: 0,
  runId: 0,
  apiUrl: 'https://api.github.com',
  serverUrl: 'https://github.com',
  graphqlUrl: 'https://api.github.com/graphql',
  repo: {
    owner: '',
    repo: '',
  },
  issue: {
    owner: '',
    repo: '',
    number: 0,
  },
};

export const context = mockContext;

// Helper to reset context to defaults
export function resetContext(): void {
  mockContext = {
    payload: {},
    eventName: 'push',
    sha: '',
    ref: '',
    workflow: '',
    action: '',
    actor: '',
    job: '',
    runAttempt: 1,
    runNumber: 0,
    runId: 0,
    apiUrl: 'https://api.github.com',
    serverUrl: 'https://github.com',
    graphqlUrl: 'https://api.github.com/graphql',
    repo: {
      owner: '',
      repo: '',
    },
    issue: {
      owner: '',
      repo: '',
      number: 0,
    },
  };
  // Update the exported context reference
  Object.assign(context, mockContext);
}

// Helper to set context values in tests
export function setContext(overrides: Partial<typeof mockContext>): void {
  Object.assign(context, overrides);
}

// Mock getOctokit function
export const getOctokit = jest.fn();
