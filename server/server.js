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
const PORT = process.env.PORT || 3000;
const FRONTEND_PATH = path.join(__dirname, '../frontend');
// 운영 서버(Linux)의 RAM Disk(/dev/shm)를 우선 사용하되, 권한이 없거나 없는 환경(macOS 등)에서는 로컬 temp 사용
const DEFAULT_TEMP = fs.existsSync('/dev/shm') ? '/dev/shm' : path.join(__dirname, 'temp');
const TEMP_DIR = process.env.TEMP_DIR || DEFAULT_TEMP; 

// 설정
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const DOWNLOAD_TIMEOUT = 300000; // 5분으로 연장
const CONCURRENT_JOBS = 5;

// 상태 관리
let activeJobs = 0;
const jobProgress = new Map();
const metadataCache = new Map();
const pendingAnalyzes = new Map();
const ipRequestMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 10;

app.use(express.json());
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// 캐시 청소 (1시간마다)
setInterval(() => {
  const now = Date.now();
  for (const [url, entry] of metadataCache.entries()) {
    if (now - entry.timestamp > 3600000) metadataCache.delete(url);
  }
}, 3600000);

function setCache(url, data) {
  metadataCache.set(url, { data, timestamp: Date.now() });
}

// 플랫폼별 독립 설정
// =================================
const PLATFORM_CONFIGS = {
  youtube: {
    domains: ['youtube.com', 'youtu.be'],
    format: 'bv+ba/b', // 고화질 복구
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    referer: 'https://www.youtube.com/',
    useProxy: true,
    useCookies: true,
    extraArgs: [
      '--extractor-args', 'youtube:player_client=android,ios,web;pot_provider=getpot;getpot_bgutil_http_url=http://localhost:8090/get_pot',
      '--force-ipv4',
      '--no-playlist',
      '--no-check-certificates',
      '--concurrent-fragments', '8' // 속도와 안정성의 균형
    ]
  },
  tiktok: {
    domains: ['tiktok.com'],
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    useProxy: true,
    useCookies: false,
    extraArgs: [
      '--no-playlist',
      '--impersonate', 'chrome'
    ]
  },
  douyin: {
    domains: ["douyin.com", "iesdouyin.com"],
    format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    useProxy: false,
    extraArgs: [
      "--no-playlist",
      "--impersonate", "chrome",
      "--add-header", "Referer: https://www.douyin.com/",
      "--add-header", "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8",
      "--extractor-args", "douyin:no-watermark=true;app_id=1128"
    ]
  },
  instagram: {
    domains: ['instagram.com'],
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
    useProxy: false,
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

function normalizeUrl(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes('douyin.com')) {
      const modalId = url.searchParams.get('modal_id');
      if (modalId) return `https://www.douyin.com/video/${modalId}`;
    }
    return urlString;
  } catch (err) {
    return urlString;
  }
}

