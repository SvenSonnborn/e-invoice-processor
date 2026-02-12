import { supabaseAdminClient } from '@/src/lib/supabase/admin';

/**
 * Storage Client
 * Abstraction layer for Supabase Storage (invoices/documents/exports buckets).
 *
 * Keys are expected to be prefixed with the bucket name:
 * - "invoices/..."  -> stored in the `invoices` bucket
 * - "documents/..." -> stored in the `documents` bucket
 * - "exports/..."   -> stored in the `exports` bucket
 *
 * Within the bucket, you should follow the convention:
 *   workspaceId/userId/documentId/...
 */

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageClient {
  upload(
    key: string,
    data: Buffer | string,
    options?: UploadOptions
  ): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

type BucketName = 'invoices' | 'documents' | 'exports';

function resolveBucketAndPath(key: string): {
  bucket: BucketName;
  path: string;
} {
  const [prefix, ...rest] = key.split('/');
  const path = rest.join('/');

  if (
    (prefix === 'invoices' || prefix === 'documents' || prefix === 'exports') &&
    path
  ) {
    return { bucket: prefix, path };
  }

  // Fallback: treat everything as a document if no explicit bucket prefix given.
  return { bucket: 'documents', path: key };
}

export function createStorageClient(): StorageClient {
  return {
    async upload(key, data, options?) {
      const { bucket, path } = resolveBucketAndPath(key);
      const body = typeof data === 'string' ? Buffer.from(data) : data;

      const { data: uploadData, error } = await supabaseAdminClient.storage
        .from(bucket)
        .upload(path, body, {
          // We generally don't want to overwrite existing artifacts silently.
          upsert: false,
          contentType: options?.contentType,
          metadata: options?.metadata,
        });

      if (error) {
        throw error;
      }

      return `${bucket}/${uploadData.path}`;
    },

    async download(key) {
      const { bucket, path } = resolveBucketAndPath(key);
      const { data, error } = await supabaseAdminClient.storage
        .from(bucket)
        .download(path);

      if (error || !data) {
        throw error ?? new Error('Failed to download object from storage');
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },

    async delete(key) {
      const { bucket, path } = resolveBucketAndPath(key);
      const { error } = await supabaseAdminClient.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        throw error;
      }
    },

    async getUrl(key) {
      const { bucket, path } = resolveBucketAndPath(key);

      // 1 hour signed URL; adjust as needed per use case.
      const { data, error } = await supabaseAdminClient.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);

      if (error || !data?.signedUrl) {
        throw error ?? new Error('Failed to create signed URL');
      }

      return data.signedUrl;
    },
  };
}
