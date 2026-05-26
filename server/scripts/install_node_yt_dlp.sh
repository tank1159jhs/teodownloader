#!/bin/bash
# Ubuntu LTS 기준 설치 스크립트
set -e

# Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# ffmpeg
sudo apt-get update
sudo apt-get install -y ffmpeg

# nginx
sudo apt-get install -y nginx

# PM2
sudo npm install -g pm2

echo "✅ Node.js, yt-dlp, ffmpeg, nginx, PM2 설치 완료"
