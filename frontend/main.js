const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const loadingUI = document.getElementById('loadingUI');
const errorUI = document.getElementById('errorUI');
const errorMessage = document.getElementById('errorMessage');
const successUI = document.getElementById('successUI');

const TRANSLATIONS = {
  en: {
    hero_title: "⚡ TAEO",
    hero_subtitle: "Fast & Easy Video Downloader",
    hero_description: "Download TikTok, Instagram & YouTube videos instantly. No watermark, completely free.",
    input_placeholder: "Paste video link here...",
    download_btn: "Download",
    loading_text: "Preparing server... (May take up to 1 min)",
    error_title: "❌ Error",
    retry_btn: "Try Again",
    success_title: "✅ Request Sent",
    download_again_btn: "Download Another",
    started: "Processing started! Your download will begin shortly.",
    feature_fast_title: "Lightning Fast",
    feature_fast_desc: "Download videos in seconds",
    feature_hq_title: "High Quality",
    feature_hq_desc: "Best available quality",
    feature_wm_title: "No Watermark",
    feature_wm_desc: "Clean downloads",
    feature_sec_title: "Secure",
    feature_sec_desc: "Your privacy protected",
    faq_title: "Frequently Asked Questions",
    faq_q1: "What platforms do you support?",
    faq_a1: "We support TikTok, Instagram, and YouTube. Simply paste the video URL and click download.",
    faq_q2: "Is TAEO free to use?",
    faq_a2: "Yes! TAEO is completely free. We support ourselves through non-intrusive advertising (if any).",
    faq_q3: "How long are downloads stored?",
    faq_a3: "Files are streamed directly and not stored on our server permanently. Privacy first!",
    faq_q4: "What's the maximum file size?",
    faq_a4: "Videos up to 1GB are supported. Larger files may fail due to processing time.",
    faq_q5: "Does TAEO store my data?",
    faq_a5: "No. We do not store any personal information or your download history.",
    faq_q6: "Is it legal?",
    faq_a6: "Only download content you have permission for. We are not responsible for misuse.",
    legal_notice_title: "Copyright Notice:",
    legal_notice_desc: "Only download content that you have permission to download. TAEO is a tool and is not responsible for how you use it. Always respect creator rights."
  },
  ko: {
    hero_title: "⚡ TAEO",
    hero_subtitle: "빠르고 쉬운 영상 다운로더",
    hero_description: "틱톡, 인스타그램, 유튜브 영상을 즉시 다운로드하세요. 워터마크 없이 무료로 제공됩니다.",
    input_placeholder: "여기에 영상 링크를 붙여넣으세요...",
    download_btn: "다운로드",
    loading_text: "서버 준비 중... (최대 1분 정도 소요될 수 있습니다)",
    error_title: "❌ 오류 발생",
    retry_btn: "다시 시도",
    success_title: "✅ 요청 완료",
    download_again_btn: "추가 다운로드",
    started: "처리가 시작되었습니다! 곧 다운로드가 진행됩니다.",
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
    faq_a1: "틱톡, 인스타그램(릴스), 유튜브를 지원합니다. URL만 붙여넣으면 끝!",
    faq_q2: "정말 무료인가요?",
    faq_a2: "네! TAEO는 누구나 무료로 이용할 수 있는 서비스입니다.",
    faq_q3: "다운로드된 파일은 얼마나 보관되나요?",
    faq_a3: "서버에 영구 저장되지 않고 즉시 사용자에게 스트리밍됩니다. 안심하세요!",
    faq_q4: "최대 파일 용량 제한이 있나요?",
    faq_a4: "최대 1GB까지 지원합니다. 너무 큰 파일은 시간이 오래 걸려 끊길 수 있습니다.",
    faq_q5: "내 데이터를 저장하나요?",
    faq_a5: "아니요. 사용자의 개인정보나 다운로드 기록을 절대 저장하지 않습니다.",
    faq_q6: "저작권은 어떻게 되나요?",
    faq_a6: "본인이 소유하거나 허가받은 영상만 다운로드하세요. 오남용에 대한 책임은 사용자에게 있습니다.",
    legal_notice_title: "저작권 고지:",
    legal_notice_desc: "반드시 저작권자의 허가를 받은 콘텐츠만 다운로드하세요. TAEO는 도구일 뿐이며 사용자의 이용 방식에 책임을 지지 않습니다. 제작자의 권리를 존중해 주세요."
  },
  ja: {
    hero_title: "⚡ TAEO",
    hero_subtitle: "最速ビデオダウンローダー",
    hero_description: "TikTok、Instagram、YouTubeの動画を即座にダウンロード。ウォーターマークなし、完全無料。",
    input_placeholder: "ここにリンクを貼り付けてください...",
    download_btn: "ダウンロード",
    loading_text: "サーバーを準備中... (最大1分ほどかかる場合があります)",
    error_title: "❌ エラー",
    retry_btn: "再試行",
    success_title: "✅ リクエスト完了",
    download_again_btn: "続けてダウンロード",
    started: "処理を開始しました！まもなくダウンロードが始まります。",
    feature_fast_title: "超高速",
    feature_fast_desc: "数秒で動画を保存",
    feature_hq_title: "高画質",
    feature_hq_desc: "最高の画質で提供",
    feature_wm_title: "ロゴなし",
    feature_wm_desc: "ウォーターマークなしの保存",
    feature_sec_title: "安全第一",
    feature_sec_desc: "プライバシーを徹底保護",
    faq_title: "よくある質問",
    faq_q1: "どのサイトに対応していますか？",
    faq_a1: "TikTok、Instagram、YouTubeに対応しています。URLを貼るだけでOKです。",
    faq_q2: "利用料金はかかりますか？",
    faq_a2: "いいえ、完全に無料です。どなたでも自由にご利用いただけます。",
    faq_q3: "保存された動画はどうなりますか？",
    faq_a3: "サーバーには保存されず、直接転送されます。プライバシーは守られます。",
    faq_q4: "容量制限はありますか？",
    faq_a4: "最大1GBまで対応しています。それ以上のサイズは失敗する可能性があります。",
    faq_q5: "データは収集されますか？",
    faq_a5: "いいえ、個人情報や履歴などは一切収集・保存しません。",
    faq_q6: "著作権について",
    faq_a6: "許可された動画のみダウンロードしてください。悪用に関しては責任を負いかねます。",
    legal_notice_title: "著作権に関する注意:",
    legal_notice_desc: "著作権者の許可を得たコンテンツのみをダウンロードしてください。TAEOはツールであり、利用方法に関する責任は負いません。クリエイターの権利を尊重してください。"
  }
};

