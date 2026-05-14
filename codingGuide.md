TAEO Download Platform — Production-Oriented Final Prompt

나는 TikTok / Instagram / (선택적 YouTube) 영상 다운로드 웹 플랫폼을 만들고 싶다.

목표:
- 실제 운영 가능한 수준
- 다운로드 특화 UX
- SEO 친화 구조
- 광고 수익화 가능
- 비용 최적화
- Cloudflare 친화적
- MVP 이후 확장 가능
- 보안/안정성 고려

아래 요구사항을 모두 만족하는 형태로:
- 전체 코드
- frontend
- backend
- nginx
- PM2
- 설치 스크립트
- Cloudflare 설정
- R2/S3 설정
- 운영 가이드

를 작성해줘.

주의:
- 실제 실행 가능한 수준으로 작성
- pseudo code 금지
- placeholder 로직 최소화
- 과도한 엔터프라이즈 구조 금지
- MVP 기준 단순하지만 운영 가능한 수준 유지

============================================================
[서비스 방향]
============================================================

사이트는 “다운로드 특화 플랫폼” 형태로 구성한다.

스타일:
- Fast media downloader
- TikTok downloader
- Instagram reel saver
- Social video save tools

UI는:
- 깔끔함
- 모바일 최적화
- 빠른 UX
- 과도한 스팸 느낌 금지

다음 요소 포함:
- Hero section
- URL 입력창
- 다운로드 버튼
- 로딩 상태
- 에러 표시
- 간단한 FAQ
- Footer

============================================================
[광고 / 수익화]
============================================================

Google AdSense는 우선 제외.

광고 네트워크 고려:
- PropellerAds
- Adsterra

frontend에:
- 광고 placeholder 영역
- 상단 배너
- 다운로드 아래 광고
- Footer 광고

포함.

placeholder:
- YOUR_PROPELLERADS_CODE
- YOUR_ADSTERRA_CODE

팝업/강제 리다이렉트는 기본 비활성화.

============================================================
[타겟 국가]
============================================================

우선 타겟:
- 영어권
- 일본
- 한국

영어 우선 MVP.

============================================================
[플랫폼 전략]
============================================================

초기 MVP:
- TikTok 또는 Instagram 기준 우선 구현

YouTube는:
- optional/commented 형태로만 포함 가능
- 별도 서브도메인 분리 가능성 고려

예시:
- ttsave.example.com
- instasave.example.com
- yt.example.com

============================================================
[아키텍처]
============================================================

MVP 구조:

사용자
→ Cloudflare
→ AWS EC2 (Ubuntu + Node.js + yt-dlp)
→ Cloudflare R2
→ Cloudflare CDN
→ 사용자

R2 우선 권장.
S3 호환 API 기반 구현.

역할:
- Cloudflare:
  - DNS
  - SSL
  - Proxy
  - WAF
  - Rate limit
  - Cache
- EC2:
  - Node.js API 서버
  - yt-dlp 실행
  - ffmpeg merge
  - 업로드 처리
- R2:
  - 임시 저장
  - presigned URL 제공

============================================================
[파일 구조]
============================================================

초기 MVP 기준 최소 파일 구조 유지:

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
  style.css

추가 파일은 꼭 필요한 경우만 허용.
과도한 파일 분리 금지.

server.js 내부에:
- Express 서버
- validation
- yt-dlp 실행
- upload
- presigned URL 생성
- rate limit
- cleanup

포함.

============================================================
[Frontend]
============================================================

index.html:
- 단일 페이지
- 모바일 최적화
- SEO meta tags 포함
- OpenGraph 포함
- favicon placeholder 포함

구성:
- Hero
- URL 입력
- Download 버튼
- Loading UI
- Error UI
- FAQ
- Footer

Footer:
- Privacy Policy placeholder
- Terms placeholder
- Contact placeholder

저작권 안내 문구 포함:
“사용 권한이 있는 콘텐츠만 다운로드해야 함”

main.js:
- POST /download
- loading 처리
- timeout 처리
- 에러 처리
- presigned URL 수신 후 새 탭 다운로드

style.css:
- 가볍고 심플한 스타일
- 모바일 우선 반응형

============================================================
[Backend — Node.js / Express]
============================================================

POST /download

body:
{
  "url": "https://..."
}

동작 순서:

1. URL validation
2. hostname 정확 검증
3. whitelist domain 체크
4. yt-dlp --dump-json 실행
5. filesize/filesize_approx 확인
6. 1GB 이상 차단
7. yt-dlp 다운로드
8. ffmpeg merge
9. R2 업로드
10. presigned URL 생성
11. 응답 반환
12. finally cleanup

============================================================
[보안 요구사항]
============================================================

반드시 구현:

