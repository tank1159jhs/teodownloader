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

// 프론트엔드 정적 파일 경로 설정 (루트의 frontend 폴더를 가리킴)
const FRONTEND_PATH = path.join(__dirname, '../frontend');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// =================================
// 설정
// =================================
const WHITELISTED_DOMAINS = ['tiktok.com', 'instagram.com', 'youtube.com', 'x.com', 'twitter.com'];
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

// yt-dlp 인자 생성 (URL에 따라 분기 처리)
function getYtDlpArgs(url) {
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
  const isX = url.includes('x.com') || url.includes('twitter.com');
  
  // 공통 기본 인자
  const args = ['--no-warnings', '--geo-bypass'];

  if (isYoutube) {
    // [유튜브 전용] iOS 우회 설정
    args.push('--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
    args.push('--referer', 'https://www.youtube.com/');
    args.push('--extractor-args', 'youtube:player_client=ios;player_skip=web,mweb,mweb_embedded,web_embedded');
    args.push('--force-ipv4');
  } else if (isX) {
    // [X/트위터 전용] 
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    args.push('--referer', 'https://x.com/');
    args.push('--impersonate', 'chrome');
  } else {
    // [틱톡/인스타/기타] 검증된 기본 설정
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    args.push('--referer', 'https://www.google.com/');
    args.push('--impersonate', 'chrome');
  }

  // 쿠키 설정
  const envPath = process.env.YTDLP_COOKIES;
  const defaultPath = '/home/opc/cookies.txt';
  let finalPath = null;

  if (envPath && fs.existsSync(envPath)) finalPath = envPath;
  else if (fs.existsSync(defaultPath)) finalPath = defaultPath;

  if (finalPath) args.push('--cookies', finalPath);

  if (process.env.YTDLP_PROXY) {
    args.push('--proxy', process.env.YTDLP_PROXY);
  }

  return args;
}

async function getMetadata(url) {
  return new Promise((resolve, reject) => {
    const args = [url, '--dump-json', ...getYtDlpArgs(url)];
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

// 광고 및 사이트 인증 파일 (루트의 frontend 폴더 기준)
app.get(['/sw.js', '/verification.txt', '/verification.html'], (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, req.path.split('/').pop()));
});

// 정적 파일 서빙
app.use(express.static(FRONTEND_PATH));

// 다국어 서브경로 대응
app.get(['/en', '/ko', '/ja'], (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
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
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp4"`);

    const ytdlpArgs = [
      url,
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-o', '-',
      '--no-part',
      '--quiet',
      ...getYtDlpArgs(url),
      '--downloader', 'ffmpeg',
      '--downloader-args', 'ffmpeg:-movflags frag_keyframe+empty_moov+faststart -f mp4'
    ];

    const downloadProc = spawn('yt-dlp', ytdlpArgs);
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
