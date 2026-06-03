/**
 * TAEO Frontend Logic - Integrated i18n & Ultra-Fast Smooth Progress
 */

const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const loadingUI = document.getElementById('loadingUI');
const errorUI = document.getElementById('errorUI');
const errorMessage = document.getElementById('errorMessage');
const successUI = document.getElementById('successUI');

const SUPPORTED_LANGS = ['ko', 'en', 'ja', 'id', 'pt', 'es', 'vi', 'ru', 'hi', 'de'];
const PLATFORM_MAP = {
  'youtube-downloader': 'youtube',
  'tiktok-downloader': 'tiktok',
  'instagram-downloader': 'instagram',
  'twitter-downloader': 'x',
  'x-downloader': 'x'
};

const TRANSLATIONS = {
  ko: {
    home: {
      meta_title: "TAEO - 최고의 틱톡, 도우인, 인스타그램, 유튜브, X 영상 다운로더",
      meta_description: "워터마크 없는 틱톡, 도우인(Douyin), 인스타, 유튜브, X 영상을 즉시 다운로드하세요. 가장 빠르고 무료인 도구입니다.",
      hero_title: "⚡ TAEO 영상 다운로더",
      hero_subtitle: "틱톡, 도우인, 인스타, 유튜브, X 영상 초고속 다운로드",
      hero_description: "워터마크 없는 도우인 및 소셜 미디어 영상을 즉시 다운로드하는 가장 빠른 무료 도구입니다.",
      input_placeholder: "여기에 영상 링크(틱톡, 도우인, 인스타, 유튜브, X)를 붙여넣으세요...",
      download_btn: "다운로드",
      loading: "영상 분석 중...",
      error_occurred: "오류 발생",
      error_default: "다운로드 처리에 실패했습니다.",
      error_unsupported: "지원하지 않는 URL 형식입니다. 영상 상세 주소를 입력해 주세요.",
      ERR_BOT_BLOCKED: "봇 차단이 발생했습니다. 잠시 후 다시 시도해 주세요.",
      ERR_VIDEO_NOT_FOUND: "영상을 찾을 수 없습니다. URL을 확인해 주세요.",
      ERR_TIKTOK_SEARCH: "틱톡 검색 결과 페이지는 지원하지 않습니다. 개별 영상 링크를 입력해 주세요.",
      ERR_UNSUPPORTED_URL: "지원하지 않는 URL 형식입니다.",
      ERR_EXTRACT_FAILED: "데이터 추출에 실패했습니다. 최신 영상이거나 일시적 제한일 수 있습니다.",
      ERR_DOWNLOAD_FAILED: "다운로드에 실패했습니다. 다시 시도해 주세요.",
      retry_btn: "다시 시도",
      success_title: "✅ 요청 완료",
      download_another: "추가 다운로드",
      started: "처리가 시작되었습니다! 곧 다운로드가 진행됩니다.",
      save_log: "저장 위치 선택 창이 나타날 때까지 최대 20초 정도 소요될 수 있습니다. 창이 뜰 때까지 잠시만 기다려 주세요.",
      complete_dialog: "완료! 저장 창을 여는 중...",
      howto_title: "영상 다운로드 방법",
      howto_step1: "1. 틱톡, 인스타그램, 유튜브에서 영상 링크를 복사하세요.",
      howto_step2: "2. TAEO 검색창에 복사한 링크를 붙여넣으세요.",
      howto_step3: "3. '다운로드' 버튼을 눌러 고화질 영상을 저장하세요.",
      feature_fast_title: "초고속 다운로드",
      feature_fast_desc: "몇 초 만에 영상을 소장하세요",
      feature_hq_title: "고화질 유지",
      feature_hq_desc: "가능한 최상의 화질을 제공합니다",
      feature_wm_title: "워터마크 제거",
      feature_wm_desc: "깨끗한 원본 그대로 다운로드",
      feature_sec_title: "안전한 보안",
      feature_sec_desc: "사용자의 개인정보를 보호합니다",
      faq_title: "자주 묻는 질문",
      faq_q1: "어떤 플랫폼을 지원하나요?",
      faq_a1: "틱톡, 도우인, 인스타그램, 유튜브, X(트위터)를 지원합니다. URL만 붙여넣으면 끝!",
      faq_q2: "정말 무료인가요?",
      faq_a2: "네! TAEO는 누구나 무료로 이용할 수 있는 서비스입니다.",
      faq_q3: "영상이 어디에 저장되나요?",
      faq_a3: "서버에 영구 저장되지 않고 즉시 사용자에게 스트리밍됩니다. 안심하세요!",
      legal_notice_desc: "반드시 저작권자의 허가를 받은 콘텐츠만 다운로드하세요. TAEO는 도구일 뿐이며 사용자의 이용 방식에 책임을 지지 않습니다."
    },
    youtube: {
      hero_title: "📺 유튜브 영상 다운로더",
      hero_subtitle: "유튜브 고화질 MP4 영상 무료 다운로드",
      hero_description: "유튜브 영상을 즉시 다운로드하는 가장 빠른 무료 도구입니다. 4K, 1080p 고화질 지원.",
      input_placeholder: "여기에 유튜브 링크를 붙여넣으세요..."
    },
    tiktok: {
      hero_title: "🎵 틱톡 & 도우인 다운로더",
      hero_subtitle: "워터마크 없는 틱톡 영상 초고속 저장",
      hero_description: "틱톡과 도우인 영상을 워터마크 없이 저장하는 최고의 도구입니다. 원본 화질 그대로.",
      input_placeholder: "여기에 틱톡 또는 도우인 링크를 붙여넣으세요..."
    },
    instagram: {
      hero_title: "📸 인스타그램 다운로더",
      hero_subtitle: "릴스, 비디오, 스토리 워터마크 없이 저장",
      hero_description: "인스타그램 릴스와 비디오를 고화질로 즉시 다운로드하세요.",
      input_placeholder: "여기에 인스타그램 링크를 붙여넣으세요..."
    },
    x: {
      hero_title: "🐦 X (트위터) 영상 다운로더",
      hero_subtitle: "X의 모든 영상을 고화질로 즉시 저장",
      hero_description: "트위터 영상을 워터마크 없이 MP4로 다운로드하세요. 가장 빠르고 간편합니다.",
      input_placeholder: "여기에 X (트위터) 링크를 붙여넣으세요..."
    }
  },
  en: {
    home: {
      meta_title: "TAEO - Best TikTok, Douyin, Instagram, YouTube & X Video Downloader",
      meta_description: "Download TikTok, Douyin, Instagram, YouTube, and X (Twitter) videos instantly without watermark. Fastest and free tool.",
      hero_title: "⚡ TAEO Video Downloader",
      hero_subtitle: "Download TikTok, Douyin, Instagram, YouTube & X Videos Fast",
      hero_description: "The fastest free tool to download social media videos including Douyin without watermark. High quality MP4 support.",
      input_placeholder: "Paste link (TikTok, Douyin, Instagram, YouTube, X)...",
      download_btn: "Download",
      loading: "Analyzing video...",
      error_occurred: "Error",
      error_default: "Failed to process video.",
      error_unsupported: "Unsupported URL format. Please paste a direct video link.",
      ERR_BOT_BLOCKED: "Bot protection triggered. Please try again later.",
      ERR_VIDEO_NOT_FOUND: "Video not found. Please check the URL.",
      ERR_TIKTOK_SEARCH: "TikTok search results are not supported. Use direct video link.",
      ERR_UNSUPPORTED_URL: "Unsupported URL format.",
      ERR_EXTRACT_FAILED: "Data extraction failed. Video might be new or restricted.",
      ERR_DOWNLOAD_FAILED: "Download failed. Please try again.",
      retry_btn: "Try Again",
      success_title: "✅ Request Sent",
      download_another: "Download Another",
      started: "Processing started! Your download will begin shortly.",
      save_log: "The save location window will appear shortly (within 20 seconds). Please do not close this page.",
      complete_dialog: "Complete! Opening Save Dialog...",
      howto_title: "How to Download Videos?",
      howto_step1: "1. Copy the video link from TikTok, Instagram, or YouTube.",
      howto_step2: "2. Paste the link into the TAEO search box above.",
      howto_step3: "3. Press the 'Download' button to save your video.",
      feature_fast_title: "Lightning Fast",
      feature_fast_desc: "Download videos in seconds",
      feature_hq_title: "High Quality",
      feature_hq_desc: "Best available quality",
      feature_wm_title: "No Watermark",
      feature_wm_desc: "Clean downloads",
      feature_sec_title: "Secure",
      feature_sec_desc: "Your privacy protected",
      faq_title: "Frequently Asked Questions",
      faq_q1: "Which sites are supported?",
      faq_a1: "We support TikTok, Douyin, Instagram, YouTube, and X (Twitter). Simply paste the link.",
      faq_q2: "Is TAEO free to use?",
      faq_a2: "Yes! TAEO is completely free. We support ourselves through ads.",
      faq_q3: "Where are videos saved?",
      faq_a3: "Files are streamed directly and not stored permanently. Privacy first!",
      legal_notice_desc: "Only download content that you have permission to download. TAEO is not responsible for misuse."
    },
    youtube: {
      hero_title: "📺 YouTube Video Downloader",
      hero_subtitle: "Download YouTube Videos in High Quality MP4",
      hero_description: "The fastest free tool to download YouTube videos instantly. Supports HD and 4K quality.",
      input_placeholder: "Paste YouTube link here..."
    },
    tiktok: {
      hero_title: "🎵 TikTok & Douyin Downloader",
      hero_subtitle: "Save TikTok Videos Without Watermark",
      hero_description: "Best tool to save TikTok and Douyin videos without watermark. High quality MP4.",
      input_placeholder: "Paste TikTok or Douyin link here..."
    },
    instagram: {
      hero_title: "📸 Instagram Downloader",
      hero_subtitle: "Save Reels, Videos & Stories No Watermark",
      hero_description: "Download Instagram Reels and videos instantly in high quality.",
      input_placeholder: "Paste Instagram link here..."
    },
    x: {
      hero_title: "🐦 X (Twitter) Video Downloader",
      hero_subtitle: "Save X Videos in High Quality Instantly",
      hero_description: "Download X (Twitter) videos without watermark in MP4. Fast and simple.",
      input_placeholder: "Paste X (Twitter) link here..."
    }
  },
  ja: {
    home: {
      meta_title: "TAEO - TikTok, Douyin, Instagram, YouTube, X 動画ダウンロード保存",
      meta_description: "TikTok、Douyin(抖音)、Instagram、YouTube、Xの動画を即座にダウンロード。ウォーターマークなし、완전 무료의 최강 툴.",
      hero_title: "⚡ TAEO 動画保存・ダウンロード",
      hero_subtitle: "TikTok, Douyin, Insta, YouTube, X 動画を最속 保存",
      hero_description: "TikTok、Douyin、Instagram、YouTube、X의 영상를 워터마크 없이 저장하는 최강의 무료 도구입니다.",
      input_placeholder: "여기에 영상 링크(TikTok, Douyin, Insta, YouTube, X)를 붙여넣으세요...",
      download_btn: "다운로드",
      loading: "영상 분석 중...",
      error_occurred: "오류 발생",
      error_default: "다운로드 처리에 실패했습니다.",
      error_unsupported: "지원하지 않는 URL 형식입니다. 영상 상세 주소를 입력해 주세요.",
      ERR_BOT_BLOCKED: "봇 차단이 발생했습니다. 잠시 후 다시 시도해 주세요.",
      ERR_VIDEO_NOT_FOUND: "영상을 찾을 수 없습니다. URL을 확인해 주세요.",
      ERR_TIKTOK_SEARCH: "틱톡 검색 결과 페이지는 지원하지 않습니다. 개별 영상 링크를 입력해 주세요.",
      ERR_UNSUPPORTED_URL: "지원하지 않는 URL 형식입니다.",
      ERR_EXTRACT_FAILED: "데이터 추출에 실패했습니다. 최신 영상이거나 일시적 제한일 수 있습니다.",
      ERR_DOWNLOAD_FAILED: "다운로드에 실패했습니다. 다시 시도해 주세요.",
      retry_btn: "다시 시도",
      success_title: "✅ 요청 완료",
      download_another: "추가 다운로드",
      started: "처리가 시작되었습니다! 곧 다운로드가 진행됩니다.",
      save_log: "저장 위치 선택 창이 나타날 때까지 최대 20초 정도 소요될 수 있습니다. 창이 뜰 때까지 잠시만 기다려 주세요.",
      complete_dialog: "완료! 저장 창을 여는 중...",
      howto_title: "動画の保存方法",
      howto_step1: "1. TikTok、Douyin、Instagram、YouTubeから動画のリンクをコピーします。",
      howto_step2: "2. TAEOの入力欄にコピーしたリンクを貼り付けます。",
      howto_step3: "3. 「ダウンロード」ボタンを押して高画質動画を保存します。",
      feature_fast_title: "超高速",
      feature_fast_desc: "数秒で動画を保存",
      feature_hq_title: "高画質",
      feature_hq_desc: "最高の画質で提供",
      feature_wm_title: "ロゴなし",
      feature_wm_desc: "ウォーターマークなしの保存",
      feature_sec_title: "安全第一",
      feature_sec_desc: "プライバシーを徹底保護",
      faq_title: "よくある質問",
      faq_q1: "どのサイトに対応していますか?",
      faq_a1: "TikTok, Douyin, Instagram, YouTube, X(Twitter)に対応しています. URL를 붙여넣으면 끝!",
      faq_q2: "利用料金はかかりますか?",
      faq_a2: "いいえ, 完全に無料입니다. 누구나 자유롭게 이용할 수 있습니다.",
      faq_q3: "動画はどこに保存されますか?",
      faq_a3: "サーバー에는 저장되지 않고, 직접 전송됩니다. 프라이버시는 보호됩니다.",
      legal_notice_desc: "著作権者の許可を得たコンテンツのみをダウンロードしてください. TAEO는 툴이며, 이용 방법에 관한 책임을 지지 않습니다."
    },
    youtube: {
      hero_title: "📺 YouTube 動画保存",
      hero_subtitle: "YouTube動画を高品質MP4で保存",
      hero_description: "YouTube動画を即座にダウンロードする最速の無料ツールです。HDおよび4K画質対応。",
      input_placeholder: "YouTubeのリンクを貼り付け..."
    },
    tiktok: {
      hero_title: "🎵 TikTok & Douyin 保存",
      hero_subtitle: "TikTok動画をウォーターマークなしで保存",
      hero_description: "TikTokやDouyinの動画をロゴなしで保存하는 最強 툴. 고화질 MP4.",
      input_placeholder: "TikTok 또는 Douyin 링크를 붙여넣으세요..."
    },
    instagram: {
      hero_title: "📸 Instagram 保存",
      hero_subtitle: "리ール, 비디오, 스토리를 로고 없이 저장",
      hero_description: "Instagramのリールや動画を高画質で即座에 다운로드.",
      input_placeholder: "Instagram 링크를 붙여넣으세요..."
    },
    x: {
      hero_title: "🐦 X (Twitter) 動画保存",
      hero_subtitle: "X의 영상을 고화질로 즉시 저장",
      hero_description: "X(Twitter)の動画をウォーターマークなしでMP4保存。高速かつ簡単。",
      input_placeholder: "X (Twitter) 링크를 붙여넣으세요..."
    }
  },
  id: {
    home: {
      meta_title: "TAEO - Pengunduh Video TikTok, Douyin, Instagram, YouTube & X Terbaik",
      meta_description: "Unduh video TikTok, Douyin, Instagram, YouTube, dan X tanpa watermark secara instan. Pengunduh video gratis tercepat.",
      hero_title: "⚡ TAEO Pengunduh Video",
      hero_subtitle: "Unduh Video TikTok, Douyin, Instagram, YouTube & X Cepat",
      hero_description: "Alat gratis tercepat untuk mengunduh video media sosial termasuk Douyin tanpa watermark. Mendukung MP4 kualitas tinggi.",
      input_placeholder: "Tempel tautan (TikTok, Douyin, Instagram, YouTube, X)...",
      download_btn: "Unduh",
      loading: "Menganalisis video...",
      error_occurred: "Kesalahan",
      error_default: "Gagal memproses video.",
      error_unsupported: "Format URL tidak didukung. Harap tempel tautan video langsung.",
      ERR_BOT_BLOCKED: "Akses diblokir oleh perlindungan bot. Silakan coba lagi nanti.",
      ERR_VIDEO_NOT_FOUND: "Video tidak ditemukan. Silakan periksa URL.",
      ERR_TIKTOK_SEARCH: "Hasil pencarian TikTok tidak didukung. Gunakan tautan video langsung.",
      ERR_UNSUPPORTED_URL: "Format URL tidak didukung.",
      ERR_EXTRACT_FAILED: "Ekstraksi data gagal. Video mungkin baru atau dibatasi.",
      ERR_DOWNLOAD_FAILED: "Unduhan gagal. Silakan coba lagi.",
      retry_btn: "Coba Lagi",
      success_title: "✅ Permintaan Terkirim",
      download_another: "Unduh Lagi",
      started: "Pemrosesan dimulai! Unduhan Anda akan segera dimulai.",
      save_log: "Jendela lokasi penyimpanan akan segera muncul (dalam 20 detik). Mohon jangan tutup halaman ini.",
      complete_dialog: "Selesai! Membuka Dialog Simpan...",
      howto_title: "Cara Mengunduh Video?",
      howto_step1: "1. Salin tautan video dari TikTok, Instagram, atau YouTube.",
      howto_step2: "2. Tempel tautan ke kotak pencarian TAEO di atas.",
      howto_step3: "3. Tekan tombol 'Unduh' untuk menyimpan video Anda.",
      feature_fast_title: "Kilat Cepat",
      feature_fast_desc: "Unduh video dalam hitungan detik",
      feature_hq_title: "Kualitas Tinggi",
      feature_hq_desc: "Kualitas terbaik yang tersedia",
      feature_wm_title: "Tanpa Watermark",
      feature_wm_desc: "Unduhan bersih",
      feature_sec_title: "Aman",
      feature_sec_desc: "Privasi Anda terlindungi",
      faq_title: "Pertanyaan yang Sering Diajukan",
      faq_q1: "Situs mana saja yang didukung?",
      faq_a1: "Kami mendukung TikTok, Douyin, Instagram, YouTube, dan X (Twitter). Cukup tempel tautannya.",
      faq_q2: "Apakah TAEO gratis digunakan?",
      faq_a2: "Ya! TAEO sepenuhnya gratis. Kami mendukung diri kami melalui iklan.",
      faq_q3: "Di mana video disimpan?",
      faq_a3: "File dialirkan langsung dan tidak disimpan secara permanen. Privasi diutamakan!",
      legal_notice_desc: "Hanya unduh konten yang Anda miliki izinnya. TAEO tidak bertanggung jawab atas penyalahgunaan."
    },
    youtube: {
      hero_title: "📺 Pengunduh Video YouTube",
      hero_subtitle: "Unduh Video YouTube dalam MP4 Kualitas Tinggi",
      hero_description: "Alat gratis tercepat untuk mengunduh video YouTube secara instan. Mendukung kualitas HD dan 4K.",
      input_placeholder: "Tempel tautan YouTube di sini..."
    },
    tiktok: {
      hero_title: "🎵 Pengunduh TikTok & Douyin",
      hero_subtitle: "Simpan Video TikTok Tanpa Watermark",
      hero_description: "Alat terbaik untuk menyimpan video TikTok dan Douyin tanpa watermark. MP4 kualitas tinggi.",
      input_placeholder: "Tempel tautan TikTok atau Douyin di sini..."
    },
    instagram: {
      hero_title: "📸 Pengunduh Instagram",
      hero_subtitle: "Simpan Reels, Video & Cerita Tanpa Watermark",
      hero_description: "Unduh Instagram Reels dan video secara instan dalam kualitas tinggi.",
      input_placeholder: "Tempel tautan Instagram di sini..."
    },
    x: {
      hero_title: "🐦 Pengunduh Video X (Twitter)",
      hero_subtitle: "Simpan Video X dalam Kualitas Tinggi Secara Instan",
      hero_description: "Unduh video X (Twitter) tanpa watermark dalam format MP4. Cepat dan sederhana.",
      input_placeholder: "Tempel tautan X (Twitter) di sini..."
    }
  },
  pt: {
    home: {
      meta_title: "TAEO - Melhor Downloader de Vídeo para TikTok, Douyin, Instagram, YouTube e X",
      meta_description: "Baixe vídeos do TikTok, Douyin, Instagram, YouTube e X (Twitter) sem marca d'água instantaneamente. O downloader gratuito mais rápido.",
      hero_title: "⚡ TAEO Downloader de Vídeo",
      hero_subtitle: "Baixe Vídeos do TikTok, Douyin, Instagram, YouTube & X Rápido",
      hero_description: "A ferramenta gratuita mais rápida para baixar vídeos de redes sociais incluindo Douyin sem marca d'água. Suporte a MP4 de alta qualidade.",
      input_placeholder: "Cole o link (TikTok, Douyin, Instagram, YouTube, X)...",
      download_btn: "Baixar",
      loading: "Analisando vídeo...",
      error_occurred: "Erro",
      error_default: "Falha ao processar o vídeo.",
      error_unsupported: "Formato de URL não suportado. Cole um link direto do vídeo.",
      ERR_BOT_BLOCKED: "Acesso bloqueado por proteção contra bots. Tente novamente mais tarde.",
      ERR_VIDEO_NOT_FOUND: "Vídeo não encontrado. Por favor, verifique a URL.",
      ERR_TIKTOK_SEARCH: "Resultados de pesquisa do TikTok não são suportados. Use o link direto do vídeo.",
      ERR_UNSUPPORTED_URL: "Formato de URL não suportado.",
      ERR_EXTRACT_FAILED: "Falha na extração de dados. O vídeo pode ser novo ou restrito.",
      ERR_DOWNLOAD_FAILED: "Falha no download. Tente novamente.",
      retry_btn: "Tentar Novamente",
      success_title: "✅ Solicitação Enviada",
      download_another: "Baixar Outro",
      started: "Processamento iniciado! Seu download começará em breve.",
      save_log: "A janela de local de salvamento aparecerá em breve (dentro de 20 segundos). Por favor, não feche esta página.",
      complete_dialog: "Concluído! Abrindo Diálogo de Salvamento...",
      howto_title: "Como Baixar Vídeos?",
      howto_step1: "1. Copie o link do vídeo do TikTok, Instagram ou YouTube.",
      howto_step2: "2. Cole o link na caixa de busca do TAEO acima.",
      howto_step3: "3. Pressione o botão 'Baixar' para salvar seu vídeo.",
      feature_fast_title: "Rápido como um Raio",
      feature_fast_desc: "Baixe vídeos em segundos",
      feature_hq_title: "Alta Qualidade",
      feature_hq_desc: "Melhor qualidade disponível",
      feature_wm_title: "Sem Marca d'Água",
      feature_wm_desc: "Downloads limpos",
      feature_sec_title: "Seguro",
      feature_sec_desc: "Sua privacidade protegida",
      faq_title: "Perguntas Frequentes",
      faq_q1: "Quais sites são suportados?",
      faq_a1: "Suportamos TikTok, Douyin, Instagram, YouTube e X (Twitter). Basta colar o link.",
      faq_q2: "O TAEO é gratuito para usar?",
      faq_a2: "Sim! O TAEO é completamente gratuito. Sustentamo-nos através de anúncios.",
      faq_q3: "Onde os vídeos são salvos?",
      faq_a3: "Os arquivos são transmitidos diretamente e não são armazenados permanentemente. Privacidade em primeiro lugar!",
      legal_notice_desc: "Baixe apenas conteúdo para o qual você tem permissão. O TAEO não é responsável pelo mau uso."
    },
    youtube: {
      hero_title: "📺 Downloader de Vídeo do YouTube",
      hero_subtitle: "Baixe Vídeos do YouTube em MP4 de Alta Qualidade",
      hero_description: "A ferramenta gratuita mais rápida para baixar vídeos do YouTube instantaneamente. Suporta HD e 4K.",
      input_placeholder: "Cole o link do YouTube aqui..."
    },
    tiktok: {
      hero_title: "🎵 Downloader do TikTok e Douyin",
      hero_subtitle: "Salve Vídeos do TikTok Sem Marca d'Água",
      hero_description: "Melhor ferramenta para salvar vídeos do TikTok e Douyin sem marca d'água. MP4 de alta qualidade.",
      input_placeholder: "Cole o link do TikTok ou Douyin aqui..."
    },
    instagram: {
      hero_title: "📸 Downloader do Instagram",
      hero_subtitle: "Salve Reels, Vídeos e Stories Sem Marca d'Água",
      hero_description: "Baixe Reels e vídeos do Instagram instantaneamente em alta qualidade.",
      input_placeholder: "Cole o link do Instagram aqui..."
    },
    x: {
      hero_title: "🐦 Downloader de Vídeo do X (Twitter)",
      hero_subtitle: "Salve Vídeos do X em Alta Qualidade Instantaneamente",
      hero_description: "Baixe vídeos do X (Twitter) sem marca d'água em MP4. Rápido e simples.",
      input_placeholder: "Cole o link do X (Twitter) aqui..."
    }
  },
  es: {
    home: {
      meta_title: "TAEO - El mejor descargador de videos de TikTok, Douyin, Instagram, YouTube y X",
      meta_description: "Descarga videos de TikTok, Douyin, Instagram, YouTube y X (Twitter) al instante sin marca de agua. La herramienta gratuita más rápida.",
      hero_title: "⚡ TAEO Descargador de Video",
      hero_subtitle: "Descarga videos de TikTok, Douyin, Instagram, YouTube y X rápido",
      hero_description: "La herramienta gratuita más rápida para descargar videos de redes sociales incluyendo Douyin sin marca de agua. Soporta MP4 de alta calidad.",
      input_placeholder: "Pega el enlace (TikTok, Douyin, Instagram, YouTube, X)...",
      download_btn: "Descargar",
      loading: "Analizando video...",
      error_occurred: "Error",
      error_default: "Error al procesar el video.",
      error_unsupported: "Formato de URL no soportado. Pega un enlace directo al video.",
      ERR_BOT_BLOCKED: "Acceso bloqueado por protección contra bots. Inténtalo de nuevo más tarde.",
      ERR_VIDEO_NOT_FOUND: "Video no encontrado. Por favor, comprueba la URL.",
      ERR_TIKTOK_SEARCH: "Los resultados de búsqueda de TikTok no son compatibles. Usa un enlace directo al video.",
      ERR_UNSUPPORTED_URL: "Formato de URL no compatible.",
      ERR_EXTRACT_FAILED: "Error al extraer los datos del video.",
      ERR_DOWNLOAD_FAILED: "Error en la descarga.",
      retry_btn: "Reintentar",
      success_title: "✅ Solicitud Enviada",
      download_another: "Descargar Otro",
      started: "¡Procesamiento iniciado! Tu descarga comenzará pronto.",
      save_log: "La ventana de ubicación de guardado aparecerá pronto (en menos de 20 segundos). Por favor, no cierres esta página.",
      complete_dialog: "¡Completado! Abriendo Diálogo de Guardado...",
      howto_title: "¿Cómo descargar videos?",
      howto_step1: "1. Copia el enlace del video de TikTok, Instagram o YouTube.",
      howto_step2: "2. Pega el enlace en el cuadro de búsqueda de TAEO arriba.",
      howto_step3: "3. Presiona el botón 'Descargar' para guardar tu video.",
      feature_fast_title: "Rápido como un rayo",
      feature_fast_desc: "Descarga videos en segundos",
      feature_hq_title: "Alta Calidad",
      feature_hq_desc: "La mejor calidad disponible",
      feature_wm_title: "Sin marca de agua",
      feature_wm_desc: "Descargas limpias",
      feature_sec_title: "Seguro",
      feature_sec_desc: "Tu privacidad protegida",
      faq_title: "Preguntas Frecuentes",
      faq_q1: "¿Qué sitios son compatibles?",
      faq_a1: "Soportamos TikTok, Douyin, Instagram, YouTube y X (Twitter). Simplemente pega el enlace.",
      faq_q2: "¿Es gratis usar TAEO?",
      faq_a2: "¡Sí! TAEO es completamente gratis. Nos mantenemos a través de anuncios.",
      faq_q3: "¿Dónde se guardan los videos?",
      faq_a3: "Los archivos se transmiten directamente y no se almacenan permanentemente. ¡La privacidad es lo primero!",
      legal_notice_desc: "Solo descarga contenido para el cual tengas permiso. TAEO no es responsable del mal uso."
    },
    youtube: {
      hero_title: "📺 Descargador de videos de YouTube",
      hero_subtitle: "Descarga videos de YouTube en MP4 de alta calidad",
      hero_description: "La herramienta gratuita más rápida para descargar videos de YouTube al instante. Soporta HD y 4K.",
      input_placeholder: "Pega el enlace de YouTube aquí..."
    },
    tiktok: {
      hero_title: "🎵 Descargador de TikTok y Douyin",
      hero_subtitle: "Guarda videos de TikTok sin marca de agua",
      hero_description: "La mejor herramienta para guardar videos de TikTok y Douyin sin marca de agua. MP4 de alta calidad.",
      input_placeholder: "Pega el enlace de TikTok o Douyin aquí..."
    },
    instagram: {
      hero_title: "📸 Descargador de Instagram",
      hero_subtitle: "Guarda Reels, videos e historias sin marca de agua",
      hero_description: "Descarga Instagram Reels y videos al instante en alta calidad.",
      input_placeholder: "Pega el enlace de Instagram aquí..."
    },
    x: {
      hero_title: "🐦 Descargador de videos de X (Twitter)",
      hero_subtitle: "Guarda videos de X en alta calidad al instante",
      hero_description: "Descarga videos de X (Twitter) sin marca de agua en MP4. Rápido y sencillo.",
      input_placeholder: "Pega el enlace de X (Twitter) aquí..."
    }
  },
  vi: {
    home: {
      meta_title: "TAEO - Trình tải video TikTok, Douyin, Instagram, YouTube & X tốt nhất",
      meta_description: "Tải video TikTok, Douyin, Instagram, YouTube và X (Twitter) ngay lập tức không có logo. Công cụ miễn phí nhanh nhất.",
      hero_title: "⚡ TAEO Trình tải video",
      hero_subtitle: "Tải video TikTok, Douyin, Instagram, YouTube & X nhanh chóng",
      hero_description: "Công cụ miễn phí nhanh nhất để tải video mạng xã hội bao gồm Douyin không có logo. Hỗ trợ MP4 chất lượng cao.",
      input_placeholder: "Dán liên kết (TikTok, Douyin, Instagram, YouTube, X)...",
      download_btn: "Tải xuống",
      loading: "Đang phân tích video...",
      error_occurred: "Lỗi",
      error_default: "Xử lý video thất bại.",
      error_unsupported: "Định dạng URL không được hỗ trợ. Vui lòng dán liên kết video trực tiếp.",
      ERR_BOT_BLOCKED: "Truy cập bị chặn bởi bảo vệ bot. Vui lòng thử lại sau.",
      ERR_VIDEO_NOT_FOUND: "Không tìm thấy video. Vui lòng kiểm tra URL.",
      ERR_TIKTOK_SEARCH: "Kết quả tìm kiếm TikTok không được hỗ trợ. Vui lòng sử dụng liên kết video trực tiếp.",
      ERR_UNSUPPORTED_URL: "Định dạng URL không được hỗ trợ.",
      ERR_EXTRACT_FAILED: "Trích xuất dữ liệu video thất bại.",
      ERR_DOWNLOAD_FAILED: "Tải xuống thất bại.",
      retry_btn: "Thử lại",
      success_title: "✅ Yêu cầu đã gửi",
      download_another: "Tải cái khác",
      started: "Đã bắt đầu xử lý! Quá trình tải xuống của bạn sẽ sớm bắt đầu.",
      save_log: "Cửa sổ vị trí lưu sẽ sớm xuất hiện (trong vòng 20 giây). Vui lòng không đóng trang này.",
      complete_dialog: "Hoàn tất! Đang mở hộp thoại lưu...",
      howto_title: "Làm thế nào để tải video?",
      howto_step1: "1. Sao chép liên kết video từ TikTok, Instagram hoặc YouTube.",
      howto_step2: "2. Dán liên kết vào ô tìm kiếm TAEO ở trên.",
      howto_step3: "3. Nhấn nút 'Tải xuống' để lưu video của bạn.",
      feature_fast_title: "Nhanh như chớp",
      feature_fast_desc: "Tải video trong vài giây",
      feature_hq_title: "Chất lượng cao",
      feature_hq_desc: "Chất lượng tốt nhất hiện có",
      feature_wm_title: "Không có logo",
      feature_wm_desc: "Tải xuống sạch sẽ",
      feature_sec_title: "An toàn",
      feature_sec_desc: "Quyền riêng tư của bạn được bảo vệ",
      faq_title: "Các câu hỏi thường gặp",
      faq_q1: "Những trang nào được hỗ trợ?",
      faq_a1: "Chúng tôi hỗ trợ TikTok, Douyin, Instagram, YouTube và X (Twitter). Chỉ cần dán liên kết.",
      faq_q2: "TAEO có miễn phí không?",
      faq_a2: "Có! TAEO hoàn toàn miễn phí. Chúng tôi duy trì thông qua quảng cáo.",
      faq_q3: "Video được lưu ở đâu?",
      faq_a3: "Các tệp được truyền trực tiếp và không được lưu trữ vĩnh viễn. Quyền riêng tư là trên hết!",
      legal_notice_desc: "Chỉ tải xuống nội dung mà bạn có quyền. TAEO không chịu trách nhiệm về việc lạm dụng."
    },
    youtube: {
      hero_title: "📺 Trình tải video YouTube",
      hero_subtitle: "Tải video YouTube ở định dạng MP4 chất lượng cao",
      hero_description: "Công cụ miễn phí nhanh nhất để tải video YouTube ngay lập tức. Hỗ trợ chất lượng HD và 4K.",
      input_placeholder: "Dán liên kết YouTube vào đây..."
    },
    tiktok: {
      hero_title: "🎵 Trình tải TikTok & Douyin",
      hero_subtitle: "Lưu video TikTok không có logo",
      hero_description: "Công cụ tốt nhất để lưu video TikTok và Douyin không có logo. MP4 chất lượng cao.",
      input_placeholder: "Dán liên kết TikTok hoặc Douyin vào đây..."
    },
    instagram: {
      hero_title: "📸 Trình tải Instagram",
      hero_subtitle: "Lưu Reels, video & tin câu chuyện không có logo",
      hero_description: "Tải Instagram Reels và video ngay lập tức ở chất lượng cao.",
      input_placeholder: "Dán liên kết Instagram vào đây..."
    },
    x: {
      hero_title: "🐦 Trình tải video X (Twitter)",
      hero_subtitle: "Lưu video X chất lượng cao ngay lập tức",
      hero_description: "Tải video X (Twitter) không có logo ở định dạng MP4. Nhanh chóng và đơn giản.",
      input_placeholder: "Dán liên kết X (Twitter) vào đây..."
    }
  },
  ru: {
    home: {
      meta_title: "TAEO - Лучший загрузчик видео из TikTok, Douyin, Instagram, YouTube и X",
      meta_description: "Скачивайте видео из TikTok, Douyin, Instagram, YouTube и X (Twitter) мгновенно без водяных знаков. Самый быстрый бесплатный инструмент.",
      hero_title: "⚡ TAEO Загрузчик видео",
      hero_subtitle: "Скачивайте видео из TikTok, Douyin, Instagram, YouTube и X быстро",
      hero_description: "Самый быстрый бесплатный инструмент для скачивания видео из социальных сетей, включая Douyin, без водяных знаков. Поддержка высококачественного MP4.",
      input_placeholder: "Вставьте ссылку (TikTok, Douyin, Instagram, YouTube, X)...",
      download_btn: "Скачать",
      loading: "Анализ видео...",
      error_occurred: "Ошибка",
      error_default: "Не удалось обработать видео.",
      error_unsupported: "Неподдерживаемый формат URL. Пожалуйста, вставьте прямую ссылку на видео.",
      ERR_BOT_BLOCKED: "Доступ заблокирован защитой от ботов. Пожалуйста, попробуйте позже.",
      ERR_VIDEO_NOT_FOUND: "Видео не найдено. Пожалуйста, проверьте URL.",
      ERR_TIKTOK_SEARCH: "Результаты поиска TikTok не поддерживаются. Пожалуйста, используйте прямую ссылку на видео.",
      ERR_UNSUPPORTED_URL: "Неподдерживаемый формат URL.",
      ERR_EXTRACT_FAILED: "Не удалось извлечь данные видео.",
      ERR_DOWNLOAD_FAILED: "Ошибка скачивания.",
      retry_btn: "Повторить",
      success_title: "✅ Запрос отправлен",
      download_another: "Скачать еще",
      started: "Обработка началась! Скачивание скоро начнется.",
      save_log: "Окно выбора места сохранения появится в ближайшее время (в течение 20 секунд). Пожалуйста, не закрывайте эту страницу.",
      complete_dialog: "Готово! Открытие диалога сохранения...",
      howto_title: "Как скачать видео?",
      howto_step1: "1. Скопируйте ссылку на видео из TikTok, Instagram или YouTube.",
      howto_step2: "2. Вставьте ссылку в поле поиска TAEO выше.",
      howto_step3: "3. Нажмите кнопку «Скачать», чтобы сохранить видео.",
      feature_fast_title: "Молниеносно",
      feature_fast_desc: "Скачивайте видео за считанные секунды",
      feature_hq_title: "Высокое качество",
      feature_hq_desc: "Лучшее доступное качество",
      feature_wm_title: "Без водяных знаков",
      feature_wm_desc: "Чистые загрузки",
      feature_sec_title: "Безопасно",
      feature_sec_desc: "Ваша конфиденциальность защищена",
      faq_title: "Часто задаваемые вопросы",
      faq_q1: "Какие сайты поддерживаются?",
      faq_a1: "Мы поддерживаем TikTok, Douyin, Instagram, YouTube и X (Twitter). Просто вставьте ссылку.",
      faq_q2: "TAEO бесплатен?",
      faq_a2: "Да! TAEO полностью бесплатен. Мы существуем за счет рекламы.",
      faq_q3: "Где сохраняются видео?",
      faq_a3: "Файлы передаются напрямую и не хранятся постоянно. Конфиденциальность превыше всего!",
      legal_notice_desc: "Скачивайте только тот контент, на который у вас есть разрешение. TAEO не несет ответственности за злоупотребление."
    },
    youtube: {
      hero_title: "📺 Загрузчик видео с YouTube",
      hero_subtitle: "Скачивайте видео с YouTube в высоком качестве MP4",
      hero_description: "Самый быстрый бесплатный инструмент для мгновенного скачивания видео с YouTube. Поддержка HD и 4K.",
      input_placeholder: "Вставьте ссылку на YouTube здесь..."
    },
    tiktok: {
      hero_title: "🎵 Загрузчик из TikTok и Douyin",
      hero_subtitle: "Сохраняйте видео из TikTok без водяных знаков",
      hero_description: "Лучший инструмент для сохранения видео из TikTok и Douyin без водяных знаков. Высокое качество MP4.",
      input_placeholder: "Вставьте ссылку на TikTok или Douyin здесь..."
    },
    instagram: {
      hero_title: "📸 Загрузчик из Instagram",
      hero_subtitle: "Сохраняйте Reels, видео и истории без водяных знаков",
      hero_description: "Скачивайте Reels и видео из Instagram мгновенно в высоком качестве.",
      input_placeholder: "Вставьте ссылку на Instagram здесь..."
    },
    x: {
      hero_title: "🐦 Загрузчик видео из X (Twitter)",
      hero_subtitle: "Сохраняйте видео из X в высоком качестве мгновенно",
      hero_description: "Скачивайте видео из X (Twitter) без водяных знаков в формате MP4. Быстро и просто.",
      input_placeholder: "Вставьте ссылку на X (Twitter) здесь..."
    }
  },
  hi: {
    home: {
      meta_title: "TAEO - सर्वश्रेष्ठ TikTok, Douyin, Instagram, YouTube और X वीडियो डाउनलोडर",
      meta_description: "बिना वॉटरमार्क के TikTok, Douyin, Instagram, YouTube और X (Twitter) वीडियो तुरंत डाउनलोड करें। सबसे तेज़ और मुफ़्त टूल।",
      hero_title: "⚡ TAEO वीडियो डाउनलोडर",
      hero_subtitle: "TikTok, Douyin, Instagram, YouTube और X वीडियो तेज़ी से डाउनलोड करें",
      hero_description: "वॉटरmark के बिना Douyin सहित सोशल मीडिया वीडियो डाउनलोड करने का सबसे तेज़ मुफ़्त टूल। उच्च गुणवत्ता MP4 समर्थन।",
      input_placeholder: "लिंक पेस्ट करें (TikTok, Douyin, Instagram, YouTube, X)...",
      download_btn: "डाउनलोड",
      loading: "वीडियो का विश्लेषण कर रहा है...",
      error_occurred: "त्रुटि",
      error_default: "वीडियो को संसाधित करने में विफल।",
      error_unsupported: "असमर्थित URL प्रारूप। कृपया सीधा वीडियो लिंक पेस्ट करें।",
      ERR_BOT_BLOCKED: "बॉट सुरक्षा द्वारा एक्सेस ब्लॉक कर दिया गया। कृपया बाद में पुन: प्रयास करें।",
      ERR_VIDEO_NOT_FOUND: "वीडियो नहीं मिला। कृपया URL की जाँच करें।",
      ERR_TIKTOK_SEARCH: "TikTok खोज परिणाम समर्थित नहीं हैं। कृपया सीधे वीडियो लिंक का उपयोग करें।",
      ERR_UNSUPPORTED_URL: "असमर्थित URL प्रारूप।",
      ERR_EXTRACT_FAILED: "वीडियो डेटा निकालने में विफल।",
      ERR_DOWNLOAD_FAILED: "डाउनलोड विफल रहा।",
      retry_btn: "पुनः प्रयास करें",
      success_title: "✅ अनुरोध भेजा गया",
      download_another: "दूसरा डाउनलोड करें",
      started: "प्रसंस्करण शुरू! आपका डाउनलोड जल्द ही शुरू होगा।",
      save_log: "सेव लोकेशन विंडो जल्द ही दिखाई देगी (20 सेकंड के भीतर)। कृपया इस पृष्ठ को बंद न करें।",
      complete_dialog: "पूर्ण! सेव डायलॉग खुल रहा है...",
      howto_title: "वीडियो कैसे डाउनलोड करें?",
      howto_step1: "1. TikTok, Instagram या YouTube से video link कॉपी करें।",
      howto_step2: "2. ऊपर TAEO सर्च बॉक्स में लिंक पेस्ट करें।",
      howto_step3: "3. अपना वीडियो सहेजने के लिए 'डाउनलोड' बटन दबाएं।",
      feature_fast_title: "बिजली की तरह तेज़",
      feature_fast_desc: "सेकंड में वीडियो डाउनलोड करें",
      feature_hq_title: "उच्च गुणवत्ता",
      feature_hq_desc: "सर्वोत्तम उपलब्ध गुणवत्ता",
      feature_wm_title: "कोई वॉटरमार्क नहीं",
      feature_wm_desc: "स्वच्छ डाउनलोड",
      feature_sec_title: "सुरक्षित",
      feature_sec_desc: "आपकी गोपनीयता सुरक्षित",
      faq_title: "अक्सर पूछे जाने वाले प्रश्न",
      faq_q1: "कौन सी साइटें समर्थित हैं?",
      faq_a1: "हम TikTok, Douyin, Instagram, YouTube और X (Twitter) का समर्थन करते हैं। बस लिंक पेस्ट करें।",
      faq_q2: "क्या TAEO उपयोग करने के लिए स्वतंत्र है?",
      faq_a2: "हाँ! TAEO पूरी तरह से मुफ़्त है। हम विज्ञापनों के माध्यम से अपना समर्थन करते हैं।",
      faq_q3: "वीडियो कहाँ सहेजे जाते हैं?",
      faq_a3: "फ़ाइलें सीधे स्ट्रीम की जाती हैं और स्थायी रूप से संग्रहीत नहीं की जाती हैं। गोपनीयता पहले!",
      legal_notice_desc: "केवल वही सामग्री डाउनलोड करें जिसकी आपके पास अनुमति है। TAEO दुरुपयोग के लिए ज़िम्मेदार नहीं है।"
    },
    youtube: {
      hero_title: "📺 YouTube वीडियो डाउनलोडर",
      hero_subtitle: "उच्च गुणवत्ता वाले MP4 में YouTube वीडियो डाउनलोड करें",
      hero_description: "YouTube वीडियो तुरंत डाउनलोड करने का सबसे तेज़ मुफ़्त टूल। HD और 4K गुणवत्ता का समर्थन करता है।",
      input_placeholder: "यहाँ YouTube लिंक पेस्ट करें..."
    },
    tiktok: {
      hero_title: "🎵 TikTok और Douyin डाउनलोडर",
      hero_subtitle: "बिना वॉटरमार्क के TikTok वीडियो सहेजें",
      hero_description: "बिना वॉटरमार्क के TikTok और Douyin वीडियो सहेजने का सबसे अच्छा टूल। उच्च गुणवत्ता MP4।",
      input_placeholder: "यहाँ TikTok या Douyin लिंक पेस्ट करें..."
    },
    instagram: {
      hero_title: "📸 Instagram डाउनलोडर",
      hero_subtitle: "रील्स, वीडियो और कहानियां बिना वॉटरmark के सहेजें",
      hero_description: "उच्च गुणवत्ता में तुरंत Instagram रील्स और वीडियो डाउनलोड करें।",
      input_placeholder: "यहाँ Instagram लिंक पेस्ट करें..."
    },
    x: {
      hero_title: "🐦 X (Twitter) वीडियो डाउनलोडर",
      hero_subtitle: "X वीडियो तुरंत उच्च गुणवत्ता में सहेजें",
      hero_description: "बि나 वॉटरमार्क के MP4 में X (Twitter) वीडियो डाउनलोड करें। तेज़ और सरल।",
      input_placeholder: "यहाँ X (Twitter) लिंक पेस्ट करें..."
    }
  },
  de: {
    home: {
      meta_title: "TAEO - Bester TikTok, Douyin, Instagram, YouTube & X Video Downloader",
      meta_description: "Laden Sie TikTok, Douyin, Instagram, YouTube und X (Twitter) Videos sofort ohne Wasserzeichen herunter. Das schnellste kostenlose Tool.",
      hero_title: "⚡ TAEO Video Downloader",
      hero_subtitle: "Laden Sie TikTok, Douyin, Instagram, YouTube & X Videos schnell herunter",
      hero_description: "Das schnellste kostenlose Tool zum Herunterladen von Social-Media-Videos einschließlich Douyin ohne Wasserzeichen. Hochwertige MP4-Unterstützung.",
      input_placeholder: "Link einfügen (TikTok, Douyin, Instagram, YouTube, X)...",
      download_btn: "Herunterladen",
      loading: "Video wird analysiert...",
      error_occurred: "Fehler",
      error_default: "Video konnte nicht verarbeitet werden.",
      error_unsupported: "Nicht unterstütztes URL-Format. Bitte fügen Sie einen direkten Videolink ein.",
      ERR_BOT_BLOCKED: "Zugriff durch Bot-Schutz blockiert. Bitte versuchen Sie es später erneut.",
      ERR_VIDEO_NOT_FOUND: "Video nicht gefunden. Bitte überprüfen Sie die URL.",
      ERR_TIKTOK_SEARCH: "TikTok-Suchergebnisse werden nicht unterstützt. Bitte verwenden Sie einen direkten Videolink.",
      ERR_UNSUPPORTED_URL: "Nicht unterstütztes URL-Format.",
      ERR_EXTRACT_FAILED: "Fehler beim Extrahieren der Videodaten.",
      ERR_DOWNLOAD_FAILED: "Download fehlgeschlagen.",
      retry_btn: "Erneut versuchen",
      success_title: "✅ Anfrage gesendet",
      download_another: "Weiteres herunterladen",
      started: "Verarbeitung gestartet! Ihr Download beginnt in Kürze.",
      save_log: "Das Fenster zum Speichern wird in Kürze erscheinen (innerhalb von 20 Sekunden). Bitte schließen Sie diese Seite nicht.",
      complete_dialog: "Fertig! Speicherdialog wird geöffnet...",
      howto_title: "Wie lädt man Videos herunter?",
      howto_step1: "1. Kopieren Sie den Videolink von TikTok, Instagram oder YouTube.",
      howto_step2: "2. Fügen Sie den Link oben in das TAEO-Suchfeld ein.",
      howto_step3: "3. Drücken Sie die Schaltfläche 'Herunterladen', um Ihr Video zu speichern.",
      feature_fast_title: "Blitzschnell",
      feature_fast_desc: "Videos in Sekunden herunterladen",
      feature_hq_title: "Hohe Qualität",
      feature_hq_desc: "Beste verfügbare Qualität",
      feature_wm_title: "Kein Wasserzeichen",
      feature_wm_desc: "Saubere Downloads",
      feature_sec_title: "Sicher",
      feature_sec_desc: "Ihre Privatsphäre geschützt",
      faq_title: "Häufig gestellte Fragen",
      faq_q1: "Welche Seiten werden unterstützt?",
      faq_a1: "Wir unterstützen TikTok, Douyin, Instagram, YouTube und X (Twitter). Fügen Sie einfach den Link ein.",
      faq_q2: "Ist TAEO kostenlos?",
      faq_a2: "Ja! TAEO ist völlig kostenlos. Wir finanzieren uns durch Werbung.",
      faq_q3: "Wo werden Videos gespeichert?",
      faq_a3: "Dateien werden direkt gestreamt und nicht dauerhaft gespeichert. Privatsphäre zuerst!",
      legal_notice_desc: "Laden Sie nur Inhalte herunter, für die Sie die Erlaubnis haben. TAEO ist nicht für Missbrauch verantwortlich."
    },
    youtube: {
      hero_title: "📺 YouTube Video Downloader",
      hero_subtitle: "YouTube-Videos in hochwertigem MP4 herunterladen",
      hero_description: "Das schnellste kostenlose Tool, um YouTube-Videos sofort herunterzuladen. Unterstützt HD- und 4K-Qualität.",
      input_placeholder: "YouTube-Link hier einfügen..."
    },
    tiktok: {
      hero_title: "🎵 TikTok & Douyin Downloader",
      hero_subtitle: "TikTok-Videos ohne Wasserzeichen speichern",
      hero_description: "Bestes Tool zum Speichern von TikTok- und Douyin-Videos ohne Wasserzeichen. Hochwertiges MP4.",
      input_placeholder: "TikTok- oder Douyin-Link hier einfügen..."
    },
    instagram: {
      hero_title: "📸 Instagram Downloader",
      hero_subtitle: "Reels, Videos & Stories ohne Wasserzeichen speichern",
      hero_description: "Laden Sie Instagram Reels und Videos sofort in hoher Qualität herunter.",
      input_placeholder: "Instagram-Link hier einfügen..."
    },
    x: {
      hero_title: "🐦 X (Twitter) Video Downloader",
      hero_subtitle: "X-Videos sofort in hoher Qualität speichern",
      hero_description: "Laden Sie X (Twitter) Videos ohne Wasserzeichen im MP4-Format herunter. Schnell und einfach.",
      input_placeholder: "X (Twitter) Link hier einfügen..."
    }
  }
};