function validateUrl(urlString) {
  try {
    const normalized = normalizeUrl(urlString);
    const url = new URL(normalized);
    return { valid: ['http:', 'https:'].includes(url.protocol), url, normalized };
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

async function executeYtDlp(args, config, timeout, jobId = null) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const ytdlpArgs = [...args, '--no-warnings', '--geo-bypass'];

    if (config) {
      if (config.userAgent) ytdlpArgs.push('--user-agent', config.userAgent);
      if (config.referer) ytdlpArgs.push('--referer', config.referer);
      if (config.extraArgs) ytdlpArgs.push(...config.extraArgs);
    }
    
    if (config && config.useCookies !== false) {
      const cookiesPath = process.env.YTDLP_COOKIES || '/home/opc/cookies.txt';
      if (fs.existsSync(cookiesPath)) ytdlpArgs.push('--cookies', cookiesPath);
    }
    
    if (process.env.YTDLP_PROXY && config && config.useProxy === true) {
      ytdlpArgs.push('--proxy', process.env.YTDLP_PROXY);
    }

    const env = { 
      ...process.env, 
      YTDLP_PLUGINS_PATH: '/home/opc/.yt-dlp/plugins',
      PYTHONPATH: '/home/opc/.yt-dlp/plugins'
    };

    const venvYtDlp = '/var/www/app/server/.venv/bin/yt-dlp';
    const YT_DLP_BINARY = fs.existsSync(venvYtDlp) ? venvYtDlp : 'yt-dlp';

    const proc = spawn(YT_DLP_BINARY, ytdlpArgs, { timeout, env });
    
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
  if (errorMessage.includes('Sign in to confirm you’re not a bot')) return 'ERR_BOT_BLOCKED';
  if (errorMessage.includes('video not found')) return 'ERR_VIDEO_NOT_FOUND';
  if (errorMessage.includes('Unsupported URL')) {
    if (errorMessage.includes('tiktok.com/search')) return 'ERR_TIKTOK_SEARCH';
    return 'ERR_UNSUPPORTED_URL';
  }
  if (errorMessage.includes('Unable to extract universal data') || 
      errorMessage.includes('Unexpected response from webpage') ||
      errorMessage.includes('Fresh cookies')
  ) {
    return 'ERR_EXTRACT_FAILED';
  }
  return 'ERR_DOWNLOAD_FAILED';
}

// =================================
// i18n SEO Injection Logic
// =================================
const SUPPORTED_LANGS = ['ko', 'en', 'ja', 'id', 'pt', 'es', 'vi', 'ru', 'hi', 'de'];
const PLATFORM_MAP = {
  'youtube-downloader': 'youtube',
  'tiktok-downloader': 'tiktok',
  'instagram-downloader': 'instagram',
  'twitter-downloader': 'x',
  'x-downloader': 'x'
};

const SEO_TRANSLATIONS = {
  ko: {
    home: { title: "TEO - 최고의 틱톡, 도우인, 인스타, 유튜브, X 영상 다운로더", description: "워터마크 없는 틱톡, 도우인, 인스타, 유튜브 영상을 즉시 다운로드하는 가장 빠른 무료 도구입니다." },
    youtube: { title: "TEO - 유튜브 영상 다운로더 | 고화질 MP4 저장", description: "유튜브 영상을 워터마크 없이 고화질로 다운로드하세요. TEO는 가장 빠르고 안전한 유튜브 저장 도구입니다." },
    tiktok: { title: "TEO - 틱톡 & 도우인 워터마크 제거 다운로더", description: "틱톡과 도우인 영상을 워터마크 없이 저장하세요. 틱톡 영상 다운로드의 가장 쉬운 방법, TEO입니다." },
    instagram: { title: "TEO - 인스타그램 영상 및 릴스 다운로더", description: "인스타그램 릴스, 비디오, 스토리를 워터마크 없이 고화질로 저장하세요. 쉽고 빠른 인스타 다운로더." },
    x: { title: "TEO - X (트위터) 영상 다운로더 | 고화질 트위터 저장", description: "X(트위터) 영상을 즉시 고화질 MP4로 다운로드하세요. 워터마크 없는 트위터 영상 저장 도구." }
  },
  en: {
    home: { title: "TEO - Best TikTok, Douyin, Instagram, YouTube & X Video Downloader", description: "Download TikTok, Douyin, Instagram, YouTube, and X videos without watermark instantly. Fastest free video downloader." },
    youtube: { title: "TEO - YouTube Video Downloader | Download High Quality MP4", description: "Download YouTube videos in high quality MP4. TEO is the fastest and safest tool to save YouTube videos for free." },
    tiktok: { title: "TEO - TikTok & Douyin Downloader | No Watermark", description: "Download TikTok and Douyin videos without watermark. The easiest way to save TikTok videos online with TEO." },
    instagram: { title: "TEO - Instagram Video & Reels Downloader", description: "Download Instagram Reels, videos, and stories in high quality without watermark. Fast and free Instagram downloader." },
    x: { title: "TEO - X (Twitter) Video Downloader | Save Twitter Videos", description: "Download X (Twitter) videos instantly in high quality MP4. Best tool to save Twitter videos without watermark." }
  },
  ja: {
    home: { title: "TEO - TikTok, Douyin, Instagram, YouTube, X 動画ダウンロード", description: "TikTok、Douyin(抖音)、Instagram、YouTube、Xの動画を即座에 다운로드. 워터마크 없이, 완전 무료의 최강 툴." },
    youtube: { title: "TEO - YouTube 動画保存・ダウンロード | 高画質 MP4", description: "YouTube動画をウォーターマークなしで高画質保存。TEOは最속으로 안전한 YouTube 저장 도구입니다." },
    tiktok: { title: "TEO - TikTok & Douyin 保存 | ウォーターマークなし", description: "TikTokやDouyinの動画をロゴなしで保存。TikTok動画保存の最も簡単な方法はTEO입니다." },
    instagram: { title: "TEO - Instagram 動画 & リール 保存", description: "Instagramのリール、動画、ストーリーをロゴなし高画질로 저장. 素早く簡単なインスタ保存ツール." },
    x: { title: "TEO - X (Twitter) 動画保存・ダウンロード", description: "X(Twitter)의 영상을 고화질로 즉시 저장. 워터마크 없는 트위터 영상 저장 도구." }
  },
  id: {
    home: { title: "TEO - Pengunduh Video TikTok, Douyin, Instagram, YouTube & X Terbaik", description: "Unduh video TikTok, Douyin, Instagram, YouTube, dan X tanpa watermark secara instan. Pengunduh video gratis tercepat." },
    youtube: { title: "TEO - Pengunduh Video YouTube | Simpan MP4 Kualitas Tinggi", description: "Unduh video YouTube dalam MP4 kualitas tinggi. TEO adalah alat tercepat dan teraman untuk menyimpan video YouTube secara gratis." },
    tiktok: { title: "TEO - Pengunduh TikTok & Douyin | Tanpa Watermark", description: "Unduh video TikTok dan Douyin tanpa watermark. Cara termudah untuk menyimpan video TikTok online dengan TEO." },
    instagram: { title: "TEO - Pengunduh Video & Reels Instagram", description: "Unduh Instagram Reels, video, dan cerita dalam kualitas tinggi tanpa watermark. Pengunduh Instagram yang cepat dan gratis." },
    x: { title: "TEO - Pengunduh Video X (Twitter) | Simpan Video Twitter", description: "Unduh video X (Twitter) secara instan dalam MP4 kualitas tinggi. Alat terbaik untuk menyimpan video Twitter tanpa watermark." }
  },
  pt: {
    home: { title: "TEO - Melhor Downloader de Vídeo para TikTok, Douyin, Instagram, YouTube e X", description: "Baixe vídeos do TikTok, Douyin, Instagram, YouTube e X sem marca d'água instantaneamente. O downloader de vídeo gratuito mais rápido." },
    youtube: { title: "TEO - Downloader de Vídeo do YouTube | Salvar MP4 de Alta Qualidade", description: "Baixe vídeos do YouTube em MP4 de alta qualidade. TEO é a ferramenta mais rápida e segura para salvar vídeos do YouTube gratuitamente." },
    tiktok: { title: "TEO - Downloader do TikTok e Douyin | Sem Marca d'Água", description: "Baixe vídeos do TikTok e Douyin sem marca d'água. A maneira mais fácil de salvar vídeos do TikTok online com o TEO." },
    instagram: { title: "TEO - Downloader de Vídeos e Reels do Instagram", description: "Baixe Reels, vídeos e stories do Instagram em alta qualidade sem marca d'água. Downloader do Instagram rápido e gratuito." },
    x: { title: "TEO - Downloader de Vídeo do X (Twitter) | Salvar Vídeos do Twitter", description: "Baixe vídeos do X (Twitter) instantaneamente em MP4 de alta qualidade. A melhor ferramenta para salvar vídeos do Twitter sem marca d'água." }
  },
  es: {
    home: { title: "TEO - El mejor descargador de videos de TikTok, Douyin, Instagram, YouTube y X", description: "Descarga videos de TikTok, Douyin, Instagram, YouTube y X sin marca de agua al instante. El descargador de videos gratuito más rápido." },
    youtube: { title: "TEO - Descargador de videos de YouTube | Guardar MP4 de alta calidad", description: "Descarga videos de YouTube en MP4 de alta calidad. TEO es la herramienta más rápida y segura para guardar videos de YouTube gratis." },
    tiktok: { title: "TEO - Descargador de TikTok y Douyin | Sin marca de agua", description: "Descarga videos de TikTok y Douyin sin marca de agua. La forma más fácil de guardar videos de TikTok en línea con TEO." },
    instagram: { title: "TEO - Descargador de videos y Reels de Instagram", description: "Descarga Instagram Reels, videos e historias en alta calidad sin marca de agua. Descargador de Instagram rápido y gratuito." },
    x: { title: "TEO - Descargador de videos de X (Twitter) | Guardar videos de Twitter", description: "Descarga videos de X (Twitter) al instante en MP4 de alta calidad. La mejor herramienta para guardar videos de Twitter sin marca de agua." }
  },
  vi: {
    home: { title: "TEO - Trình tải video TikTok, Douyin, Instagram, YouTube & X tốt nhất", description: "Tải video TikTok, Douyin, Instagram, YouTube và X không có logo ngay lập tức. Trình tải video miễn phí nhanh nhất." },
    youtube: { title: "TEO - Trình tải video YouTube | Lưu MP4 chất lượng cao", description: "Tải video YouTube ở định dạng MP4 chất lượng cao. TEO là công cụ nhanh nhất và an toàn nhất để lưu video YouTube miễn phí." },
    tiktok: { title: "TEO - Trình tải TikTok & Douyin | Không có logo", description: "Tải video TikTok và Douyin không có logo. Cách dễ nhất để lưu video TikTok trực tuyến với TEO." },
    instagram: { title: "TEO - Trình tải video & Reels Instagram", description: "Tải Instagram Reels, video và tin câu chuyện ở chất lượng cao không có logo. Trình tải Instagram nhanh và miễn phí." },
    x: { title: "TEO - Trình tải video X (Twitter) | Lưu video Twitter", description: "Tải video X (Twitter) ngay lập tức ở định dạng MP4 chất lượng cao. Công cụ tốt nhất để lưu video Twitter không có logo." }
  },
  ru: {
    home: { title: "TEO - Лучший загрузчик видео из TikTok, Douyin, Instagram, YouTube и X", description: "Скачивайте видео из TikTok, Douyin, Instagram, YouTube и X без водяных знаков мгновенно. Самый быстрый бесплатный загрузчик видео." },
    youtube: { title: "TEO - Загрузчик видео с YouTube | Скачать MP4 в высоком качестве", description: "Скачивайте видео с YouTube в высоком качестве MP4. TEO — самый быстрый и безопасный инструмент для бесплатного сохранения видео с YouTube." },
    tiktok: { title: "TEO - Загрузчик из TikTok и Douyin | Без водяных знаков", description: "Скачивайте видео из TikTok и Douyin без водяных знаков. Самый простой способ сохранить видео из TikTok онлайн с помощью TEO." },
    instagram: { title: "TEO - Загрузчик видео и Reels из Instagram", description: "Скачивайте Reels, видео и истории из Instagram в высоком качестве без водяных знаков. Быстрый и бесплатный загрузчик из Instagram." },
    x: { title: "TEO - Загрузчик видео из X (Twitter) | Сохранить видео из Twitter", description: "Скачивайте видео из X (Twitter) мгновенно в высоком качестве MP4. Лучший инструмент для сохранения видео из Twitter без водяных знаков." }
  },
  hi: {
    home: { title: "TEO - सर्वश्रेष्ठ TikTok, Douyin, Instagram, YouTube और X वीडियो डाउनलोडर", description: "TikTok, Douyin, Instagram, YouTube और X वीडियो बिना वॉटरmark के तुरंत 다운로드 करें। सबसे तेज़ मुफ़्त वीडियो डाउनलोडर।" },
    youtube: { title: "TEO - YouTube वीडियो डाउनलोडर | उच्च गुणवत्ता MP4 सहेजें", description: "उच्च गुणवत्ता वाले MP4 में YouTube वीडियो डाउनलोड करें। TEO YouTube वीडियो को मुफ्त में सहेजने का सबसे तेज़ और सुरक्षित उपकरण है।" },
    tiktok: { title: "TEO - TikTok और Douyin डाउनलोडर | बिना वॉटरमार्क के", description: "बिना वॉटरमार्क के TikTok और Douyin वीडियो डाउनलोड करें। TEO के साथ TikTok वीडियो को ऑनलाइन सहेजने का सबसे आसान तरीका।" },
    instagram: { title: "TEO - Instagram वीडियो और रील्स डाउनलोडer", description: "Instagram रील्स, वीडियो और कहानियों को बिना वॉटरमार्क के उच्च गुणवत्ता में 다운로드 करें। तेज़ और मुफ़्त Instagram 다운로드er." },
    x: { title: "TEO - X (Twitter) वीडियो डाउनलोडर | ट्विटर वीडियो सहेजें", description: "उच्च गुणवत्ता वाले MP4 में तुरंत X (Twitter) 영상 다운로드. 트위터 영상을 워터마크 없이 저장하는 최상의 툴." }
  },
  de: {
    home: { title: "TEO - Bester Video Downloader für TikTok, Douyin, Instagram, YouTube & X", description: "Laden Sie TikTok-, Douyin-, Instagram-, YouTube- und X-Videos sofort ohne Wasserzeichen herunter. Der schnellste kostenlose Video-Downloader." },
    youtube: { title: "TEO - YouTube Video Downloader | Hochwertige MP4 speichern", description: "Laden Sie YouTube-Videos in hochwertigem MP4 herunter. TEO ist das schnellste und sicherste Tool, um YouTube-Videos kostenlos zu speichern." },
    tiktok: { title: "TEO - TikTok & Douyin Downloader | Ohne Wasserzeichen", description: "Laden Sie TikTok- und Douyin-Videos ohne Wasserzeichen herunter. Der einfachste Weg, TikTok-Videos online mit TEO zu speichern." },
    instagram: { title: "TEO - Instagram Video & Reels Downloader", description: "Laden Sie Instagram Reels, Videos und Stories in hoher Qualität ohne Wasserzeichen herunter. Schneller und kostenloser Instagram Downloader." },
    x: { title: "TEO - X (Twitter) Video Downloader | Twitter-Videos speichern", description: "Laden Sie X (Twitter) Videos sofort in hochwertigem MP4 herunter. Das beste Tool zum Speichern von Twitter-Videos ohne Wasserzeichen." }
  }
};

function serveI18nIndex(req, res) {
  const lang = req.params.lang || 'ko';
  const page = req.params.page || 'home';
  const platform = PLATFORM_MAP[page] || 'home';
  const langData = SEO_TRANSLATIONS[lang] || SEO_TRANSLATIONS['ko'];
  const t = langData[platform] || langData['home'];
  
  fs.readFile(path.join(FRONTEND_PATH, 'index.html'), 'utf8', (err, html) => {
    if (err) return res.status(500).send('Internal Server Error');
    const hreflangTags = SUPPORTED_LANGS.map(l => {
      const p = page === 'home' ? `/${l}/` : `/${l}/${page}`;
      return `<link rel="alternate" hreflang="${l}" href="https://teodown.com${p}">`;
    }).join('\n  ');
    const xDefault = `<link rel="alternate" hreflang="x-default" href="https://teodown.com/${page === 'home' ? 'ko/' : 'ko/' + page}">`;

    let injectedHtml = html
      .replace('<html lang="ko">', `<html lang="${lang}">`)
      .replace(/<title>.*?<\/title>/, `<title>${t.title}</title>`)
      .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${t.description}">`)
      .replace(/<link rel="canonical".*?hreflang="en".*?>/s, `<link rel="canonical" href="https://teodown.com${req.path}">\n  ${xDefault}\n  ${hreflangTags}`)
      .replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${t.title}">`)
      .replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${t.description}">`)
      .replace(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="https://teodown.com${req.path}">`)
      .replace(/<meta property="twitter:title" content=".*?">/, `<meta property="twitter:title" content="${t.title}">`)
      .replace(/<meta property="twitter:description" content=".*?">/, `<meta property="twitter:description" content="${t.description}">`)
      .replace(/<meta property="twitter:url" content=".*?">/, `<meta property="twitter:url" content="https://teodown.com${req.path}">`);
    res.send(injectedHtml);
  });
}

app.use(cors());
app.get(['/sw.js', '/verification.txt', '/verification.html'], (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, req.path.split('/').pop()));
});

app.get('/:lang([a-z]{2})/:page?', (req, res, next) => {
  if (SUPPORTED_LANGS.includes(req.params.lang)) return serveI18nIndex(req, res);
  next();
});

app.get(['/:lang([a-z]{2})', '/:lang([a-z]{2})/'], (req, res) => {
  if (SUPPORTED_LANGS.includes(req.params.lang)) return res.redirect(`/${req.params.lang}/`);
  res.status(404).end();
});

app.get('/', (req, res) => res.redirect('/ko/'));
app.use(express.static(FRONTEND_PATH));

app.get('/api/progress/:id', (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const interval = setInterval(() => {
    const progress = jobProgress.get(id) || 0;
    res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    if (progress >= 100) { clearInterval(interval); res.end(); }
  }, 500);
  req.on('close', () => clearInterval(interval));
});

app.post('/api/analyze', async (req, res) => {
  const { url: rawUrl } = req.body;
  if (!rawUrl) return res.status(400).end();
  const validation = validateUrl(rawUrl);
  if (!validation.valid) return res.status(400).end();
  const url = validation.normalized;
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
  const { url: rawUrl, progressId: clientProgressId } = req.body;
  if (!rawUrl) return res.status(400).json({ error: 'URL_REQUIRED' });
  const validation = validateUrl(rawUrl);
  if (!validation.valid) return res.status(400).json({ error: 'INVALID_URL' });
  const url = validation.normalized;
  if (!checkRateLimit(clientIp)) return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  if (activeJobs >= CONCURRENT_JOBS) return res.status(429).json({ error: 'SERVER_BUSY' });
  const config = getPlatformConfig(url);
  if (!config) return res.status(400).json({ error: 'UNSUPPORTED_DOMAIN' });
  activeJobs++;
  const randomId = generateRandomId();
  const tempFilePath = path.join(TEMP_DIR, `${randomId}.mp4`);
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
    if ((metadata.filesize || metadata.filesize_approx || 0) > MAX_FILE_SIZE) throw new Error('FILE_TOO_LARGE');
    console.log(`[ULTRA-ACCEL] ${metadata.title} -> RAM Disk`);
    const downloadArgs = [url, '-f', config.format, '-o', tempFilePath, '--no-part', '--merge-output-format', 'mp4', '--concurrent-fragments', '16'];
    jobProgress.set(progressId, 0);
    await executeYtDlp(downloadArgs, config, DOWNLOAD_TIMEOUT, progressId);
    const cleanTitle = (metadata.title || randomId).replace(/[\\/:*?"<>|]/g, "").substring(0, 80);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanTitle)}.mp4"; filename*=UTF-8''${encodeURIComponent(cleanTitle)}.mp4`);
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

// =================================
// n8n Factory 전용 로컬 다운로드 API
// =================================
app.post('/api/factory/download', async (req, res) => {
  const { url: rawUrl, projectName } = req.body;
  if (!rawUrl) return res.status(400).json({ error: 'URL_REQUIRED' });
  
  const validation = validateUrl(rawUrl);
  if (!validation.valid) return res.status(400).json({ error: 'INVALID_URL' });
  const url = validation.normalized;
  
  const config = getPlatformConfig(url);
  if (!config) return res.status(400).json({ error: 'UNSUPPORTED_DOMAIN' });

  // 저장 경로 설정 (TeoVideoFactory/temp)
  const FACTORY_TEMP_DIR = '/Users/systemi/vibecoding/TeoVideoFactory/temp';
  if (!fs.existsSync(FACTORY_TEMP_DIR)) fs.mkdirSync(FACTORY_TEMP_DIR, { recursive: true });

  const randomId = generateRandomId();
  const timestamp = Date.now();
  const fileName = `factory_${timestamp}_${randomId}.mp4`;
  const localFilePath = path.join(FACTORY_TEMP_DIR, fileName);

  try {
    console.log(`[FACTORY-DL] Starting: ${url}`);
    
    // 1. 메타데이터 추출 (제목 등)
    const { stdout: metadataJson } = await executeYtDlp([url, '--dump-json'], config, 45000);
    const metadata = JSON.parse(metadataJson);

    // 2. 실제 다운로드 (로컬 파일로 저장)
    const downloadArgs = [
      url, 
      '-f', config.format, 
      '-o', localFilePath, 
      '--no-part', 
      '--merge-output-format', 'mp4',
      '--concurrent-fragments', '16'
    ];
    
    await executeYtDlp(downloadArgs, config, DOWNLOAD_TIMEOUT);

    console.log(`[FACTORY-DL] Success: ${localFilePath}`);
    
    res.json({
      status: 'success',
      video_path: localFilePath,
      title: metadata.title,
      duration_ms: (metadata.duration || 0) * 1000,
      filename: fileName
    });

  } catch (err) {
    console.error(`[FACTORY-ERR] ${err.message}`);
    if (fs.existsSync(localFilePath)) fs.unlink(localFilePath, () => {});
    res.status(500).json({ 
      status: 'error', 
      error: 'DOWNLOAD_FAILED', 
      message: mapYtDlpErrorMessage(err.message) 
    });
  }
});

app.listen(PORT, () => console.log(`🚀 TEO Ultra-Fast Server on port ${PORT}`));
process.on('uncaughtException', (err) => console.error('[UNCAUGHT]', err));
process.on('unhandledRejection', (err) => console.error('[UNHANDLED REJECTION]', err));
