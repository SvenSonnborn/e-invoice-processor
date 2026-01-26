/**
 * Storage Client
 * Abstraction layer for S3/R2/local storage
 */

export interface StorageClient {
  upload(key: string, data: Buffer | string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

export function createStorageClient(): StorageClient {
  // TODO: Implement storage client based on environment
  throw new Error("Not implemented");
}