- child_process.spawn 사용
- exec 사용 금지
- shell interpolation 금지
- express trust proxy 설정
- CF-Connecting-IP 기반 rate limit
- IP 기준 1분 3회 제한
- hostname 정확 검증
- Cache-Control: no-store
- finally cleanup

hostname 검증 예시:
- hostname === "tiktok.com"
- hostname.endsWith(".tiktok.com")

============================================================
[yt-dlp 요구사항]
============================================================

다운로드 포맷:
-f "bv*+ba/b"

다운로드 위치:
- /tmp/{randomId}.{ext}

timeout:
- 5분

동시 작업 제한:
- 최대 2~3개

초과 시:
- HTTP 429 반환

============================================================
[Proxy / IP 차단 대응]
============================================================

중요:
TikTok / Instagram은 반복 요청 시:
- rate limit
- anti-bot
- IP 차단

가능성이 있다.

따라서:
- proxy 미사용 상태에서도 동작 가능
- 향후 rotating proxy 연동 가능
- HTTP proxy / SOCKS proxy 지원 가능 구조

로 작성.

환경변수 예시:
YTDLP_PROXY=http://...
또는
socks5://...

또한:
- IP 차단 감지 시 graceful error 반환
- retry 전략 간단히 설명

============================================================
[R2 / S3]
============================================================

환경변수:

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
S3_BUCKET_NAME
S3_ENDPOINT

Cloudflare R2 우선 권장.

사용 SDK:
- @aws-sdk/client-s3
- @aws-sdk/s3-request-presigner

stream 기반 업로드 사용:
- fs.createReadStream

presigned URL:
- expiresIn: 600

Lifecycle Rule 설명 포함:
- 1일 후 자동 삭제

가능하면:
- EC2 직접 파일 전달 대신
- R2 direct download 방식 사용

============================================================
[로그 / 모니터링]
============================================================

실제 운영 시 발생 가능한:
- yt-dlp 실패
- 플랫폼 구조 변경
- IP 차단
- ffmpeg timeout
- proxy 실패
- R2 업로드 실패
- tmp 디스크 부족

등을 고려하여:

- 기본 로그 전략
- PM2 로그 관리
- 에러 로그 출력 방식
- 간단한 모니터링 전략
- Discord/Slack webhook 알림 예시
- yt-dlp 업데이트 전략

도 간단히 설명.

yt-dlp 자동 업데이트 예시:
- yt-dlp -U
- cron 예시 포함

============================================================
[설치 스크립트]
============================================================

install_node_yt_dlp.sh 포함:

- Node.js LTS
- yt-dlp
- ffmpeg
- nginx
- PM2

Ubuntu LTS 기준.

============================================================
[npm 패키지]
============================================================

npm install:

express
cors
dotenv
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner

전역:
npm install -g pm2

============================================================
[PM2]
============================================================

ecosystem.config.js 포함:
- production mode
- auto restart
- memory limit

============================================================
[nginx]
============================================================

default.conf 작성:

- reverse proxy
- static frontend
- proxy_read_timeout 300
- client_max_body_size 10M
- no-store header
- Cloudflare 고려

SSL은 Cloudflare 처리.

============================================================
[Cloudflare]
============================================================

설명 포함:
- DNS 연결
- Proxy ON
- SSL Full(Strict)
- WAF 추천
- Rate limit 추천
- cache rule
- /download no-cache

============================================================
[SEO]
============================================================

기본 SEO 포함:
- title
- description
- canonical
- OpenGraph
- Twitter Card

FAQ schema(JSON-LD) 포함.

다운로드 키워드 SEO 고려:
- TikTok downloader
- save TikTok videos
- Instagram reel downloader
- no watermark

============================================================
[운영 비용 보호]
============================================================

비정상적인 대량 다운로드 방지를 위해:
- rate limit
- concurrent job 제한
- timeout
- filesize 제한
- Cloudflare bot protection

포함.

============================================================
[단계별 운영 가이드]
============================================================

반드시 설명:

1. EC2 생성
2. SSH 접속
3. 설치 스크립트 실행
4. npm install
5. .env 설정
6. PM2 실행
7. nginx 설정
8. R2 생성
9. Lifecycle Rule 설정
10. Cloudflare 연결
11. DNS 설정
12. SSL 설정
13. 브라우저 테스트

============================================================
[최종 출력 방식]
============================================================

한 번에 너무 긴 출력이 되지 않도록:

1단계:
- 아키텍처 설명
- 파일 구조

2단계:
- server.js

3단계:
- frontend

4단계:
- nginx / PM2 / scripts

5단계:
- 운영 가이드

순서로 나누어 출력.

실제 운영 가능한 수준으로 작성.
placeholder 코드 최소화.
불필요한 추상화 금지.