/** Language & Path Logic */
let currentLang = 'ko';
let currentPlatform = 'home';

function initLanguage() {
  const langSelect = document.getElementById('langSelect');
  const pathParts = window.location.pathname.split('/').filter(p => p); // [lang, page]
  
  currentLang = pathParts[0] || 'ko';
  if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = 'ko';
  
  const page = pathParts[1] || 'home';
  currentPlatform = PLATFORM_MAP[page] || 'home';
  
  langSelect.value = currentLang;
  applyTranslations(currentLang, currentPlatform);

  langSelect.addEventListener('change', (e) => {
    const newLang = e.target.value;
    const pagePath = page === 'home' ? '' : page;
    window.location.href = `/${newLang}/${pagePath}`;
  });
}

function applyTranslations(lang, platform) {
  const langData = TRANSLATIONS[lang] || TRANSLATIONS['ko'];
  const base = langData.home;
  const spec = langData[platform] || {};

  // Update Metadata
  document.title = base.meta_title;
  
  // Combine platform specific text with base
  const t = { ...base, ...spec };

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });
}

/** UI Helpers */
function showLoading() {
  loadingUI.classList.remove('hidden');
  errorUI.classList.add('hidden');
  successUI.classList.add('hidden');
  downloadBtn.disabled = true;
}

