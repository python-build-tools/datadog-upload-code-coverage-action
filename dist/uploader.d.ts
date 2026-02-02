import { CoverageFile } from './file-finder';
import { GitInfo } from './git-info';
import { CIInfo } from './ci-info';
export interface UploadOptions {
    apiKey: string;
    site: string;
    files: CoverageFile[];
    gitInfo: GitInfo;
    ciInfo: CIInfo;
    service?: string;
    env?: string;
    flags?: string[];
}
export declare function uploadCoverageFiles(options: UploadOptions): Promise<void>;
