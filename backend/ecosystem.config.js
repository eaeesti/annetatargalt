module.exports = {
  apps: [
    {
      name: "strapi-app-1",
      script: "yarn",
      args: "start",
      instances: 1,
      exec_mode: "fork",

      // Zero-downtime reload configuration
      wait_ready: true,              // Wait for ready signal before considering app online
      listen_timeout: 30000,         // Wait up to 30s for ready signal (Strapi can be slow)
      kill_timeout: 5000,            // Wait 5s before force-killing old instance

      // Environment
      env: {
        NODE_ENV: "production",
        PORT: 1337,
      },

      // Logging (relative to cwd)
      error_file: "./logs/strapi-app-1-error.log",
      out_file: "./logs/strapi-app-1-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Auto-restart configuration
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "strapi-app-2",
      script: "yarn",
      args: "start",
      instances: 1,
      exec_mode: "fork",

      // Zero-downtime reload configuration
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 5000,

      // Environment (different port)
      env: {
        NODE_ENV: "production",
        PORT: 1338,
      },

      // Logging (relative to cwd)
      error_file: "./logs/strapi-app-2-error.log",
      out_file: "./logs/strapi-app-2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Auto-restart configuration
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
