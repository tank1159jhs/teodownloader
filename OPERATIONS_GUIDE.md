# TEO Downloader Operation Guide (OCI)

## 1. 인스턴스 정보
- OS: Oracle Linux 8 (RHEL 기반)
- 유저: `opc`
- IP: `158.101.152.9`
- 경로: `/var/www/app`

## 2. SSH 접속
```
ssh ubuntu@<EC2_PUBLIC_IP>
```

## 3. 설치 스크립트 실행
```
git clone <YOUR_REPO_URL>
cd TeoDownloader
chmod +x scripts/install_node_yt_dlp.sh
./scripts/install_node_yt_dlp.sh
```

## 4. npm install
```
cd server
npm install
```

## 5. .env 설정
- server/.env.example을 복사해 server/.env로 저장 후 값 입력

## 6. PM2 실행
```
pm run pm2:start
```

## 7. nginx 설정
```
sudo cp nginx/default.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl restart nginx
```

## 8. R2 생성
- Cloudflare 대시보드 → R2 → 버킷 생성
- API 토큰 발급 (S3 호환)
## 6. OCI 방화벽 설정 (Firewalld)
보안 리스트 외에 인스턴스 내부 방화벽을 열어줘야 합니다.
```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

## 9. Lifecycle Rule 설정
- R2 버킷 → Lifecycle → 1일 후 자동 삭제 규칙 추가

## 10. Cloudflare 연결
- 도메인 Cloudflare에 추가
## 7. Cloudflare 연결
- Proxy(구름 아이콘) ON

## 11. DNS 설정
- A 레코드: EC2 IP
- CNAME: 필요시 www 등

## 12. SSL 설정
- Cloudflare SSL/TLS → Full(Strict)

## 13. 브라우저 테스트
- https://<도메인> 접속
- 다운로드 정상 동작 확인
## 8. 운영/모니터링 팁

---

## 운영/모니터링 팁
- PM2 로그: `pm2 logs`
- yt-dlp 업데이트: `sudo yt-dlp -U`
- yt-dlp 자동 업데이트 (cron):
  - `crontab -e` 후 아래 추가
    ```
    0 4 * * * /usr/local/bin/yt-dlp -U
    ```
- 에러 Slack/Discord Webhook 연동: .env에 WEBHOOK_URL 입력
- 임시파일/디스크 부족 주의: EC2 /tmp 모니터링

---

## 비용/보안
- Cloudflare Rate Limit, WAF, Bot Protection 적극 활용
- 1분 3회 제한, 1GB 초과 차단, 동시 3개 제한
- 광고는 PropellerAds/Adsterra 코드만 삽입
- Google AdSense는 미포함

---

## 문의
- Contact: contact@example.com
