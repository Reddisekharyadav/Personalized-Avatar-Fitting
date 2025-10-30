import mongoose from 'mongoose';
import { Readable } from 'node:stream';

/**
 * GridFS helper: store binary files in MongoDB when AWS S3 is not desired.
 * Returns a relative URL that can be served by GET /api/files/:id
 */

function getBucket() {
  const conn = mongoose.connection;
  if (!conn?.db) {
    throw new Error('MongoDB not connected');
  }
  // Default bucket name 'uploads'
  return new mongoose.mongo.GridFSBucket(conn.db, { bucketName: process.env.GRIDFS_BUCKET || 'uploads' });
}

export async function uploadStreamToGridFS(readStream, filename, contentType = 'application/octet-stream') {
  const bucket = getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType
    });
    readStream.pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        const id = uploadStream.id;
        resolve(`/api/files/${id.toString()}`);
      });
  });
}

export async function uploadBufferToGridFS(buffer, filename, contentType = 'application/octet-stream') {
  const readStream = Readable.from(buffer);
  return uploadStreamToGridFS(readStream, filename, contentType);
}

export async function getGridFSReadStream(id) {
  const bucket = getBucket();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid file id');
  }
  const objectId = new mongoose.Types.ObjectId(id);
  return bucket.openDownloadStream(objectId);
}

export default {
  uploadStreamToGridFS,
  uploadBufferToGridFS,
  getGridFSReadStream
};
