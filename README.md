# TEO Download Platform

TikTok, Instagram, YouTube 영상을 빠르고 안전하게 다운로드할 수 있는 웹 플랫폼입니다.

## 아키텍처

```
사용자
  ↓
Cloudflare (DNS, SSL, WAF, Rate Limit, Cache)
  ↓
AWS EC2 (Ubuntu + Node.js + yt-dlp + ffmpeg)
  ↓
Cloudflare R2 (임시 저장소 + Presigned URL)
  ↓
사용자 (Direct Download)
```

## 파일 구조

```
/TeoDownloader
  /server
    - server.js              # Express 서버 (모든 로직 포함)
    - package.json           # npm 의존성
    - ecosystem.config.js    # PM2 설정
    - .env.example           # 환경변수 예시
  /scripts
    - install_node_yt_dlp.sh # Ubuntu 설치 스크립트
  /nginx
    - default.conf           # Nginx 설정
  /frontend
    - index.html             # 메인 페이지 (SEO 최적화)
    - main.js                # 클라이언트 로직
    - style.css              # 스타일 (모바일 최적화)
  - README.md
  - OPERATIONS_GUIDE.md      # 운영 가이드
```

## 주요 기능

- ✅ TikTok/Instagram 영상 다운로드
- ✅ URL 검증 및 보안
- ✅ Rate limiting (IP 기준 1분 3회)
- ✅ Zero-Disk Streaming (서버 저장 없이 즉시 전송)
- ✅ SEO 최적화 (JSON-LD FAQ schema 포함)

## 빠른 시작

### 로컬 테스트 (macOS/Linux)

```bash
cd /Users/systemi/TeoDownloader
npm install --prefix server
cp server/.env.example server/.env
# .env 파일 수정 (S3 credentials 입력)
npm start --prefix server
# 브라우저: http://localhost:3000
```

### 프로덕션 배포 (Ubuntu EC2)

자세한 내용은 `OPERATIONS_GUIDE.md` 참조

## 보안 주의사항

- ✅ child_process.spawn 사용 (shell injection 방지)
- ✅ URL 호스트명 정확 검증
- ✅ Whitelist domain 체크
- ✅ 타임아웃 설정 (5분)
- ✅ Cache-Control: no-store 헤더
- ✅ 자동 임시 파일 정리

## 라이센스

MIT
