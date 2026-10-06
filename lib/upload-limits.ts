// Leave room for multipart fields beneath the 1 MB Server Action body limit.
export const MAX_UPLOAD_BYTES = 900 * 1024;
export const UPLOAD_SIZE_HINT = 'Maximum file size: 900 KB.';

export function uploadSizeError(file: { size: number }): string | null {
    return file.size > MAX_UPLOAD_BYTES
        ? 'Upload limit reached. Please choose an image or GIF smaller than or equal to 900 KB.'
        : null;
}
