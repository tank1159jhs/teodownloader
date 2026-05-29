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
// 플랫폼별 독립 설정 (폰재생+속도개선3 기반)
// =================================
const PLATFORM_CONFIGS = {
  youtube: {
    domains: ['youtube.com', 'youtu.be'],
    // [사용자 불패 공식] 폰재생 호환성 + 봇 탐지 우회
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    referer: 'https://www.youtube.com/',
    extraArgs: [
      '--extractor-args', 'youtube:player_client=android',
      '--force-ipv4',
      '--no-playlist',
      '--no-check-certificates',
      '--no-cache-dir'
    ]
  },
  tiktok: {
    domains: ['tiktok.com'],
    // 틱톡 폰재생 호환성 강화
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/',
    extraArgs: ['--no-playlist']
  },
  instagram: {
    domains: ['instagram.com'],
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/',
    extraArgs: ['--no-playlist']
  },
  twitter: {
    domains: ['x.com', 'twitter.com'],
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://x.com/',
    extraArgs: ['--no-playlist']
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

  const cookiesPath = process.env.YTDLP_COOKIES || '/home/opc/cookies.txt';
  if (fs.existsSync(cookiesPath)) args.push('--cookies', cookiesPath);
  if (process.env.YTDLP_PROXY) args.push('--proxy', process.env.YTDLP_PROXY);

  if (isMetadata) {
    // [속도 최적화] 제목만 빠르게 추출
    args.push('--print', '%(title)s');
  } else {
    args.push('-f', config.format);
    args.push('-o', '-');
    args.push('--no-part', '--quiet');
    args.push('--merge-output-format', 'mp4');
    // 아이폰 재생 호환성을 위한 FFmpeg 필터 적용
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
  res.sendFile('index.html', { root: FRONTEND_PATH });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL_REQUIRED' });

  const config = getPlatformConfig(url);
  if (!config) return res.status(400).json({ error: 'UNSUPPORTED_DOMAIN' });

  let downloadProc = null;

  try {
    // 1. 정보 추출 (Turbo 모드)
    const metadataArgs = buildYtDlpArgs(url, config, true);
    const metadataProc = spawn('yt-dlp', [...metadataArgs, url]);
    let title = '';
    let metadataStderr = '';
    
    await new Promise((resolve, reject) => {
      metadataProc.stdout.on('data', (d) => title += d.toString());
      metadataProc.stderr.on('data', (d) => metadataStderr += d.toString());
      metadataProc.on('close', (code) => {
        if (code === 0) resolve();
        else {
          console.error(`[META-ERR] code ${code}: ${metadataStderr.trim()}`);
          reject(new Error('META_FAIL'));
        }
      });
    });

    const cleanTitle = (title.trim() || crypto.randomBytes(4).toString('hex')).replace(/[\\/:*?"<>|]/g, "").substring(0, 80);

    // 2. 응답 헤더 (아이폰 Safari 표준 파일명)
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(cleanTitle)}.mp4`);

    // 3. 실제 다운로드
    const downloadArgs = buildYtDlpArgs(url, config, false);
    console.log(`[DL-START] ${cleanTitle}`);
    
    downloadProc = spawn('yt-dlp', [...downloadArgs, url]);
    downloadProc.stdout.pipe(res);

    downloadProc.on('close', (code) => {
      console.log(`[DL-END] ${cleanTitle} (${code})`);
      res.end();
    });

  } catch (err) {
    console.error(`[DL-ERR] ${err.message}`);
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

app.listen(PORT, () => console.log(`🚀 TAEO Standard-Turbo Server on port ${PORT}`));
