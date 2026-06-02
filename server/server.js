import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { URL, fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// [성능 최적화] 노드 처리 능력 확장
process.env.UV_THREADPOOL_SIZE = '64';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const FRONTEND_PATH = path.join(__dirname, '../frontend');

// [성능 최적화] RAM 디스크 사용 (HDD 병목 제거)
const TEMP_DIR = '/dev/shm/taeo_downloads';
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// [보안/안정성] 임시 파일 강제 청소기 (Double-Safety)
// 전송 완료 후 삭제 로직이 실패하거나 비정상 종료된 경우를 대비해 1분마다 5분 이상 된 파일 청소
setInterval(() => {
  fs.readdir(TEMP_DIR, (err, files) => {
    if (err) return;
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (!err && now - stats.mtimeMs > 5 * 60 * 1000) {
          fs.unlink(filePath, () => console.log(`[CLEANUP] Deleted old temp file: ${file}`));
        }
      });
    });
  });
}, 60 * 1000);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// =================================
// 설정
// =================================
const WHITELISTED_DOMAINS = ['tiktok.com', 'instagram.com', 'youtube.com', 'x.com', 'twitter.com', 'youtu.be', 'douyin.com', 'iesdouyin.com'];
const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1GB
const CONCURRENT_JOBS = 5;
const DOWNLOAD_TIMEOUT = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;

// =================================
// 전역 상태 및 캐시
// =================================
let activeJobs = 0;
const ipRequestMap = new Map();
const metadataCache = new Map();
const pendingAnalyzes = new Map();
const jobProgress = new Map();

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
// 플랫폼별 독립 설정
// =================================
const PLATFORM_CONFIGS = {
  youtube: {
    domains: ['youtube.com', 'youtu.be'],
    format: 'bv+ba/b',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    referer: 'https://www.youtube.com/',
    useProxy: true,
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
  douyin: {
    domains: ['douyin.com', 'iesdouyin.com'],
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    referer: 'https://www.douyin.com/',
    useProxy: true,
    extraArgs: ['--no-playlist']
  },
  instagram: {
    domains: ['instagram.com'],
    // [최적화] 인스타그램은 단일 'best' 포맷이 병합 오류 없이 가장 안정적임
    format: 'best',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    referer: 'https://www.instagram.com/',
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
  if (!ipRequestMap.has(ip)) ipRequestMap.set(ip, []);
  const timestamps = ipRequestMap.get(ip);
  const recentRequests = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recentRequests.length >= RATE_LIMIT_MAX) return false;
  recentRequests.push(now);
  ipRequestMap.set(ip, recentRequests);
  return true;
}

function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    return { valid: ['http:', 'https:'].includes(url.protocol), url };
  } catch (err) {
    return { valid: false };
  }
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

async function executeYtDlp(args, config = null, timeout = DOWNLOAD_TIMEOUT, jobId = null) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const ytdlpArgs = [...args, '--no-warnings', '--geo-bypass'];

    if (config) {
      if (config.userAgent) ytdlpArgs.push('--user-agent', config.userAgent);
      if (config.referer) ytdlpArgs.push('--referer', config.referer);
      if (config.extraArgs) ytdlpArgs.push(...config.extraArgs);
    }
    
    const cookiesPath = process.env.YTDLP_COOKIES || '/home/opc/cookies.txt';
    if (fs.existsSync(cookiesPath)) ytdlpArgs.push('--cookies', cookiesPath);
    
    if (process.env.YTDLP_PROXY && (!config || config.useProxy !== false)) {
      ytdlpArgs.push('--proxy', process.env.YTDLP_PROXY);
    }

    const proc = spawn('yt-dlp', ytdlpArgs, { timeout });
    
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      if (jobId) {
        const match = output.match(/(\d+\.?\d*)%/);
        if (match) jobProgress.set(jobId, parseFloat(match[1]));
      }
    });

    proc.stderr.on('data', (data) => stderr += data.toString());
    proc.on('close', (code) => {
      if (jobId) jobProgress.set(jobId, 100);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.substring(0, 200) || `Exit code ${code}`));
    });
    proc.on('error', (err) => reject(new Error(`Spawn error: ${err.message}`)));
  });
}

function mapYtDlpErrorMessage(errorMessage) {
  if (errorMessage.includes('Sign in to confirm you’re not a bot')) return '유튜브 봇 차단 발생. 잠시 후 다시 시도해 주세요.';
  if (errorMessage.includes('video not found')) return '영상을 찾을 수 없습니다. URL을 확인해 주세요.';
  if (errorMessage.includes('Unsupported URL')) return '지원하지 않는 URL 형식입니다. 영상 상세 주소를 입력해 주세요.';
  return '다운로드 실패. 다시 시도해 주세요.';
}

// =================================
// i18n SEO Injection Logic
// =================================
const SEO_TRANSLATIONS = {
  en: {
    title: "TAEO - Best TikTok, Instagram, YouTube & X Video Downloader",
    description: "Download TikTok, Instagram, YouTube, and X (Twitter) videos instantly without watermark. Fastest and free tool."
  },
  ko: {
    title: "TAEO - 최고의 틱톡, 인스타그램, 유튜브, X 영상 다운로더",
    description: "워터마크 없는 틱톡, 인스타, 유튜브, X(트위터) 영상을 즉시 다운로드하세요. 가장 빠르고 무료인 도구입니다."
  },
  ja: {
    title: "TAEO - TikTok, Instagram, YouTube, X 動画ダウンロード保存",
    description: "TikTok、Instagram、YouTube、X(Twitter)の動画を即座にダウンロード。ウォーターマークなし、完全無料의 最強ツール."
  }
};

