import { defineStore } from 'pinia'
import { memberApi } from '../api'

const TOKEN_KEY = 'mall_portal_token'
const HEAD_KEY = 'mall_portal_token_head'

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
        this.member = await memberApi.info()
      } catch {
        this.member = null
      }
    },
    logout() {
      this.token = ''
      this.member = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(HEAD_KEY)
    }
  }
})
