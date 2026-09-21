const path = require("path");

/**
 * Two independent Strapi workers behind nginx, which round-robins between them
 * and retries a refused connection on the other one — so a reload or a crash
 * costs latency rather than a 502.
 *
 * Deliberately fork mode rather than cluster. A cluster rolling reload spawns a
 * replacement worker before retiring the old one, which needs a third worker's
 * worth of memory (~270 MB each here), and it only helps during deploys. Two
 * separate processes never need that headroom and also cover one of them
 * simply dying.
 */
function worker(name, port) {
  return {
    name,

    // Run the Strapi binary directly instead of `yarn start`. The yarn wrapper
    // cost ~35 MB of resident memory per worker for nothing, and — the part
    // that actually mattered — PM2 signals the process it spawned, so SIGINT
    // went to yarn, which forwards signals unreliably. kill_timeout would
    // expire and the worker was killed mid-request instead of draining.
    script: "node_modules/@strapi/strapi/bin/strapi.js",
    args: "start",
    interpreter: "node",

    // Anchored to this file's own directory so PM2 doesn't depend on the
    // working directory it happened to be started from.
    cwd: __dirname,

    instances: 1,
    exec_mode: "fork",

    // wait_ready blocks until the app sends "ready", which src/index.ts emits
    // from the httpServer's `listening` event — so PM2 reports the worker
    // online only once it genuinely accepts connections, and a deploy never
    // moves on to the second worker while the first is still booting.
    wait_ready: true,
    listen_timeout: 30000,
    kill_timeout: 5000,

    env: {
      NODE_ENV: "production",
      PORT: port,
    },

    // Absolute: PM2 resolves relative log paths against the daemon's working
    // directory, not the app's.
    error_file: path.join(__dirname, "logs", `${name}-error.log`),
    out_file: path.join(__dirname, "logs", `${name}-out.log`),
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",

    max_restarts: 10,
    min_uptime: "10s",
  };
}

module.exports = {
  apps: [worker("strapi-app-1", 1337), worker("strapi-app-2", 1338)],
};
