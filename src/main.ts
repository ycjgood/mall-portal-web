/**
 * 【模块职责】整个前端的"总开关"。浏览器打开商城时，最先执行的就是这个文件：
 * 它把 App.vue 这个根组件、路由（决定网址对应哪个页面）、Pinia（全站共享数据的仓库）、
 * Element Plus（现成的按钮、表格等界面组件库）装到一起，最后挂到 index.html 里那个 id 为 app 的空容器上。
 * 类比：像开一家店，先把店面搭起来、通水通电（装插件），再开门营业（mount）。
 *
 * 【输入】没有用户输入，也不收参数。它只读取 App.vue、router、全局样式这几个固定文件。
 * 【输出】一个跑起来的 Vue 应用；之后用户在页面上看到的一切都从这里开始。
 * 【执行流程】
 *   1) createApp(App) 造出一个"应用实例"，相当于还没开门的空店面。
 *   2) app.use(...) 依次装 Pinia、路由、Element Plus；顺序有讲究，路由和仓库要先用 use 装好，页面里才能取到。
 *   3) app.mount('#app') 把应用显示到网页上，页面正式可见。
 * 【关键变量/状态】
 *   - app：唯一的应用实例，后面所有 use / mount 都挂在它身上。
 *   - createPinia()：全局数据仓库，登录信息、购物车角标都放这里（Pinia 可理解为"全站公用的一本记事本"）。
 *   - router：网址与页面的对照表，来自 src/router/index.ts。
 * 【注意事项】
 *   1. 这里只做装配，别写业务逻辑；要改页面请去 src/views 下对应文件。
 *   2. global.css 在这里引入一次就能全站生效，不必每个页面重复引入。
 *   3. 后端接口统一返回 CommonResult { code, message, data }，拆包动作在 src/api/request.ts 里完成，页面拿到的已是 data。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import './styles/global.css'

// createApp 先造出一个应用实例（相当于还没开门的店铺），后面所有插件都装在它身上
const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
// mount 把整应用挂到 index.html 里那个 id 为 app 的空 div 上，这一步之后页面才真正显示出来
app.mount('#app')
