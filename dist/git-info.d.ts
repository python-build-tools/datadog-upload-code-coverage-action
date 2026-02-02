export interface GitInfo {
    repositoryUrl: string | undefined;
    commitSha: string | undefined;
    branch: string | undefined;
    tag: string | undefined;
    commitMessage: string | undefined;
    authorName: string | undefined;
    authorEmail: string | undefined;
    committerName: string | undefined;
    committerEmail: string | undefined;
}
export declare function getGitInfo(): Promise<GitInfo>;
