import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { URL } from 'url';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// =================================
// 설정
// =================================
const WHITELISTED_DOMAINS = ['tiktok.com', 'instagram.com', 'youtube.com'];
const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1GB
const CONCURRENT_JOBS = 5;
const DOWNLOAD_TIMEOUT = 10 * 60 * 1000; // 10분

let activeJobs = 0;

// =================================
// 유틸리티
// =================================
function generateRandomId() {
  return crypto.randomBytes(8).toString('hex');
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
}

function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    return { valid: ['http:', 'https:'].includes(url.protocol), url };
  } catch (err) {
    return { valid: false };
  }
}

function isWhitelistedDomain(hostname) {
  return WHITELISTED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
}

// yt-dlp 공통 인자 (차단 우회용)
function getCommonYtDlpArgs() {
  const args = [
    '--no-warnings',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    '--referer', 'https://www.youtube.com/',
    '--geo-bypass',
    '--impersonate', 'chrome'
  ];

  const envPath = process.env.YTDLP_COOKIES;
  const defaultPath = '/home/opc/cookies.txt';
  let finalPath = null;

  // 1. .env에 설정된 경로가 있고 파일이 존재하는지 확인
  if (envPath && fs.existsSync(envPath)) {
    finalPath = envPath;
  } 
  // 2. 아니면 기본 서버 경로에 파일이 있는지 확인
  else if (fs.existsSync(defaultPath)) {
    finalPath = defaultPath;
  }

  if (finalPath) {
    args.push('--cookies', finalPath);
    // console.log(`[INFO] Using cookies from: ${finalPath}`);
  } else {
    if (envPath) console.warn(`[WARN] Cookies file not found at preferred path: ${envPath}`);
    console.warn(`[WARN] No cookies.txt found. YouTube/TikTok might fail.`);
  }

  if (process.env.YTDLP_PROXY) {
    args.push('--proxy', process.env.YTDLP_PROXY);
  }

  return args;
}

async function getMetadata(url) {
  return new Promise((resolve, reject) => {
    const args = [url, '--dump-json', ...getCommonYtDlpArgs()];
    const proc = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());

    proc.on('close', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(new Error('JSON_PARSE_ERROR')); }
      } else {
        reject(new Error(stderr || 'UNKNOWN_ERROR'));
      }
    });
  });
}

// =================================
// 라우트
// =================================
app.use(cors());

// 광고 및 사이트 인증 파일들을 위한 루트 경로 허용 (sw.js 등)
app.get(['/sw.js', '/verification.txt', '/verification.html'], (req, res) => {
  res.sendFile(req.path.split('/').pop(), { root: '../frontend' });
});

// 정적 파일 서빙
app.use(express.static('../frontend'));

// 다국어 서브경로에서 새로고침 시에도 index.html을 서빙하도록 설정
app.get(['/en', '/ko', '/ja'], (req, res) => {
  res.sendFile('index.html', { root: '../frontend' });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', activeJobs }));

app.post('/api/download', async (req, res) => {
  const clientIp = getClientIp(req);
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: 'URL_REQUIRED' });

  const validation = validateUrl(url);
  if (!validation.valid || !isWhitelistedDomain(validation.url.hostname)) {
    return res.status(400).json({ error: 'INVALID_OR_UNSUPPORTED_URL' });
  }

  if (activeJobs >= CONCURRENT_JOBS) {
    return res.status(429).json({ error: 'SERVER_BUSY' });
  }

  activeJobs++;
  console.log(`[START] ${clientIp} -> ${url}`);

  try {
    const metadata = await getMetadata(url);
    const title = (metadata.title || generateRandomId()).replace(/[\\/:*?"<>|]/g, "").substring(0, 80);
    
    // 파일 형식 결정 및 헤더 설정
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp4"`);

    // yt-dlp 실행 인자 구성
    const ytdlpArgs = [
      url,
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-o', '-',
      '--no-part',
      '--quiet',
      ...getCommonYtDlpArgs(),
      // 핵심: ffmpeg을 이용해 fragmented mp4로 강제 출력 (스트리밍 깨짐 방지)
      '--downloader', 'ffmpeg',
      '--downloader-args', 'ffmpeg:-movflags frag_keyframe+empty_moov+faststart -f mp4'
    ];

    const downloadProc = spawn('yt-dlp', ytdlpArgs);

    // 스트림 파이핑
    downloadProc.stdout.pipe(res);

    downloadProc.stderr.on('data', (data) => {
      const err = data.toString();
      if (err.includes('ERROR')) console.error(`[YTDLP-ERR] ${err}`);
    });

    downloadProc.on('close', (code) => {
      activeJobs--;
      console.log(`[END] ${title} (Code: ${code})`);
      if (!res.headersSent && code !== 0) {
        res.status(500).json({ error: 'DOWNLOAD_FAILED' });
      }
    });

    req.on('close', () => {
      if (downloadProc) {
        downloadProc.kill('SIGTERM');
        console.log(`[CANCEL] Client disconnected: ${title}`);
      }
    });

  } catch (err) {
    activeJobs--;
    console.error(`[ERR] ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'METADATA_FAILED', message: '영상 정보를 가져오지 못했습니다.' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 TAEO Server running on port ${PORT}`);
});
