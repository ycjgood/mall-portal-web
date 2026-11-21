/**
 * 【模块职责】开发时的服务器设置，只在本地跑项目时生效，不会打包进线上页面。
 * 它做两件事：让 .vue 单文件组件能被编译、把 /api 开头的请求转发给后端。
 * 类比：像前台转接电话，前端只拨 /api/xxx，总机自动接到后端的分机。
 *
 * 【输入】无用户入参；读取的是这份配置本身（端口、代理目标）。
 * 【输出】启动在 5174 端口的开发服务器；把 /api/xxx 转发成后端 8085 端口的 /xxx。
 * 【执行流程】
 *   1) plugins 里的 vue() 让 Vite 认识 .vue 文件。
 *   2) server.port 设为 5174，特意避开管理后台前端的 5173，两个前端可以同时开着。
 *   3) 代理规则：请求路径以 /api 开头，去掉 /api 前缀后转给 mall-portal 的 8085 端口。
 * 【关键变量/状态】
 *   - port 5174：C 端商城前端端口。
 *   - target http://localhost:8085：后端 mall-portal 地址。
 *   - rewrite：把 /api/cart/list 改写成 /cart/list，因为后端接口本身不带 /api。
 * 【注意事项】
 *   1. 前端代码里只写 /api/xxx，不要写 localhost:8085；换部署环境时只改这里一处即可。
 *   2. changeOrigin 让后端看到的请求来源像是同源，避免被跨域或来源校验挡住。
 *   3. 后端另有一个 AI 问答服务 mall-chat（8086，SSE 接口 /chat/ask），这份代理没有转发它，前端也尚未接入对话面板。
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// C 端商城开发服务器：5174，避免与管理后台 5173 冲突
// 统一走 /api 前缀代理到 portal(8085)，前端代码里不出现后端主机名
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    // 代理（转发）：前端一律请求 /api/xxx，这里把 /api 去掉后转给后端 8085，
    // 好处是前端代码里不写后端地址，也绕开浏览器跨域限制
    proxy: {
      // 只拦截 /api 开头的请求；target 是后端 mall-portal 的 8085 端口
      '/api': {
        target: 'http://localhost:8085',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  }
})
