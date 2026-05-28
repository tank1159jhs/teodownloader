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
    // 아이폰 호환성을 위해 h264(avc1) 코덱 우선 순위 부여
    format: 'bestvideo[vcodec^=avc1]+bestaudio[ext=m4a]/best[vcodec^=avc1]/best',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    referer: 'https://www.youtube.com/',
    extraArgs: [
      '--extractor-args', 'youtube:player_client=ios,mweb',
      '--force-ipv4',
      '--no-playlist',
      '--no-check-certificates'
    ]
  },
  tiktok: {
    domains: ['tiktok.com'],
    format: 'best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/',
    impersonate: 'chrome',
    extraArgs: ['--no-playlist']
  },
  instagram: {
    domains: ['instagram.com'],
    format: 'best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/',
    impersonate: 'chrome',
    extraArgs: ['--no-playlist']
  },
  twitter: {
    domains: ['x.com', 'twitter.com'],
    format: 'best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://x.com/',
    impersonate: 'chrome',
    extraArgs: ['--no-playlist']
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
    // 메타데이터 추출 속도 향상을 위한 최소 정보만 요청
    args.push('--dump-json', '--flat-playlist');
  } else {
    args.push('-f', config.format);
    args.push('-o', '-');
    args.push('--no-part', '--quiet');
    args.push('--merge-output-format', 'mp4');
    // 아이폰 재생 가능하도록 movflags 설정
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

  console.log(`[DL-REQ] ${url}`);
  let downloadProc = null;

  try {
    // 1. 정보 추출 (타임아웃 설정 및 속도 최적화)
    const metadataArgs = buildYtDlpArgs(url, config, true);
    const metadataProc = spawn('yt-dlp', [...metadataArgs, url]);
    let stdout = '';
    
    await new Promise((resolve, reject) => {
      metadataProc.stdout.on('data', (d) => stdout += d.toString());
      metadataProc.on('close', (code) => code === 0 ? resolve() : reject(new Error('META_FAIL')));
      setTimeout(() => { metadataProc.kill(); reject(new Error('TIMEOUT')); }, 15000);
    });

    const metadata = JSON.parse(stdout);
    const title = (metadata.title || crypto.randomBytes(4).toString('hex')).replace(/[\\/:*?"<>|]/g, "").substring(0, 80);

    // 2. 응답 헤더 설정 (아이폰/사파리 파일명 호환 표준 적용)
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.mp4`);

    // 3. 실제 다운로드 (Stream)
    const downloadArgs = buildYtDlpArgs(url, config, false);
    downloadProc = spawn('yt-dlp', [...downloadArgs, url]);
    downloadProc.stdout.pipe(res);

    downloadProc.on('close', (code) => {
      console.log(`[DL-FINISHED] ${title} (${code})`);
      res.end();
    });

  } catch (err) {
    console.error(`[DL-ERROR] ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'FAILED', message: '영상을 처리할 수 없습니다.' });
    }
  }

  req.on('close', () => downloadProc && downloadProc.kill('SIGTERM'));
});

app.listen(PORT, () => console.log(`🚀 TAEO Mobile-Optimized Server on port ${PORT}`));
