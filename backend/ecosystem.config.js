module.exports = {
  apps: [
    {
      name: 'pubscene',
      cwd: __dirname,
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      min_uptime: '5s',
      max_memory_restart: '300M',
      kill_timeout: 8000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
