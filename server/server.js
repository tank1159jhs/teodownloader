import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { URL, fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const FRONTEND_PATH = path.join(__dirname, '../frontend');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// =================================
// 플랫폼별 독립 설정
// =================================
const PLATFORM_CONFIGS = {
  youtube: {
    domains: ['youtube.com', 'youtu.be'],
    // 가장 강력하고 실패 없는 포맷 조합 (비디오+오디오 또는 통합본)
    format: 'bv+ba/b',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    referer: 'https://www.youtube.com/',
    extraArgs: [
      '--extractor-args', 'youtube:player_client=android,web',
      '--force-ipv4',
      '--no-check-certificates'
    ]
  },
  tiktok: {
    domains: ['tiktok.com'],
    format: 'best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/',
    impersonate: 'chrome',
    extraArgs: []
  },
  instagram: {
    domains: ['instagram.com'],
    format: 'best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/',
    impersonate: 'chrome',
    extraArgs: []
  },
  twitter: {
    domains: ['x.com', 'twitter.com'],
    format: 'best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://x.com/',
    impersonate: 'chrome',
    extraArgs: []
  }
};

// =================================
// 공통 인자 생성기
// =================================
function buildYtDlpArgs(url, config, isMetadata = false) {
  const args = [
    '--no-warnings',
    '--geo-bypass',
    '--user-agent', config.userAgent,
    '--referer', config.referer,
    ...config.extraArgs
  ];

  if (config.impersonate) args.push('--impersonate', config.impersonate);

  const cookiesPath = process.env.YTDLP_COOKIES || '/home/opc/cookies.txt';
  if (fs.existsSync(cookiesPath)) args.push('--cookies', cookiesPath);
  if (process.env.YTDLP_PROXY) args.push('--proxy', process.env.YTDLP_PROXY);

  if (isMetadata) {
    args.push('--dump-json');
  } else {
    args.push('-f', config.format);
    args.push('-o', '-');
    args.push('--no-part', '--quiet');
    // 병합 및 스트리밍 안정화 설정 (FFmpeg 에러 8 방지)
    args.push('--merge-output-format', 'mp4');
    args.push('--postprocessor-args', 'ffmpeg:-movflags frag_keyframe+empty_moov');
  }
  return args;
}

// =================================
// 라우트
// =================================
app.use(cors());

app.get(['/sw.js', '/verification.txt', '/verification.html'], (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, req.path.split('/').pop()));
});

app.use(express.static(FRONTEND_PATH));

app.get(['/en', '/ko', '/ja'], (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL_REQUIRED' });

  const config = getPlatformConfig(url);
  if (!config) return res.status(400).json({ error: 'UNSUPPORTED_DOMAIN' });

  let downloadProc = null;

  try {
    // 1. 정보 추출 (Metadata)
    const metadataArgs = buildYtDlpArgs(url, config, true);
    const metadataProc = spawn('yt-dlp', [...metadataArgs, url]);
    let stdout = '';
    
    await new Promise((resolve, reject) => {
      metadataProc.stdout.on('data', (d) => stdout += d.toString());
      metadataProc.on('close', (code) => code === 0 ? resolve() : reject(new Error('META_FAIL')));
    });

    const metadata = JSON.parse(stdout);
    const title = (metadata.title || crypto.randomBytes(4).toString('hex')).replace(/[\\/:*?"<>|]/g, "").substring(0, 80);

    // 2. 응답 헤더 설정
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp4"`);

    // 3. 실제 다운로드 (Stream)
    const downloadArgs = buildYtDlpArgs(url, config, false);
    console.log(`[DL-START] yt-dlp ${downloadArgs.join(' ')} "${url}"`);
    
    downloadProc = spawn('yt-dlp', [...downloadArgs, url]);
    downloadProc.stdout.pipe(res);

    downloadProc.stderr.on('data', (data) => {
      const err = data.toString();
      if (err.includes('ERROR')) console.error(`[STREAM-ERR] ${err}`);
    });

    downloadProc.on('close', (code) => {
      console.log(`[DL-END] ${title} (${code})`);
      res.end();
    });

  } catch (err) {
    console.error(`[PROCESS-ERR] ${err.message}`);
    if (!res.headersSent) res.status(500).json({ error: 'FAILED' });
  }

  req.on('close', () => downloadProc && downloadProc.kill('SIGTERM'));
});

function getPlatformConfig(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    for (const key in PLATFORM_CONFIGS) {
      if (PLATFORM_CONFIGS[key].domains.some(d => hostname === d || hostname.endsWith('.' + d))) {
        return PLATFORM_CONFIGS[key];
      }
    }
  } catch (e) {}
  return null;
}

app.listen(PORT, () => console.log(`🚀 TAEO Production Server running on port ${PORT}`));
