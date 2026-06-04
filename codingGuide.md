# TEO Download Platform — Production-Ready Specification

## 1. 프로젝트 목표
- 실제 운영 가능한 수준
- 다운로드 특화 UX
- SEO 친화 구조
- 광고 수익화 가능
- 비용 최적화
- 보안/안정성 고려
- 다국어(i18n) 대응 및 SEO 최적화

## 2. 서비스 및 UI/UX 전략
- **서비스 성격**: Fast media downloader (TikTok, Instagram, YouTube)
- Fast media downloader
- TikTok downloader
- Instagram reel saver
- Social video save tools
- **UI 구성**: 모바일 최적화, Clean UX (과도한 광고 지양)
  - Hero, URL Input, Download Button, Progress UI, FAQ, Legal Notice
- **수익화**: PropellerAds, Adsterra (Placeholder: `YOUR_PROPELLERADS_CODE`, `YOUR_ADSTERRA_CODE`)

## 3. 기술 아키텍처

### Infrastructure
- Security: Local Firewalld, Nginx Reverse Proxy
- Compute: Oracle Cloud OCI (Oracle Linux 8)
- **Storage**: No local storage (Direct stream via stdout pipe)
- **Stack**: Node.js (Express), yt-dlp, ffmpeg, Nginx, PM2

### 파일 구조
/server
  server.js
  package.json
  ecosystem.config.js
  .env.example

/scripts
  install_node_yt_dlp.sh

/nginx
  default.conf

/frontend
  index.html
  main.js
  translations.json
  style.css

## 4. 상세 구현 요구사항

### Backend (Node.js)
- **보안**: `child_process.spawn` 필수 사용 (exec 금지), Shell Interpolation 방지
- **Rate Limit**: IP당 1분 3회 제한 (Cloudflare IP 기준)
- **Validation**: Whitelist 기반 Hostname 검증 (`tiktok.com`, `instagram.com`, `youtube.com`)
- **yt-dlp**: 1GB 제한, 5분 타임아웃, 동시 작업 3개 제한
- **Streaming**: `stdout` 파이프 방식을 통한 제로-디스크(Zero-disk) 다운로드 구현

### Frontend
- **SEO**: Title, Meta, OpenGraph, Twitter Card, FAQ Schema(JSON-LD)
- **i18n**: URL 경로 기반 다국어 대응 (`/en`, `/ko`, `/ja`), 브라우저 언어 감지 자동 리다이렉트 (`hreflang` 적용)
- **UX**: 직접 파일 다운로드 트리거, 로딩 상태 표시
- **Data Management**: `translations.json` 비동기 로드 및 `data-i18n` 속성을 활용한 동적 텍스트 치환

### Infrastructure & Ops
- **Nginx**: Reverse proxy, `client_max_body_size 10M`, `no-store` 헤더
- **Cron**: `yt-dlp -U` 매일 자동 업데이트 설정

## 5. 실행 및 가이드 구성
1. **Architecture & File Structure**: 전체 설계도
2. **Backend**: `server.js` (핵심 로직)
3. **Frontend**: UI 및 연동 스크립트
4. **Infra & Scripts**: Nginx, PM2, Install Script
5. **Operation Guide**: 클라우드 설정부터 배포까지 단계별 안내