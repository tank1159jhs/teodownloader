// main.js
const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const loadingUI = document.getElementById('loadingUI');
const errorUI = document.getElementById('errorUI');
const errorMessage = document.getElementById('errorMessage');
const successUI = document.getElementById('successUI');
const successFilename = document.getElementById('successFilename');
const downloadLink = document.getElementById('downloadLink');

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
  successFilename.textContent = filename;
  downloadLink.href = '#';
}

function resetForm() {
  urlInput.value = '';
  urlInput.focus();
  loadingUI.classList.add('hidden');
  errorUI.classList.add('hidden');
  successUI.classList.add('hidden');
}

function downloadVideo() {
  const url = urlInput.value.trim();
  if (!url) {
    showError('Please enter a valid TikTok, Instagram, or YouTube URL.');
    return;
  }
  showLoading();
  fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url })
  }).then(async (res) => {
    if (res.ok) {
      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.includes('attachment')) {
        const filenameMatch = disposition.match(/filename=\"?([^\";]+)\"?/);
        const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'video.mp4';
        const blob = await res.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(urlObj);
          document.body.removeChild(a);
        }, 100);
        showSuccess(filename);
      } else {
        showError('Download failed. Please try again.');
      }
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.message || 'Download failed. Please check the URL and try again.');
    }
  }).catch(() => {
    showError('Network error. Please try again.');
  });
}

downloadBtn.addEventListener('click', downloadVideo);
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') downloadVideo();
});

window.resetForm = resetForm;