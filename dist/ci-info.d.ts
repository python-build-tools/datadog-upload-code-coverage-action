export interface CIInfo {
    provider: string | undefined;
    pipelineId: string | undefined;
    pipelineName: string | undefined;
    pipelineNumber: string | undefined;
    pipelineUrl: string | undefined;
    jobName: string | undefined;
    jobUrl: string | undefined;
    workspacePath: string | undefined;
}
export declare function getCIInfo(): CIInfo;
