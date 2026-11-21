/**
 * 【模块职责】全站共享的购物车小账本，主要服务于顶栏那个小红数字角标，
 * 顺带缓存一份购物车列表，免得每切一个页面都重新问后端要一遍。
 *
 * 【输入】无直接入参；由页面在加购、改数量、删除、登录后主动调 refresh() 重新拉取。
 * 【输出】更新 items（列表）与 count（角标数字）；调后端 /cart/list 接口。
 * 【执行流程】
 *   1) 页面加购或改数量成功后调 refresh()，向 /cart/list 要最新列表写进 items。
 *   2) count 是个 getter，自动把每件商品的 quantity 加起来，顶栏角标直接显示它。
 *   3) 退出登录时用 clearLocal() 把 items 清空，避免把上一个人的购物车显示给下一个人。
 * 【关键变量/状态】
 *   - items：购物车条目数组，每个条目含 price、quantity 等。
 *   - count：角标数量，等于所有条目数量之和（注意是件数，不是商品种类数）。
 *   - loaded：是否成功拉过一次，用于避免重复请求。
 * 【注意事项】
 *   1. refresh() 里把异常吞掉了：未登录时 request.ts 的 401 拦截器会统一跳登录页，这里不必再弹错。
 *   2. 结算用的选中商品 id 不存这里，而是由 CartView 暂存到 sessionStorage 的 mall_cart_ids。
 */
import { defineStore } from 'pinia'
import { cartApi } from '../api'

/** 购物车状态：顶栏角标数量 + 列表缓存，避免每页都拉一遍 */
export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as any[],
    loaded: false
  }),
  getters: {
    // count 是 getter：把每件商品的购买数量加起来，顶栏红点显示的总件数就是它。
    // reduce 可以理解成拿个空袋子，一行行把数量往里加；|| 0 是防某行没填 quantity
    count: (s) => s.items.reduce((n, it) => n + (it.quantity || 0), 0)
  },
  actions: {
    // 重新拉 /cart/list 覆盖本地缓存。谁改了购物车（加购、改数量、删除、登录）谁就该调它一次，
    // 顶栏角标才会跟着变。未登录时 401 已由 request.ts 统一处理，这里只需静默清空
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
