/**
 * 【模块职责】后端接口的通讯录。把一个个网址（/sso/login、/cart/add 等）收拢成好记的方法，
 * 页面里写 memberApi.login(...) 就行，不用到处拼字符串。类比：像电话簿，找人不用背号码。
 *
 * 【输入】各方法需要的业务参数：账号密码、商品 id、购物车 id 数组、分页页码、下单参数等。
 * 【输出】全部返回 Promise，兑现后是后端 CommonResult 里的 data（已由 request.ts 解包）。
 * 【执行流程】1) 页面调用某个 xxxApi.yyy() 2) 这里拼好 url、params、headers 交给 request 3) 拦截器统一处理后把数据交回页面。
 * 【关键变量/状态】
 *   - memberApi / homeApi / seckillApi / productApi / cartApi / orderApi / addressApi：按后端 Controller 分好的七组接口。
 *   - SeckillSessionDetail：秒杀场次的数据类型，注意场次时间是 HH:mm:ss 字符串，不是时间戳。
 *   - request：底层收发室，见 request.ts。
 * 【注意事项】
 *   1. 登录、注册等 /sso 接口把参数放在 URL 查询串（params）里，而不是请求体；这是后端 mall-portal 的约定，别改成 body。
 *   2. 加购 /cart/add 必须带商品快照（名称、图片、价格、规格），后端不会回查商品表。
 *   3. 下单要两步：先 GET /order/token 拿一次性令牌，再 POST /order/generateOrder 时把令牌放进 X-Order-Token 头，防止重复下单。
 *   4. 购物车批量接口（list/promotion、delete）的 id 数组要用逗号拼成字符串传，不是直接发 JSON 数组。
 */
// 各模块接口定义：与 mall-portal 的 Controller 一一对应
// ★ 例外：AI 智能问答是 SSE 流式长连接，不能用这里的 axios，见 ./chat.ts（走 /chat 代理到 8086）
import request from './request'

// ---------- 会员 /sso ----------
export const memberApi = {
  // POST /sso/login：账号密码走 URL 查询串（params）而不是请求体，这是后端 mall-portal 的规定；
  // 成功后返回 { token, tokenHead }，由 user 仓库保存
  login: (username: string, password: string) =>
    request.post('/sso/login', null, { params: { username, password } }),
  register: (username: string, password: string, telephone: string, authCode: string) =>
    request.post('/sso/register', null, { params: { username, password, telephone, authCode } }),
  // 验证码为模拟发送，直接从返回里取（真实短信未接入）
  getAuthCode: (telephone: string) => request.get('/sso/getAuthCode', { params: { telephone } }),
  info: () => request.get('/sso/info')
}

// ---------- 首页 /home ----------
export const homeApi = {
  content: () => request.get('/home/content'),
  hotProductList: (pageNum = 1, pageSize = 6) =>
    request.get('/home/hotProductList', { params: { pageNum, pageSize } }),
  newProductList: (pageNum = 1, pageSize = 6) =>
    request.get('/home/newProductList', { params: { pageNum, pageSize } })
}

// ---------- 秒杀 /seckill ----------
export interface SeckillSessionDetail {
  id: number
  name: string
  startTimeStr: string
  endTimeStr: string
  status: number
  productList: any[]
}

export const seckillApi = {
  // GET /seckill/sessions：取秒杀活动与场次列表。注意场次的开始、结束时间是 HH:mm:ss 字符串
  // （不是时间戳），页面 SeckillView 会自己按冒号拆成时分秒再换算比较
  sessions: () => request.get('/seckill/sessions')
}

// ---------- 商品 /product ----------
export const productApi = {
  search: (params: { keyword?: string; pageNum?: number; pageSize?: number; sort?: number }) =>
    request.get('/product/search', { params }),
  detail: (id: number | string) => request.get(`/product/detail/${id}`),
  categoryTreeList: () => request.get('/product/categoryTreeList')
}

// ---------- 购物车 /cart ----------
export const cartApi = {
  // POST /cart/add：后端不会回查商品表，所以名称、图片、价格、规格这些商品快照要前端一起传，
  // 否则购物车列表会显示空白。productSkuId 也要给，用来区分同一商品的不同规格
  add: (cartItem: {
    productId: number
    productSkuId: number
    quantity: number
    price?: number
    productName?: string
    productPic?: string
    productAttr?: string
  }) => request.post('/cart/add', cartItem),
  list: () => request.get('/cart/list'),
  listPromotion: (cartIds: number[]) =>
    request.get('/cart/list/promotion', { params: { cartIds: cartIds.join(',') } }),
  updateQuantity: (id: number, quantity: number) =>
    request.get('/cart/update/quantity', { params: { id, quantity } }),
  delete: (ids: number[]) => request.post('/cart/delete', null, { params: { ids: ids.join(',') } }),
  clear: () => request.post('/cart/clear')
}

// ---------- 订单 /order ----------
export const orderApi = {
  generateConfirmOrder: (cartIds: number[]) =>
    request.post('/order/generateConfirmOrder', cartIds),
  // 幂等令牌：提交订单前先取，生成订单时通过 X-Order-Token 头携带
  token: () => request.get('/order/token'),
  // POST /order/generateOrder：下单接口。orderParam 是确认页组装的订单参数，
  // orderToken 必须放进 X-Order-Token 头（幂等令牌，见 OrderConfirmView），漏带会被后端挡下
  generateOrder: (orderParam: object, orderToken: string) =>
    request.post('/order/generateOrder', orderParam, {
      headers: { 'X-Order-Token': orderToken }
    }),
  list: (params: { status?: number; pageNum?: number; pageSize?: number }) =>
    request.get('/order/list', { params }),
  detail: (orderId: number | string) => request.get(`/order/detail/${orderId}`),
  cancelUserOrder: (orderId: number) => request.post('/order/cancelUserOrder', null, { params: { orderId } }),
  confirmReceiveOrder: (orderId: number) => request.post('/order/confirmReceiveOrder', null, { params: { orderId } }),
  // 模拟支付：真实支付网关是占位实现，用 paySuccess 走完状态流转
  paySuccessMock: (orderId: number) => request.post('/order/paySuccess', null, { params: { orderId, payType: 0 } })
}

// ---------- 地址 /member/address ----------
export const addressApi = {
  list: () => request.get('/member/address/list'),
  add: (addr: object) => request.post('/member/address/add', addr),
  delete: (id: number) => request.post('/member/address/delete', null, { params: { id } })
}
