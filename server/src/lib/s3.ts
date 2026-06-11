import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

if (!process.env.AWS_REGION) throw new Error('AWS_REGION is required');
if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('AWS_ACCESS_KEY_ID is required');
if (!process.env.AWS_SECRET_ACCESS_KEY) throw new Error('AWS_SECRET_ACCESS_KEY is required');
if (!process.env.S3_BUCKET_NAME) throw new Error('S3_BUCKET_NAME is required');

const BUCKET = process.env.S3_BUCKET_NAME;

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function generatePresignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn = 600
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: s3Key, ContentType: contentType });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteS3Object(s3Key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
}

export async function getS3ObjectBuffer(s3Key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  if (!response.Body) throw new Error('Empty S3 response body');
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
  }
  return Buffer.concat(chunks);
}
