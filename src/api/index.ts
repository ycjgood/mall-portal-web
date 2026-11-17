// 各模块接口定义：与 mall-portal 的 Controller 一一对应
import request from './request'

// ---------- 会员 /sso ----------
export const memberApi = {
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
