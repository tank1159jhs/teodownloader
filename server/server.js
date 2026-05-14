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
const CONCURRENT_JOBS = 3;
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000; // 5분
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const RATE_LIMIT_MAX = 3; // 1분에 최대 3회

// =================================
// 전역 상태
// =================================
let activeJobs = 0;
const ipRequestMap = new Map(); // IP별 요청 추적
const tempFiles = new Set(); // 임시 파일 추적

// =================================
// 유틸리티 함수
// =================================
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
}

function checkRateLimit(ip) {
  const now = Date.now();
  if (!ipRequestMap.has(ip)) {
    ipRequestMap.set(ip, []);
  }
  const timestamps = ipRequestMap.get(ip);
  const recentRequests = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recentRequests.length >= RATE_LIMIT_MAX) {
    return false;
  }
  recentRequests.push(now);
  ipRequestMap.set(ip, recentRequests);
  return true;
}

function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Invalid protocol' };
    }
    return { valid: true, url };
  } catch (err) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function isWhitelistedDomain(hostname) {
  return WHITELISTED_DOMAINS.some(domain =>
    hostname === domain || hostname.endsWith('.' + domain)
  );
}

function generateRandomId() {
  return crypto.randomBytes(8).toString('hex');
}

function getFileExtension(metadata) {
  if (metadata.ext) return metadata.ext;
  if (metadata.format_id?.includes('video')) return 'mp4';
  return 'mp4';
}

function executeYtDlp(args, timeout = DOWNLOAD_TIMEOUT) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const ytdlpArgs = [...args];
    if (process.env.YTDLP_PROXY) {
      ytdlpArgs.push('--proxy', process.env.YTDLP_PROXY);
    }
    const proc = spawn('yt-dlp', ytdlpArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('yt-dlp timeout exceeded'));
    }, timeout);
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        if (stderr.includes('429') || stderr.includes('403') || stderr.includes('blocked')) {
          reject(new Error('IP_BLOCKED: Service rate limited, please try again later'));
        } else if (stderr.includes('video not found') || stderr.includes('HTTP Error 404')) {
          reject(new Error('VIDEO_NOT_FOUND: Unable to find video'));
        } else {
          reject(new Error(`yt-dlp error: ${stderr.substring(0, 200)}`));
        }
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

async function cleanupTempFile(filePath) {
  if (tempFiles.has(filePath)) {
    try {
      await fs.promises.unlink(filePath);
      tempFiles.delete(filePath);
      console.log(`[CLEANUP] Deleted: ${filePath}`);
    } catch (err) {
      console.error(`[CLEANUP ERROR] Failed to delete ${filePath}: ${err.message}`);
    }
  }
}

function mapYtDlpErrorMessage(errorMessage) {
  if (!errorMessage) return '다운로드에 실패했습니다. URL을 확인해 주세요.';
  if (errorMessage.includes('There is no video in this post')) {
    return '해당 Instagram 게시물에 동영상이 없습니다. 올바른 동영상 URL을 입력해 주세요.';
  }
  if (errorMessage.includes('You need to log in')) {
    return 'Instagram 스토리 또는 비공개 콘텐츠는 다운로드할 수 없습니다.';
  }
  if (errorMessage.includes('video not found') || errorMessage.includes('Video not found') || errorMessage.includes('HTTP Error 404')) {
    return '영상을 찾을 수 없습니다. URL을 확인해 주세요.';
  }
  if (errorMessage.includes('IP_BLOCKED') || errorMessage.includes('rate limited') || errorMessage.includes('blocked')) {
    return '다운로드가 일시적으로 차단되었습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (errorMessage.includes('Unsupported URL')) {
    return '지원하지 않는 URL입니다. TikTok, Instagram, YouTube 동영상 URL만 입력해 주세요.';
  }
  if (errorMessage.includes('timeout')) {
    return '다운로드 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
  }
  return errorMessage.length > 200 ? errorMessage.substring(0, 200) : errorMessage;
}


app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], credentials: false }));
app.use(express.static('../frontend'));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeJobs,
    uptime: process.uptime(),
  });
});

