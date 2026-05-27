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
    format: 'best', // 포맷 에러 방지를 위해 가장 확실한 'best' 사용
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    referer: 'https://www.youtube.com/',
    extraArgs: ['--extractor-args', 'youtube:player_client=ios,mweb;player_skip=web,web_embedded', '--force-ipv4']
  },
  tiktok: {
    domains: ['tiktok.com'],
    format: 'best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/', // 틱톡은 일반적인 유입을 선호함
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
// 유틸리티
// =================================
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
    // 스트리밍 안정성을 위한 범용 FFmpeg 설정
    args.push('--downloader', 'ffmpeg');
    args.push('--downloader-args', 'ffmpeg:-movflags frag_keyframe+empty_moov -f mp4');
  }
  return args;
}

// =================================
// 라우트
// =================================
app.use(cors());

// 정적 파일 및 다국어 지원
app.get(['/sw.js', '/verification.txt', '/verification.html'], (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, req.path.split('/').pop()));
});
app.use(express.static(FRONTEND_PATH));
app.get(['/en', '/ko', '/ja'], (req, res) => res.sendFile(path.join(FRONTEND_PATH, 'index.html')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL_REQUIRED' });

  const config = getPlatformConfig(url);
  if (!config) return res.status(400).json({ error: 'UNSUPPORTED_DOMAIN' });

  let downloadProc = null;

  try {
    // 1. 정보 추출
    const metadataArgs = [url, ...buildYtDlpArgs(url, config, true)];
    const metadataProc = spawn('yt-dlp', metadataArgs);
    let stdout = '';
    let stderr = '';

    metadataProc.stdout.on('data', (d) => stdout += d.toString());
    metadataProc.stderr.on('data', (d) => stderr += d.toString());

    await new Promise((resolve, reject) => {
      metadataProc.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr)));
    });

    const metadata = JSON.parse(stdout);
    const title = (metadata.title || crypto.randomBytes(4).toString('hex')).replace(/[\\/:*?"<>|]/g, "").substring(0, 80);

    // 2. 헤더 설정
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp4"`);

    // 3. 다운로드 시작
    const downloadArgs = [url, ...buildYtDlpArgs(url, config, false)];
    downloadProc = spawn('yt-dlp', downloadArgs);

    downloadProc.stdout.pipe(res);
    downloadProc.stderr.on('data', (d) => console.error(`[STREAM-ERR] ${d.toString()}`));

    downloadProc.on('close', (code) => {
      console.log(`[FINISH] ${title} (${code})`);
      res.end();
    });

    req.on('close', () => {
      if (downloadProc) {
        downloadProc.kill('SIGTERM');
        console.log('[CANCEL] Client disconnected');
      }
    });

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'FAILED', message: '영상 처리 중 오류가 발생했습니다.' });
    }
  }
});

app.listen(PORT, () => console.log(`🚀 TAEO Modular Server running on port ${PORT}`));
