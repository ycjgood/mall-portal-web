import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../stores/user'
import router from '../router'

/**
 * portal 统一返回 CommonResult: { code, message, data }
 * code === 200 为成功；401 为未登录/登录过期
 */
const request = axios.create({ baseURL: '/api', timeout: 15000 })

request.interceptors.request.use((config) => {
  const user = useUserStore()
  if (user.token) {
    config.headers.Authorization = user.tokenHead + user.token
  }
  // 下单幂等令牌由调用方通过 extraHeaders 传入，这里不统一处理
  return config
})

request.interceptors.response.use(
  (resp) => {
    const result = resp.data
    if (result.code === 200) {
      return result.data
    }
    if (result.code === 401) {
      const user = useUserStore()
      user.logout()
      ElMessage.warning('请先登录')
      router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
      return Promise.reject(new Error(result.message || '未登录'))
    }
    ElMessage.error(result.message || '请求失败')
    return Promise.reject(new Error(result.message))
  },
  (err) => {
    ElMessage.error(err.message || '网络异常')
    return Promise.reject(err)
  }
)

export default request as unknown as {
  get: (url: string, config?: object) => Promise<any>
  post: (url: string, data?: any, config?: object) => Promise<any>
}
