import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import stream from 'node:stream';
import { promisify } from 'node:util';
import { uploadStreamToGridFS, uploadBufferToGridFS } from './gridfs.js';

/**
 * S3 utility for streaming uploads to AWS S3
 * Requirement C: stream files to S3 to avoid loading fully in memory
 * Requirement H: use server-side streaming to avoid memory pressure
 */

const pipeline = promisify(stream.pipeline);

// Feature flag: allow disabling AWS S3 and use GridFS instead
const USE_GRIDFS = String(process.env.USE_GRIDFS || '').toLowerCase() === 'true';

// Initialize S3 client (only if not using GridFS)
let s3Client = null;
if (!USE_GRIDFS) {
  s3Client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
}

/**
 * Upload a stream to S3 with retry logic
 * @param {ReadableStream} readStream - readable stream of data
 * @param {string} key - S3 object key (e.g., "avatars/userId/uuid.glb")
 * @param {string} contentType - MIME type
 * @param {number} retries - retry attempts (default 3)
 * @returns {Promise<string>} - S3 URL of uploaded object
 */
export async function uploadStreamToS3(readStream, key, contentType = 'application/octet-stream', retries = 3) {
  if (USE_GRIDFS || !process.env.S3_BUCKET) {
    // store in GridFS using key as filename
  const safeName = key.replaceAll('/', '_');
  const url = await uploadStreamToGridFS(readStream, safeName, contentType);
    return url; // e.g., /api/files/:id
  }
  const bucket = process.env.S3_BUCKET;

  // Collect stream into buffer (necessary for AWS SDK v3)
  const chunks = [];
  for await (const chunk of readStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await s3Client.send(command);
      const s3Url = `https://${bucket}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
      console.log(`Successfully uploaded to S3: ${s3Url}`);
      return s3Url;
    } catch (error) {
      lastError = error;
      console.error(`S3 upload attempt ${attempt + 1} failed:`, error.message);
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // exponential backoff
      }
    }
  }

  throw new Error(`S3 upload failed after ${retries} attempts: ${lastError.message}`);
}

/**
 * Upload a buffer to S3
 * @param {Buffer} buffer - buffer to upload
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - S3 URL
 */
export async function uploadBufferToS3(buffer, key, contentType = 'application/octet-stream') {
  if (USE_GRIDFS || !process.env.S3_BUCKET) {
  const safeName = key.replaceAll('/', '_');
  return uploadBufferToGridFS(buffer, safeName, contentType);
  }
  const bucket = process.env.S3_BUCKET;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await s3Client.send(command);
  const s3Url = `https://${bucket}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  console.log(`Successfully uploaded buffer to S3: ${s3Url}`);
  return s3Url;
}

/**
 * Generate a unique S3 key for an avatar GLB
 * @param {string} userId - user ID
 * @returns {string} - S3 key path
 */
export function generateAvatarS3Key(userId) {
  return `avatars/${userId}/${uuidv4()}.glb`;
}

/**
 * Generate a unique S3 key for an asset
 * @param {string} assetId - asset ID
 * @param {string} extension - file extension (e.g., "png", "glb")
 * @returns {string} - S3 key path
 */
export function generateAssetS3Key(assetId, extension) {
  return `assets/${assetId}/${uuidv4()}.${extension}`;
}

export default {
  uploadStreamToS3,
  uploadBufferToS3,
  generateAvatarS3Key,
  generateAssetS3Key,
  s3Client
};
