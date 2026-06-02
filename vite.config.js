import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 배포: Cloudflare Pages Function(functions/api/[[path]].js)이 /api/* 처리.
// 개발: VITE_API_URL 환경변수를 .env.local에 설정하면 Apps Script로 직접 연결.
//        없으면 api.js가 fallback 데이터를 반환한다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "127.0.0.1",
    // VITE_API_URL이 있으면 /api/* → Apps Script로 프록시(개발 전용)
    proxy: process.env.VITE_API_URL ? {
      "/api": {
        target: process.env.VITE_API_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    } : {},
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
});
