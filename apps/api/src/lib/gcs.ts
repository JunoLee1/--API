import { Storage } from '@google-cloud/storage';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

let _storage: Storage | null = null;

function getStorage(): Storage {
  if (!_storage) _storage = new Storage();
  return _storage;
}

export function generateFilename(originalname: string): string {
  const ext = path.extname(originalname);
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
}

export function sanitizeAndGenerateFilename(originalname: string): string {
  const safe = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${Date.now()}-${safe}`;
}

export async function uploadToGCS(
  buffer: Buffer,
  folder: string,
  filename: string,
  mimetype: string,
): Promise<string> {
  if (!BUCKET_NAME) throw new Error('GCS_BUCKET_NAME not set');
  const bucket = getStorage().bucket(BUCKET_NAME);
  const file = bucket.file(`${folder}/${filename}`);
  await file.save(buffer, { metadata: { contentType: mimetype }, public: true });
  return `https://storage.googleapis.com/${BUCKET_NAME}/${folder}/${filename}`;
}

export function gcsUpload(folder: string, sanitize = false) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.file) return next();
    try {
      const filename = sanitize
        ? sanitizeAndGenerateFilename(req.file.originalname)
        : generateFilename(req.file.originalname);
      const url = await uploadToGCS(req.file.buffer, folder, filename, req.file.mimetype);
      (req.file as Express.Multer.File & { gcsUrl: string }).gcsUrl = url;
      next();
    } catch (err) {
      next(err);
    }
  };
}