function initLanguage() {
  const langSelect = document.getElementById('langSelect');
  const pathParts = window.location.pathname.split('/');
  let currentLang = pathParts[1] || 'en';
  
  if (!['en', 'ko', 'ja'].includes(currentLang)) currentLang = 'en';
  
  langSelect.value = currentLang;
  applyTranslations(currentLang);

  langSelect.addEventListener('change', (e) => {
    const newLang = e.target.value;
    window.location.href = `/${newLang}/`;
  });
}

function applyTranslations(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });
}

function showLoading() {
  loadingUI.classList.remove('hidden');
  errorUI.classList.add('hidden');
  successUI.classList.add('hidden');
  downloadBtn.disabled = true;
}

function showSuccess(msg) {
  loadingUI.classList.add('hidden');
  successUI.classList.remove('hidden');
  downloadBtn.disabled = false;
}

function showError(msg) {
  loadingUI.classList.add('hidden');
  errorUI.classList.remove('hidden');
  errorMessage.textContent = msg;
  downloadBtn.disabled = false;
}

function resetForm() {
  urlInput.value = '';
  loadingUI.classList.add('hidden');
  errorUI.classList.add('hidden');
  successUI.classList.add('hidden');
}

function downloadVideo() {
  const url = urlInput.value.trim();
  if (!url) {
    const langPath = window.location.pathname.split('/')[1] || 'en';
    const t = TRANSLATIONS[langPath] || TRANSLATIONS['en'];
    showError(t.input_placeholder);
    return;
  }
  
  showLoading();

  // HTML Form 생성 및 전송
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/download';
  
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'url';
  input.value = url;
  
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);

  // 로딩 상태에서 사용자에게 진행 상황 알림 (아이폰/느린 프록시 대응)
  setTimeout(() => {
    const langPath = window.location.pathname.split('/')[1] || 'en';
    const t = TRANSLATIONS[langPath] || TRANSLATIONS['en'];
    showSuccess(t.started);
  }, 3000); // 3초 뒤 성공 멘트로 전환하여 심리적 안심 부여
}

downloadBtn.addEventListener('click', downloadVideo);
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') downloadVideo();
});

document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    button.parentElement.classList.toggle('active');
  });
});

initLanguage();
window.resetForm = resetForm;
