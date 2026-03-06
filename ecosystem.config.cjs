// PM2 Production Ecosystem Config
// Usage: pm2 start ecosystem.config.cjs --env production

module.exports = {
  apps: [
    {
      name: "ica-crm",
      script: "dist/index.cjs",
      instances: "max",          // Use all CPU cores (cluster mode)
      exec_mode: "cluster",
      max_memory_restart: "500M",
      restart_delay: 3000,
      max_restarts: 10,
      watch: false,
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      // Structured log output
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/ica-crm/error.log",
      out_file: "/var/log/ica-crm/out.log",
      merge_logs: true,
    },
  ],
};
