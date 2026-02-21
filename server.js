import express from 'express';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, 'uploads', 'videos');

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = express();
app.use(express.json({ limit: '100mb' }));

// CORS for Vite dev server
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// Serve saved videos
app.use('/videos', express.static(UPLOAD_DIR));

// Save video endpoint
app.post('/api/save-video', (req, res) => {
  const { data, mimeType = 'video/mp4' } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const subType = mimeType.split('/')[1] ?? 'mp4';
  const ext = subType.replace(/[^a-z0-9]/gi, '') || 'mp4';
  const filename = `${randomUUID()}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);

  writeFileSync(filepath, Buffer.from(data, 'base64'));
  console.log(`[video-server] Saved: ${filename} (${mimeType})`);

  res.json({ url: `/videos/${filename}` });
});

const PORT = Number(process.env.VIDEO_SERVER_PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`[video-server] Running on http://localhost:${PORT}`);
  console.log(`[video-server] Videos saved to: ${UPLOAD_DIR}`);
});
