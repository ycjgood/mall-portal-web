import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// C 端商城开发服务器：5174，避免与管理后台 5173 冲突
// 统一走 /api 前缀代理到 portal(8085)，前端代码里不出现后端主机名
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8085',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  }
})