function showSuccess() {
  loadingUI.classList.add('hidden');
  successUI.classList.remove('hidden');
  downloadBtn.disabled = false;
}

function showError(msg) {
  loadingUI.classList.add('hidden');
  successUI.classList.add('hidden');
  errorUI.classList.remove('hidden');
  
  const langData = TRANSLATIONS[currentLang] || TRANSLATIONS['ko'];
  const t = langData.home;
  
  if (t[msg]) {
    errorMessage.textContent = t[msg];
  } else if (msg && (msg.includes('지원하지 않는 URL') || msg.includes('Unsupported URL'))) {
    errorMessage.textContent = t.error_unsupported;
  } else {
    errorMessage.textContent = msg || t.error_default;
  }
  downloadBtn.disabled = false;
}

function resetForm() {
  urlInput.value = '';
  loadingUI.classList.add('hidden');
  errorUI.classList.add('hidden');
  successUI.classList.add('hidden');
  currentVisualProgress = 0;
  if (progressInterval) clearInterval(progressInterval);
}

/** Ultra-Smooth Progress Logic */
let currentVisualProgress = 0;
let progressInterval = null;

function updateProgressBar(targetPercent) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  if (!progressBar || !progressText) return;

  if (progressInterval) clearInterval(progressInterval);
  
  progressInterval = setInterval(() => {
    if (currentVisualProgress < targetPercent) {
      currentVisualProgress += 0.2;
      if (currentVisualProgress > targetPercent) currentVisualProgress = targetPercent;
      
      progressBar.style.width = `${currentVisualProgress}%`;
      progressText.textContent = `${Math.floor(currentVisualProgress)}%`;
    } else {
      clearInterval(progressInterval);
    }
  }, 10);
}

