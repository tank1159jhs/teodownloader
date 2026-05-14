export default {
  apps: [
    {
      name: 'taeo-downloader',
      script: './server/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 메모리 제한 (1GB)
      max_memory_restart: '1G',
      // 자동 재시작
      autorestart: true,
      // 크래시 시 5초 대기 후 재시작
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
      // 로그 설정
      output: './logs/out.log',
      error: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 실행 전 정리
      kill_timeout: 5000,
    },
  ],
};
