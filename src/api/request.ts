/**
 * 【模块职责】所有后端请求的统一收发室。页面不直接发请求，都走这里，
 * 好处是三件重复的事只写一次：自动带上登录凭证、后端说没登录就自动跳登录页、
 * 把后端统一包装的 CommonResult 拆开只留业务数据。
 * 类比：像公司前台，每封信寄出前贴好工牌（token），回信先拆信封（解包）再交给收件人。
 *
 * 【输入】页面调用 request.get / request.post 时给的接口地址、参数，以及可选的请求头（例如下单用的 X-Order-Token）。
 * 【输出】页面里 await 到的直接就是业务数据 data，不用再写 .data.data；失败时弹错误提示并抛出异常。
 * 【执行流程】
 *   1) 发请求前：请求拦截器从 Pinia 用户仓库取 token，拼成 Authorization 头带上。
 *   2) 收响应后：响应拦截器看 code，等于 200 就把 result.data 直接返回；401 就清空登录态并跳登录页；其它码弹错误。
 *   3) 网络本身断了（超时、断网）走第二个回调，弹网络异常。
 * 【关键变量/状态】
 *   - request：axios 实例，baseURL 是 /api（由 vite 代理到后端 8085），超时 15 秒。
 *   - config.headers.Authorization：登录凭证，值等于 tokenHead 拼 token，默认以 Bearer 加空格开头。
 *   - router.currentRoute.value.fullPath：当前完整网址，跳登录时存进 redirect，登录后好回到原页面。
 * 【注意事项】
 *   1. 后端接口返回 CommonResult { code, message, data }，code 为 200 才算成功；这里已把 data 解包，页面别再取一层 .data。
 *   2. 401 会顺带执行 logout() 清掉本地 token，并带上 redirect 跳登录页；这是未登录需先登录的统一兜底。
 *   3. 下单的幂等令牌 X-Order-Token 不在这里统一加，由 OrderConfirmView 通过第三个参数 headers 单独传。
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../stores/user'
import router from '../router'

/**
 * portal 统一返回 CommonResult: { code, message, data }
 * code === 200 为成功；401 为未登录/登录过期
 */
// axios.create 造一个专属快递员：baseURL 写 /api，所有请求都会被 vite 代理转发到后端 8085，超时 15 秒。
// 拦截器就是给这个快递员定的收发规矩，写在下面两段。因为拦截器已经把 CommonResult 拆开返回 data，
// 文件末尾才用 as unknown as 手动声明 get/post 的签名，让页面里 await 到的直接是业务数据
const request = axios.create({ baseURL: '/api', timeout: 15000 })

// 请求拦截器 = 每封信寄出前都要过的一道手：从 Pinia 用户仓库取出登录凭证，
// 拼成 Authorization 头带上。这样页面里调接口时完全不用自己管 token
request.interceptors.request.use((config) => {
  const user = useUserStore()
  if (user.token) {
    config.headers.Authorization = user.tokenHead + user.token
  }
  // 下单幂等令牌由调用方通过 extraHeaders 传入，这里不统一处理
  return config
})

// 响应拦截器 = 回信先拆信封：后端统一包成 CommonResult { code, message, data }，
// 这里 code 等于 200 时只把 result.data 交回页面（所以页面里不用再写 .data.data）；
// 其它情况弹错误提示并抛异常，让调用方的 await 停下来
request.interceptors.response.use(
  (resp) => {
    const result = resp.data
    if (result.code === 200) {
      return result.data
    }
    // 401 = 没登录或登录过期：先 logout() 清掉本地凭证，弹提示，
    // 再带 redirect 跳登录页（记住当前完整网址，登录后能回来），最后抛异常中断本次请求
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