async function trackProgress(url) {
  const langData = TRANSLATIONS[currentLang] || TRANSLATIONS['ko'];
  const t = langData.home;

  let progressId;
  try {
    const msgUint8 = new TextEncoder().encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    progressId = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  } catch (e) {
    progressId = btoa(unescape(encodeURIComponent(url))).substring(0, 32).replace(/[^a-zA-Z0-9]/g, '');
  }

  updateProgressBar(30); // Phase 1: Analysis (0~30%)
  
  const eventSource = new EventSource(`/api/progress/${progressId}`);
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const realProgress = data.progress;
    
    // Phase 2: Download (30~100%)
    const visualTarget = 30 + (realProgress * 0.7);
    updateProgressBar(visualTarget);
    
    if (realProgress >= 100) {
      eventSource.close();
      document.getElementById('progressText').textContent = t.complete_dialog;
    }
  };
  eventSource.onerror = () => eventSource.close();
  return progressId;
}

/** Core Functionality */
async function downloadVideo() {
  const url = urlInput.value.trim();
  const langData = TRANSLATIONS[currentLang] || TRANSLATIONS['ko'];
  const t = langData.home;

  if (!url) {
    showError(t.input_placeholder);
    return;
  }
  
  showLoading();
  currentVisualProgress = 0;

  try {
    const analyzeRes = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!analyzeRes.ok) {
      const errData = await analyzeRes.json().catch(() => ({}));
      showError(errData.message || t.error_default);
      return;
    }

    const progressId = await trackProgress(url);
    showSuccess();

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download';
    
    const fields = { url, progressId };
    for (const key in fields) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = fields[key];
      form.appendChild(input);
    }
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);

  } catch (err) {
    showError(t.error_default);
  }
}

/** Event Listeners */
async function preFetchMetadata(url) {
  if (!url || url === lastAnalyzedUrl || !url.startsWith('http')) return;
  lastAnalyzedUrl = url;
  try {
    await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
  } catch (err) {}
}

let lastAnalyzedUrl = '';
urlInput.addEventListener('input', (e) => preFetchMetadata(e.target.value.trim()));
urlInput.addEventListener('paste', (e) => {
  const pastedData = (e.clipboardData || window.clipboardData).getData('text');
  preFetchMetadata(pastedData.trim());
});

downloadBtn.addEventListener('click', downloadVideo);
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') downloadVideo(); });

document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    button.parentElement.classList.toggle('active');
  });
});

initLanguage();
window.resetForm = resetForm;
