import { CoverageFile } from './file-finder';
import { GitHubContext } from './github-context';
export interface UploadOptions {
    apiKey: string;
    site: string;
    files: CoverageFile[];
    context: GitHubContext;
    service?: string;
    env?: string;
    flags?: string[];
}
export declare function uploadCoverageFiles(options: UploadOptions): Promise<void>;
