export interface CoverageFile {
    path: string;
    format: string;
}
export declare function findCoverageFiles(patterns: string): Promise<CoverageFile[]>;
