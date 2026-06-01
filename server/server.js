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

app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(express.json()); // for parsing application/json

// =================================
// 설정
// =================================
const WHITELISTED_DOMAINS = ['tiktok.com', 'instagram.com', 'youtube.com', 'x.com', 'twitter.com'];
const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1GB
const CONCURRENT_JOBS = 3;
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000; // 5분
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const RATE_LIMIT_MAX = 3; // 1분에 최대 3회

// =================================
// 전역 상태 및 캐시
// =================================
let activeJobs = 0;
const ipRequestMap = new Map(); // IP별 요청 추적
const metadataCache = new Map(); // URL별 메타데이터 캐시 (Pre-fetch용)
const pendingAnalyzes = new Map(); // 현재 진행 중인 분석 작업 (중복 방지)

// 캐시 정리 (메모리 관리: 10분 후 삭제)
function setCache(url, data) {
  metadataCache.set(url, { data, timestamp: Date.now() });
  pendingAnalyzes.delete(url);
  setTimeout(() => {
    const cached = metadataCache.get(url);
    if (cached && Date.now() - cached.timestamp >= 10 * 60 * 1000) {
      metadataCache.delete(url);
    }
  }, 10 * 60 * 1000);
}

// =================================
// 플랫폼별 독립 설정 (폰재생+속도개선3 기반)
// =================================
const PLATFORM_CONFIGS = {
  youtube: {
    domains: ['youtube.com', 'youtu.be'],
    // [사용자 불패 공식 복구] 에러 방지를 위해 기존 설정을 100% 유지
    format: 'bv+ba/b',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    referer: 'https://www.youtube.com/',
    useProxy: true, // 봇 차단을 피하기 위해 프록시 필수 사용
    extraArgs: [
      '--extractor-args', 'youtube:player_client=android,web',
      '--force-ipv4',
      '--no-playlist',
      '--no-check-certificates'
    ]
  },
  tiktok: {
    domains: ['tiktok.com'],
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/',
    useProxy: true,
    extraArgs: ['--no-playlist']
  },
  instagram: {
    domains: ['instagram.com'],
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.google.com/',
    useProxy: true,
    extraArgs: ['--no-playlist']
  },
  twitter: {
    domains: ['x.com', 'twitter.com'],
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://x.com/',
    useProxy: true,
    extraArgs: ['--no-playlist']
  }
};

// =================================
// 유틸리티 함수
// =================================
function generateRandomId() {
  return crypto.randomBytes(8).toString('hex');
}

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

function executeYtDlp(args, config = null, timeout = DOWNLOAD_TIMEOUT) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const ytdlpArgs = [...args];
    
    // 기본 공통 인자 추가
    ytdlpArgs.push('--no-warnings', '--geo-bypass');

    if (config) {
      if (config.userAgent) ytdlpArgs.push('--user-agent', config.userAgent);
      if (config.referer) ytdlpArgs.push('--referer', config.referer);
      if (config.extraArgs) ytdlpArgs.push(...config.extraArgs);
    }
    
    const cookiesPath = process.env.YTDLP_COOKIES || '/home/opc/cookies.txt';
    if (fs.existsSync(cookiesPath)) {
      ytdlpArgs.push('--cookies', cookiesPath);
    }
    
    // 플랫폼 설정에 따라 프록시 사용 여부 결정 (유튜브는 제외 가능)
    if (process.env.YTDLP_PROXY && (!config || config.useProxy !== false)) {
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

function mapYtDlpErrorMessage(errorMessage) {
  if (!errorMessage) return '다운로드에 실패했습니다. URL을 확인해 주세요.';
  if (errorMessage.includes('There is no video in this post')) {
    return '해당 Instagram 게시물에 동영상이 없습니다. 올바른 동영상 URL을 입력해 주세요.';
  }
  if (errorMessage.includes('You need to log in')) {
    return 'Instagram 스토리 또는 비공개 콘텐츠는 다운로드할 수 없습니다.';
  }
  if (errorMessage.includes('Sign in to confirm you’re not a bot') || errorMessage.includes('Sign in to confirm you are not a bot')) {
    return 'YouTube에서 자동화 트래픽을 감지하여 다운로드가 차단되었습니다. 잠시 후 다시 시도하거나, 데스크탑 환경에서 시도해 주세요.';
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

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], credentials: false })); // CORS 설정

// 광고 및 사이트 인증 파일들을 위한 루트 경로 허용 (sw.js 등)
app.get(['/sw.js', '/verification.txt', '/verification.html'], (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, req.path.split('/').pop()));
});

// 정적 파일 서빙
app.use(express.static(FRONTEND_PATH));

// 다국어 서브경로에서 새로고침 시에도 index.html을 서빙하도록 설정
app.get(['/en', '/ko', '/ja'], (req, res) => {
  res.sendFile('index.html', { root: FRONTEND_PATH });
});

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

