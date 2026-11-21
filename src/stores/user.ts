/**
 * 【模块职责】全站共享的会员身份卡。登录信息只需要存一份，顶栏、购物车、下单等各处都能读，
 * 不用每个页面各自去问后端。Pinia 可以简单理解为全站公用的一本记事本；
 * 因为 token 同时写进了浏览器 localStorage，刷新页面也不会立刻变回未登录。
 *
 * 【输入】login(用户名, 密码)；页面读取 isLogin、member、token。
 * 【输出】改写 token、tokenHead、member 三个状态并同步到 localStorage；调 /sso/login 与 /sso/info 两个接口。
 * 【执行流程】
 *   1) 刚打开网页时，state 先从 localStorage 把上次的 token 读回来，所以刷新后仍是登录态。
 *   2) login() 调 memberApi.login 拿到 { token, tokenHead }，存进状态和 localStorage，再 fetchInfo() 拉会员资料。
 *   3) logout() 清空内存里的状态和本地存储，顶栏随之变回登录与注册按钮。
 * 【关键变量/状态】
 *   - token：登录凭证字符串，request.ts 会把它放进 Authorization 头。
 *   - tokenHead：凭证前缀，通常是 Bearer 加空格，和 token 拼在一起用。
 *   - member：会员资料（用户名等），顶栏显示昵称就靠它；取不到时为 null。
 *   - isLogin：getter，本质是判断 token 非空，页面用它决定显示登录按钮还是用户名。
 * 【注意事项】
 *   1. 会员账号是 C 端商城自己的一套（如 test / 123456），和 5173 管理后台的账号体系不是一回事。
 *   2. fetchInfo() 失败会静默把 member 置空、不弹错，避免刚打开页面就报错打扰用户。
 *   3. 退出只清前端凭证；后端返回 401 时 request.ts 也会调这里的 logout() 保持一致。
 */
import { defineStore } from 'pinia'
import { memberApi } from '../api'

const TOKEN_KEY = 'mall_portal_token'
const HEAD_KEY = 'mall_portal_token_head'

// defineStore 建一个全站共用的用户记事本（Pinia）。state 里的数据在任意页面都能读和改，
// getters 是自动算出来的派生值，actions 是能调接口、能改 state 的方法
export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    tokenHead: localStorage.getItem(HEAD_KEY) || 'Bearer ',
    member: null as any
  }),
  getters: {
    isLogin: (s) => !!s.token
  },
  actions: {
    // 登录：调 /sso/login 拿回 { token, tokenHead } → 存进状态 → 写进 localStorage（刷新页面不丢）→
    // 紧接着 fetchInfo() 拉会员资料，顶栏才能显示用户名
    async login(username: string, password: string) {
      const data = await memberApi.login(username, password)
      // portal 返回 { token, tokenHead }
      this.token = data.token
      this.tokenHead = data.tokenHead
      localStorage.setItem(TOKEN_KEY, this.token)
      localStorage.setItem(HEAD_KEY, this.tokenHead)
      await this.fetchInfo()
    },
    async fetchInfo() {
      if (!this.token) return
      try {
        // GET /sso/info：用当前 token 拉会员资料；取不到就静默置空，不打扰用户
        this.member = await memberApi.info()
      } catch {
        this.member = null
      }
    },
    // 退出：清掉内存里的 token 和 member，同时删掉 localStorage，顶栏立刻变回登录与注册
    logout() {
      this.token = ''
      this.member = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(HEAD_KEY)
    }
  }
})
