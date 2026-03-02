module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  // Optimize Vite build for low-resource VPS environments
  vite: {
    build: {
      // Disable minification for faster builds (admin panel, not critical for performance)
      minify: false,

      // Disable source maps (not needed in production)
      sourcemap: false,

      // Reduce chunk size warnings
      chunkSizeWarningLimit: 5000,

      // Optimize rollup for lower memory usage
      rollupOptions: {
        output: {
          // Reduce chunk splitting to lower memory usage
          manualChunks: undefined,
        },
      },
    },
  },
});