// [속도 최적화] 메타데이터 미리 분석 (Pre-fetch)
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).end();

  const validation = validateUrl(url);
  if (!validation.valid) return res.status(400).end();
  
  const config = getPlatformConfig(url);
  if (!config) return res.status(400).end();

  // 이미 캐시가 있거나 분석 중이면 즉시 응답
  if (metadataCache.has(url)) return res.json({ status: 'cached' });
  if (pendingAnalyzes.has(url)) return res.json({ status: 'pending' });

  const analysisPromise = (async () => {
    try {
      console.log(`[PRE-FETCH] Analyzing: ${url}`);
      const { stdout: metadataJson } = await executeYtDlp([url, '--dump-json'], config, 60000);
      const metadata = JSON.parse(metadataJson);
      setCache(url, metadata);
      console.log(`[PRE-FETCH DONE] Cached: ${url}`);
      return metadata;
    } catch (err) {
      console.error(`[PRE-FETCH ERR] ${err.message}`);
      pendingAnalyzes.delete(url);
      throw err;
    }
  })();

  pendingAnalyzes.set(url, analysisPromise);
  res.json({ status: 'started' });
});

// 메인 다운로드 엔드포인트
app.post('/api/download', async (req, res) => {
  const clientIp = getClientIp(req);
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
    
    const config = getPlatformConfig(url);
    if (!config) {
      activeJobs--;
      return res.status(400).json({ error: 'DOMAIN_NOT_SUPPORTED', message: 'Unsupported domain' });
    }

    console.log(`[DOWNLOAD] Started from ${clientIp}: ${url}`);
    const randomId = generateRandomId();
    
    // 1. 메타데이터 가져오기 (캐시 확인 -> 분석 중인지 확인 -> 새로 분석)
    let metadata;
    const cached = metadataCache.get(url);
    const pending = pendingAnalyzes.get(url);
    
    if (cached) {
      console.log(`[CACHE-HIT] Using pre-fetched metadata for: ${url}`);
      metadata = cached.data;
    } else if (pending) {
      console.log(`[CACHE-WAIT] Waiting for in-progress pre-fetch: ${url}`);
      try {
        metadata = await pending;
      } catch (err) {
        activeJobs--;
        return res.status(400).json({ error: 'INVALID_VIDEO', message: 'Metadata analysis failed' });
      }
    } else {
      console.log(`[CACHE-MISS] Analyzing metadata on the fly: ${url}`);
      try {
        const { stdout: metadataJson } = await executeYtDlp([url, '--dump-json'], config, 45000);
        metadata = JSON.parse(metadataJson);
      } catch (err) {
        activeJobs--;
        return res.status(400).json({ error: 'INVALID_VIDEO', message: 'Unable to parse video information' });
      }
    }

    // 2. 파일 크기 확인
    const fileSize = metadata.filesize || metadata.filesize_approx || 0;
    if (fileSize > MAX_FILE_SIZE) {
      activeJobs--;
      return res.status(400).json({ error: 'FILE_TOO_LARGE', message: `File size (${Math.round(fileSize / 1024 / 1024)}MB) exceeds 1GB limit` });
    }

    // 3. 스트리밍 헤더 설정
    const filename = (metadata.title || randomId).replace(/[\\/:*?"<>|]/g, "").substring(0, 80);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}.mp4"; filename*=UTF-8''${encodeURIComponent(filename)}.mp4`);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 4. yt-dlp 실행
    const ytdlpArgs = [
      url,
      '-f', config.format,
      '-o', '-',
      '--no-part',
      '--merge-output-format', 'mp4',
      '--postprocessor-args', 'ffmpeg:-movflags frag_keyframe+empty_moov'
    ];

    // [추가] aria2c 가속기 사용
    ytdlpArgs.push('--downloader', 'aria2c', '--downloader-args', 'aria2c:-x 16 -s 16 -k 1M');

    // config 설정을 ytdlpArgs에 직접 추가
    if (config.userAgent) ytdlpArgs.push('--user-agent', config.userAgent);
    if (config.referer) ytdlpArgs.push('--referer', config.referer);
    if (config.extraArgs) ytdlpArgs.push(...config.extraArgs);

    const cookiesPath = process.env.YTDLP_COOKIES || '/home/opc/cookies.txt';
    if (fs.existsSync(cookiesPath)) {
      ytdlpArgs.push('--cookies', cookiesPath);
    }

    if (process.env.YTDLP_PROXY && config.useProxy !== false) {
      ytdlpArgs.push('--proxy', process.env.YTDLP_PROXY);
    }

    console.log("[YT-DLP CMD]", ytdlpArgs.join(" "));

    const downloadProc = spawn('yt-dlp', ytdlpArgs);
    downloadProc.stdout.pipe(res);

    downloadProc.stderr.on('data', (data) => {
      console.error(`[STREAM-ERR] ${data.toString()}`);
    });

    downloadProc.on('close', (code) => {
      activeJobs--;
      console.log(`[STREAM-END] Finished: ${filename} with code ${code}`);
    });

    // 클라이언트가 연결을 끊으면 프로세스 종료
    req.on('close', () => {
      if (downloadProc) downloadProc.kill();
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
