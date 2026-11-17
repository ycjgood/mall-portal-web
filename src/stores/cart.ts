import { defineStore } from 'pinia'
import { cartApi } from '../api'

/** 购物车状态：顶栏角标数量 + 列表缓存，避免每页都拉一遍 */
export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as any[],
    loaded: false
  }),
  getters: {
    count: (s) => s.items.reduce((n, it) => n + (it.quantity || 0), 0)
  },
  actions: {
    async refresh() {
      try {
        this.items = (await cartApi.list()) || []
        this.loaded = true
      } catch {
        // 未登录时由 request 拦截器统一跳登录页，这里吞掉异常避免控制台噪音
        this.items = []
      }
    },
    clearLocal() {
      this.items = []
      this.loaded = false
    }
  }
})
