export interface GitHubContext {
    repositoryUrl: string;
    commitSha: string;
    branch: string | undefined;
    tag: string | undefined;
    commitMessage: string | undefined;
    authorName: string | undefined;
    authorEmail: string | undefined;
    committerName: string | undefined;
    committerEmail: string | undefined;
    pipelineId: string;
    pipelineName: string;
    pipelineNumber: string;
    pipelineUrl: string;
    jobName: string;
    jobUrl: string;
    workspacePath: string;
}
export declare function getGitHubContext(): GitHubContext;
