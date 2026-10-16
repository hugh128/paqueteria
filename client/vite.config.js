import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY || 'http://192.168.56.10:3000';
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: { '/api': { target, changeOrigin: true, secure: false } },
    },
  };
});
