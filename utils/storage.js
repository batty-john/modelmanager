const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Durable photo storage. The container disk is wiped on every redeploy, so every file written
 * under public/uploads is mirrored to a private S3 bucket (key = "uploads/<path under uploads>").
 * Local disk stays the fast path; a file missing locally is streamed from the bucket.
 * Without S3_BUCKET (local dev) this is a no-op and the app behaves exactly as before.
 */
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
const enabled = Boolean(process.env.S3_BUCKET);

const s3 = enabled
  ? new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    })
  : null;

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

// Relative path under public/uploads → bucket key. Rejects anything that escapes the uploads dir.
function keyFor(relPath) {
  const normalized = path.posix.normalize(String(relPath).replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!normalized || normalized.startsWith('..')) return null;
  return `uploads/${normalized}`;
}

// Accepts an absolute path inside public/uploads, a "/public/uploads/..." URL, or a bare relative path.
function relFrom(p) {
  if (!p) return null;
  if (path.isAbsolute(p) && p.startsWith(UPLOADS_DIR)) return path.relative(UPLOADS_DIR, p);
  return String(p).replace(/^\/?public\/uploads\//, '');
}

async function put(p) {
  if (!enabled) return;
  const rel = relFrom(p);
  const key = keyFor(rel);
  if (!key) return;
  const filePath = path.join(UPLOADS_DIR, rel);
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentLength: fs.statSync(filePath).size,
        ContentType: MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream',
      })
    );
  } catch (err) {
    console.error(`❌ storage: upload failed for ${key}:`, err.message);
  }
}

async function remove(p) {
  if (!enabled) return;
  const key = keyFor(relFrom(p));
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  } catch (err) {
    console.error(`❌ storage: delete failed for ${key}:`, err.message);
  }
}

/**
 * multer storage engine: writes to disk exactly like diskStorage, then mirrors the file to the
 * bucket before the request handler runs (so imageProcessor still finds the local original).
 */
function mirroredDiskStorage(opts) {
  const disk = multer.diskStorage(opts);
  return {
    _handleFile(req, file, cb) {
      disk._handleFile(req, file, (err, info) => {
        if (err) return cb(err);
        put(info.path).then(() => cb(null, info), () => cb(null, info));
      });
    },
    _removeFile(req, file, cb) {
      disk._removeFile(req, file, (err) => {
        remove(file.path).finally(() => cb(err));
      });
    },
  };
}

/**
 * Mounted at /public/uploads ahead of express.static: serves local files as before, and streams
 * files that only exist in the bucket (everything uploaded before the last redeploy).
 */
function serveMiddleware() {
  return async (req, res, next) => {
    if (!enabled || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
    const rel = decodeURIComponent(req.path);
    const key = keyFor(rel);
    if (!key) return res.status(404).end();
    if (fs.existsSync(path.join(UPLOADS_DIR, rel))) return next();
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
      res.set('Content-Type', obj.ContentType || MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream');
      if (obj.ContentLength != null) res.set('Content-Length', String(obj.ContentLength));
      // Upload filenames are unique per upload and never rewritten in place.
      res.set('Cache-Control', 'public, max-age=86400');
      if (req.method === 'HEAD') return res.end();
      obj.Body.on('error', next).pipe(res);
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return res.status(404).end();
      next(err);
    }
  };
}

module.exports = { enabled, put, remove, mirroredDiskStorage, serveMiddleware };
