// main.js
let TRANSLATIONS = {};

/**
 * 브라우저 언어를 감지하여 적절한 경로로 리다이렉트합니다.
 * 예: / 에 접속 시 한국어 사용자는 /ko 로 이동
 */
async function initI18n() {
  const pathParts = window.location.pathname.split('/');
  let path = pathParts[1];

  try {
    const response = await fetch('/translations.json');
    TRANSLATIONS = await response.json();
  } catch (error) {
    console.error('Failed to load translations:', error);
    return 'en';
  }

  // 루트 경로(/) 접속 시 브라우저 언어 감지 후 리다이렉트
  if (!path || path === '') {
    const browserLang = navigator.language.split('-')[0];
    const targetLang = TRANSLATIONS[browserLang] ? browserLang : 'en';
    window.location.replace(`/${targetLang}`);
    return targetLang;
  }

  const lang = TRANSLATIONS[path] ? path : 'en';
  const t = TRANSLATIONS[lang];

  // 타이틀 및 메타태그 변경
  document.title = t.page_title;
  const metaDesc = document.getElementById('metaDescription');
  if (metaDesc) metaDesc.setAttribute('content', t.meta_desc);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      // HTML 태그가 포함된 경우(예: legal_notice) innerHTML 사용
      if (key.includes('notice') || key.includes('a') || key.includes('legal')) {
        el.innerHTML = t[key];
      } else {
        el.textContent = t[key];
      }
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });

  // 언어 선택기 동기화
  const langSelect = document.getElementById('langSelect');
  if (langSelect) langSelect.value = lang;

  return lang;
}

// 언어 선택기 이벤트 바인딩
document.getElementById('langSelect')?.addEventListener('change', (e) => {
  window.location.href = `/${e.target.value}`;
});

initI18n().catch(console.error);

const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const loadingUI = document.getElementById('loadingUI');
const errorUI = document.getElementById('errorUI');
const errorMessage = document.getElementById('errorMessage');
const successFilename = document.getElementById('successFilename');
const successUI = document.getElementById('successUI'); // successUI는 여전히 필요

function showLoading() {
  loadingUI.classList.remove('hidden');
  errorUI.classList.add('hidden');
  successUI.classList.add('hidden');
}

function showError(msg) {
  loadingUI.classList.add('hidden');
  errorUI.classList.remove('hidden');
  errorMessage.textContent = msg;
  successUI.classList.add('hidden');
}

function showSuccess(filename) {
  loadingUI.classList.add('hidden');
  errorUI.classList.add('hidden');
  successUI.classList.remove('hidden');
  successFilename.textContent = filename; // 파일명만 표시
}

function resetForm() {
  urlInput.value = '';
  urlInput.focus();
  loadingUI.classList.add('hidden');
  errorUI.classList.add('hidden');
  successUI.classList.add('hidden');
}

function openAdPage() {
  // Monetag 또는 Adsterra에서 발급받은 Smartlink/Direct Link URL
  const SMARTLINK_URL = 'https://omg10.com/4/11046155'; 
  
  // 새 탭으로 광고 실행
  const adWindow = window.open(SMARTLINK_URL, '_blank');
  
  // 팝업 차단 방지 및 포커스 유지 로직 (필요 시)
  if (adWindow) {
    adWindow.blur();
    window.focus();
  }
}

function downloadVideo() {
  const url = urlInput.value.trim();
  if (!url) {
    const langPath = window.location.pathname.split('/')[1];
    const t = TRANSLATIONS[langPath] || TRANSLATIONS['en'];
    showError(t.input_placeholder);
    return;
  }
  showLoading();

  // 수익 극대화 전략: 
  // 1. 처음 클릭 시 무조건 Smartlink 실행 (가장 수익이 높음)
  // 2. 이후 30분 동안은 광고 없이 서비스만 제공 (사용자 유지)
  const lastAdTime = localStorage.getItem('last_ad_time');
  const now = Date.now();
  
  if (!lastAdTime || (now - lastAdTime > 30 * 60 * 1000)) { // 30분 쿨타임
    openAdPage();
    localStorage.setItem('last_ad_time', now);
  }

  // HTML Form을 동적으로 생성하여 POST 전송 (브라우저 네이티브 다운로드 트리거)
  // 이 방식은 브라우저의 다운로드 표시줄이 즉시 나타납니다.
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

  // 폼 제출 후에는 서버 응답을 직접 기다릴 수 없으므로 잠시 후 로딩을 해제하거나
  // 메시지를 보여줍니다.
  setTimeout(() => {
    const pathParts = window.location.pathname.split('/');
    const lang = (TRANSLATIONS && TRANSLATIONS[pathParts[1]]) ? pathParts[1] : 'en';
    const t = TRANSLATIONS[lang];
    showSuccess(t.started);
  }, 2000);
}

downloadBtn.addEventListener('click', downloadVideo);
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') downloadVideo();
});

// FAQ 토글 로직 추가
document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const faqItem = button.parentElement;
    faqItem.classList.toggle('active');
  });
});

window.resetForm = resetForm;