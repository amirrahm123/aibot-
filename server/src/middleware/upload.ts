import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'uploads');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Ensure upload directory exists (use /tmp on serverless)
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `invoice-${uniqueSuffix}${ext}`);
  },
});

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('סוג קובץ לא נתמך — רק PDF, JPEG, PNG'));
  }
}

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});
