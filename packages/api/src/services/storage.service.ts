import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3 Storage Service
 * Handles pre-signed URL generation for secure direct uploads/downloads
 */

// S3 Configuration from environment
const getS3Config = () => ({
  bucket: process.env.S3_BUCKET || 'cloudvault-files',
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.S3_ENDPOINT, // For LocalStack
  uploadExpiry: parseInt(process.env.UPLOAD_URL_EXPIRY || '3600', 10), // 1 hour
  downloadExpiry: parseInt(process.env.DOWNLOAD_URL_EXPIRY || '3600', 10), // 1 hour
});

// Create S3 client (singleton)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const config = getS3Config();
    
    s3Client = new S3Client({
      region: config.region,
      ...(config.endpoint && {
        endpoint: config.endpoint,
        forcePathStyle: true, // Required for LocalStack
      }),
      // Credentials are loaded from environment or IAM role
    });
  }
  return s3Client;
}

/**
 * Generate a pre-signed URL for uploading a file
 */
export async function generateUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
  metadata?: Record<string, string>;
}): Promise<{ url: string; expiresAt: Date }> {
  const config = getS3Config();
  const client = getS3Client();
  
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
    Metadata: params.metadata,
  });
  
  const url = await getSignedUrl(client, command, {
    expiresIn: config.uploadExpiry,
  });
  
  const expiresAt = new Date(Date.now() + config.uploadExpiry * 1000);
  
  return { url, expiresAt };
}

/**
 * Generate a pre-signed URL for downloading a file
 */
export async function generateDownloadUrl(params: {
  key: string;
  filename?: string; // For Content-Disposition header
}): Promise<{ url: string; expiresAt: Date }> {
  const config = getS3Config();
  const client = getS3Client();
  
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: params.key,
    ...(params.filename && {
      ResponseContentDisposition: `attachment; filename="${params.filename}"`,
    }),
  });
  
  const url = await getSignedUrl(client, command, {
    expiresIn: config.downloadExpiry,
  });
  
  const expiresAt = new Date(Date.now() + config.downloadExpiry * 1000);
  
  return { url, expiresAt };
}

/**
 * Check if an object exists in S3
 */
export async function objectExists(key: string): Promise<boolean> {
  const config = getS3Config();
  const client = getS3Client();
  
  try {
    await client.send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }));
    return true;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Delete an object from S3
 */
export async function deleteObject(key: string): Promise<void> {
  const config = getS3Config();
  const client = getS3Client();
  
  await client.send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
}

/**
 * Get the bucket name
 */
export function getBucketName(): string {
  return getS3Config().bucket;
}