// 메인 다운로드 엔드포인트
app.post('/api/download', async (req, res) => {
  const clientIp = getClientIp(req);
  let downloadedFilePath = null;
  try {
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please wait 1 minute.' });
    }
    if (activeJobs >= CONCURRENT_JOBS) {
      return res.status(429).json({ error: 'SERVER_BUSY', message: 'Server is busy. Please try again later.' });
    }
    activeJobs++;
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      activeJobs--;
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'URL is required' });
    }
    const validation = validateUrl(url);
    if (!validation.valid) {
      activeJobs--;
      return res.status(400).json({ error: 'INVALID_URL', message: validation.error });
    }
    const parsedUrl = validation.url;
    const hostname = parsedUrl.hostname;
    if (!isWhitelistedDomain(hostname)) {
      activeJobs--;
      return res.status(400).json({ error: 'DOMAIN_NOT_SUPPORTED', message: `${hostname} is not supported. Supported domains: ${WHITELISTED_DOMAINS.join(', ')}` });
    }
    console.log(`[DOWNLOAD] Started from ${clientIp}: ${url}`);
    const randomId = generateRandomId();
    // 1. yt-dlp --dump-json으로 메타데이터 가져오기
    const { stdout: metadataJson } = await executeYtDlp([
      url,
      '--dump-json',
      '--no-warnings',
    ], 30000);
    let metadata;
    try {
      metadata = JSON.parse(metadataJson);
    } catch (err) {
      activeJobs--;
      return res.status(400).json({ error: 'INVALID_VIDEO', message: 'Unable to parse video information' });
    }
    // 2. 파일 크기 확인
    const fileSize = metadata.filesize || metadata.filesize_approx || 0;
    if (fileSize > MAX_FILE_SIZE) {
      activeJobs--;
      return res.status(400).json({ error: 'FILE_TOO_LARGE', message: `File size (${Math.round(fileSize / 1024 / 1024)}MB) exceeds 1GB limit` });
    }
      // 3. 파일 다운로드 (항상 mp4로 저장)
    downloadedFilePath = `/tmp/${randomId}.mp4`;
    tempFiles.add(downloadedFilePath);
    await executeYtDlp([
      url,
      '-f', 'bv*+ba/b',
      '-o', downloadedFilePath,
      '--no-warnings',
      '--quiet',
      '--merge-output-format', 'mp4',
    ], DOWNLOAD_TIMEOUT);
    if (!fs.existsSync(downloadedFilePath)) {
      activeJobs--;
      return res.status(500).json({ error: 'DOWNLOAD_FAILED', message: 'Downloaded file not found' });
    }
    // 4. 서버에서 직접 파일 전송
    const filename = `${metadata.title || randomId}.mp4`.substring(0, 100);
    res.download(downloadedFilePath, filename, (err) => {
      setImmediate(() => cleanupTempFile(downloadedFilePath));
      activeJobs--;
      if (err) {
        console.error('[ERROR] File send error:', err);
      } else {
        console.log(`[SUCCESS] File sent: ${filename}`);
      }
    });
  } catch (err) {
    const errorMessage = err.message || 'Unknown error';
    const userMessage = mapYtDlpErrorMessage(errorMessage);
    console.error(`[ERROR] ${errorMessage}`);
    let statusCode = 500;
    let errorCode = 'DOWNLOAD_FAILED';
    if (errorMessage.includes('IP_BLOCKED')) {
      statusCode = 429;
      errorCode = 'IP_BLOCKED';
    } else if (errorMessage.includes('VIDEO_NOT_FOUND')) {
      statusCode = 404;
      errorCode = 'VIDEO_NOT_FOUND';
    } else if (errorMessage.includes('timeout')) {
      statusCode = 504;
      errorCode = 'TIMEOUT';
    }
    activeJobs--;
    res.status(statusCode).json({ error: errorCode, message: userMessage });
    if (downloadedFilePath) setImmediate(() => cleanupTempFile(downloadedFilePath));
  }
});

app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' });
});

app.listen(PORT, () => {
  console.log(`🚀 TAEO Downloader API running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Whitelisted domains: ${WHITELISTED_DOMAINS.join(', ')}`);
  console.log(`⚙️  Max concurrent jobs: ${CONCURRENT_JOBS}`);
  console.log(`🕐 Download timeout: ${DOWNLOAD_TIMEOUT / 1000}s`);
});

process.on('SIGTERM', () => { console.log('[SHUTDOWN] SIGTERM received'); process.exit(0); });
process.on('SIGINT', () => { console.log('[SHUTDOWN] SIGINT received'); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});