function serveI18nIndex(req, res) {
  const lang = req.path.substring(1) || 'ko';
  const t = SEO_TRANSLATIONS[lang] || SEO_TRANSLATIONS['ko'];
  
  fs.readFile(path.join(FRONTEND_PATH, 'index.html'), 'utf8', (err, html) => {
    if (err) return res.status(500).send('Internal Server Error');
    
    let injectedHtml = html
      .replace('<html lang="ko">', `<html lang="${lang}">`)
      .replace(/<title>.*?<\/title>/, `<title>${t.title}</title>`)
      .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${t.description}">`)
      // Open Graph
      .replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${t.title}">`)
      .replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${t.description}">`)
      // Twitter
      .replace(/<meta property="twitter:title" content=".*?">/, `<meta property="twitter:title" content="${t.title}">`)
      .replace(/<meta property="twitter:description" content=".*?">/, `<meta property="twitter:description" content="${t.description}">`);
    
    res.send(injectedHtml);
  });
}

// =================================
// 라우트
// =================================
app.use(cors());
app.get(['/sw.js', '/verification.txt', '/verification.html'], (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, req.path.split('/').pop()));
});

// [SEO 최적화] 언어별 정적 HTML 서빙
app.get(['/en', '/ko', '/ja'], serveI18nIndex);
app.get('/', (req, res) => res.redirect('/ko/'));

app.use(express.static(FRONTEND_PATH));
app.get('/api/health', (req, res) => res.json({ status: 'ok', activeJobs }));

app.get('/api/progress/:id', (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(() => {
    const progress = jobProgress.get(id) || 0;
    res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    if (progress >= 100) {
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on('close', () => clearInterval(interval));
});

app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).end();
  const validation = validateUrl(url);
  if (!validation.valid) return res.status(400).end();
  const config = getPlatformConfig(url);
  if (!config) return res.status(400).end();

  if (metadataCache.has(url)) return res.json({ status: 'cached' });
  if (pendingAnalyzes.has(url)) return res.json({ status: 'pending' });

  const analysisPromise = (async () => {
    try {
      console.log(`[PRE-FETCH] Analyzing: ${url}`);
      const { stdout: metadataJson } = await executeYtDlp([url, '--dump-json'], config, 60000);
      const metadata = JSON.parse(metadataJson);
      setCache(url, metadata);
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

app.post('/api/download', async (req, res) => {
  const clientIp = getClientIp(req);
  const { url, progressId: clientProgressId } = req.body;
  if (!url) return res.status(400).json({ error: 'URL_REQUIRED' });

  if (!checkRateLimit(clientIp)) return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  if (activeJobs >= CONCURRENT_JOBS) return res.status(429).json({ error: 'SERVER_BUSY' });

  const config = getPlatformConfig(url);
  if (!config) return res.status(400).json({ error: 'UNSUPPORTED_DOMAIN' });

  activeJobs++;
  const randomId = generateRandomId();
  const tempFilePath = path.join(TEMP_DIR, `${randomId}.mp4`);
  
  // 프론트엔드에서 전달받은 ID가 있으면 사용, 없으면 직접 생성
  let progressId = clientProgressId || crypto.createHash('sha256').update(url).digest('hex').substring(0, 32);
  
  try {
    let metadata;
    const cached = metadataCache.get(url);
    const pending = pendingAnalyzes.get(url);
    
    if (cached) metadata = cached.data;
    else if (pending) metadata = await pending;
    else {
      const { stdout: metadataJson } = await executeYtDlp([url, '--dump-json'], config, 45000);
      metadata = JSON.parse(metadataJson);
    }

    if ((metadata.filesize || metadata.filesize_approx || 0) > MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }

    // [성능 극대화] aria2c 대신 yt-dlp 자체 멀티 스레딩 기능 사용 (프록시 완벽 지원)
    console.log(`[ULTRA-ACCEL] ${metadata.title} -> RAM Disk`);
    const downloadArgs = [
      url,
      '-f', config.format,
      '-o', tempFilePath,
      '--no-part',
      '--merge-output-format', 'mp4',
      '--postprocessor-args', 'ffmpeg:-movflags frag_keyframe+empty_moov',
      '--concurrent-fragments', '16' // 16분할 병렬 다운로드 (aria2c급 속도)
    ];
    
    jobProgress.set(progressId, 0);
    await executeYtDlp(downloadArgs, config, DOWNLOAD_TIMEOUT, progressId);

    const cleanTitle = (metadata.title || randomId).replace(/[\\/:*?"<>|]/g, "").substring(0, 80);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanTitle)}.mp4"; filename*=UTF-8''${encodeURIComponent(cleanTitle)}.mp4`);
    res.setHeader('X-Accel-Buffering', 'no');
    
    const fileStream = fs.createReadStream(tempFilePath, { highWaterMark: 128 * 1024 });
    fileStream.pipe(res);

    fileStream.on('end', () => {
      console.log(`[ULTRA-DONE] ${cleanTitle}`);
      fs.unlink(tempFilePath, () => {});
      jobProgress.delete(progressId);
      activeJobs--;
    });

    res.on('close', () => {
      fileStream.destroy();
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
      jobProgress.delete(progressId);
    });

  } catch (err) {
    console.error(`[DL-ERR] ${err.message}`);
    activeJobs--;
    jobProgress.delete(progressId);
    if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    if (!res.headersSent) res.status(500).json({ error: 'FAILED', message: mapYtDlpErrorMessage(err.message) });
  }
});

app.listen(PORT, () => console.log(`🚀 TAEO Ultra-Fast Server on port ${PORT}`));

process.on('uncaughtException', (err) => console.error('[UNCAUGHT]', err));
process.on('unhandledRejection', (err) => console.error('[UNHANDLED REJECTION]', err));
