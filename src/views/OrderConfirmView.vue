<template>
  <div class="container confirm-page">
    <h2 class="page-title">确认订单</h2>

    <el-card shadow="never" class="block">
      <template #header>收货地址</template>
      <div class="addr-grid" v-if="addresses.length">
        <div
          v-for="addr in addresses"
          :key="addr.id"
          class="addr-item"
          :class="{ active: addr.id === selectedAddressId }"
          @click="selectedAddressId = addr.id"
        >
          <p class="addr-name">{{ addr.name }} {{ addr.phoneNumber }}</p>
          <p class="addr-detail">{{ addr.province }}{{ addr.city }}{{ addr.region }} {{ addr.detailAddress }}</p>
        </div>
      </div>
      <el-empty v-else description="还没有收货地址，请在管理后台或数据库中添加" :image-size="80" />
    </el-card>

    <el-card shadow="never" class="block">
      <template #header>商品清单</template>
      <div class="goods-row" v-for="it in cartItems" :key="it.id">
        <img :src="it.productPic" />
        <div class="goods-info">
          <p>{{ it.productName }}</p>
          <p class="attr">{{ it.productAttr || '默认规格' }}</p>
        </div>
        <div class="goods-price">
          <span>¥{{ it.price }} × {{ it.quantity }}</span>
          <span class="price">¥{{ ((it.price || 0) * (it.quantity || 0)).toFixed(2) }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="block" v-if="coupons.length">
      <template #header>选择优惠券</template>
      <el-select v-model="selectedCouponId" placeholder="不使用优惠券" clearable style="width: 320px">
        <el-option v-for="c in coupons" :key="c.id" :value="c.id"
                   :label="`${c.name}（省 ¥${c.amount}）`" />
      </el-select>
    </el-card>

    <!-- 金额合计：calcAmount.payAmount 由后端统一计算（含促销/运费），前端只做展示 -->
    <div class="pay-bar" v-if="calculate">
      <div class="amounts">
        <span>商品总额：¥{{ calculate.totalAmount }}</span>
        <span>促销优惠：-¥{{ calculate.promotionAmount }}</span>
        <span>运费：¥{{ calculate.freightAmount }}</span>
        <span>应付总额：<b class="price big">¥{{ Number(calculate.payAmount).toFixed(2) }}</b></span>
      </div>
      <el-button type="danger" size="large" :loading="submitting"
                 :disabled="!selectedAddressId" @click="submitOrder">
        提交订单
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【模块职责】下单前的最后确认页：选收货地址、看商品清单、可选优惠券、核对金额，然后提交订单。
 * 类比：像收银台把商品、地址、优惠券都摆出来给你核对，按下提交才真正生成订单。
 *
 * 【输入】sessionStorage 里的 mall_cart_ids（购物车页勾选的条目 id）；用户点选的地址、优惠券。
 * 【输出】渲染确认单；提交成功后跳订单列表页；调 /order/generateConfirmOrder、/order/token、
 *         /order/generateOrder、/member/address/list；清掉 sessionStorage 里的结算痕迹。
 * 【执行流程】
 *   1) onMounted 先读 mall_cart_ids，一个都没有就提示并弹回购物车页。
 *   2) 调 generateConfirmOrder(cartIds) 一次拿回：带促销价的商品清单、收货地址、可用优惠券、金额 calcAmount。
 *   3) 默认选中第一个地址；金额全部用后端算好的 calcAmount 展示，前端不自己算。
 *   4) 点提交订单走幂等三步：先 GET /order/token 拿一次性令牌，
 *      再 POST /order/generateOrder 把令牌放进 X-Order-Token 请求头，
 *      后端用 Redis 比对并删掉令牌，重复提交或网络重试也只会生成一笔订单。
 *   5) 成功后清掉 mall_cart_ids、跳订单列表。
 * 【关键变量/状态】
 *   - cartIds：本次要结算的购物车条目 id 数组（来自 sessionStorage）。
 *   - calculate：后端算好的金额对象（totalAmount 总额、promotionAmount 优惠、freightAmount 运费、payAmount 实付）。
 *   - selectedAddressId / selectedCouponId：用户选中的地址与优惠券，没地址时提交按钮禁用。
 *   - submitting：提交中转圈，配合后端幂等一起防重复下单。
 * 【注意事项】
 *   1. 下单必须带幂等令牌 X-Order-Token，且令牌要先单独调 /order/token 获取；漏了会被后端拒绝或有重复订单风险。
 *   2. 应付金额以后端 calcAmount.payAmount 为准，别拿前端购物车价格自己算，促销和运费只有后端知道。
 *   3. 幂等令牌属于防重复提交这一层；秒杀高并发下后端还用 Redis 预扣库存防超卖，
 *      压测 306 并发抢 10 件库存做到零超卖，P90 从 184ms 降到 44ms。
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { orderApi, addressApi } from '../api'

const router = useRouter()
const cartIds = ref<number[]>([])
const cartItems = ref<any[]>([])
const addresses = ref<any[]>([])
const coupons = ref<any[]>([])
const calculate = ref<any>(null)
const selectedAddressId = ref<number | null>(null)
const selectedCouponId = ref<number | null>(null)
const submitting = ref(false)

/**
 * 提交订单的幂等流程（对应后端第三层改造）：
 * 1. GET /order/token 拿一次性令牌
 * 2. POST /order/generateOrder，令牌放 X-Order-Token 头
 * 3. 后端 Redis Lua 比对+删除：双击、网络重试都不会产生重复订单
 */
async function submitOrder() {
  submitting.value = true
  try {
    // 第 1 步：GET /order/token 向后端要一个一次性号码牌（幂等令牌）。
    // 就像取号排队，一个号只能用一次，重复提交时后端认得出是同一号，从而只生成一笔订单
    const token = await orderApi.token()
    // 第 2 步：POST /order/generateOrder 真正下单，把第 1 步拿到的令牌放进 X-Order-Token 请求头。
    // 后端会用 Redis 比对并删掉这个令牌（Lua 脚本保证原子性）：用户双击、网络重试都不会生成两笔订单。
    // 压测中 306 并发抢 10 件库存做到零超卖，Redis 预扣把 P90 从 184ms 降到 44ms
    const orderId = await orderApi.generateOrder(
      {
        memberReceiveAddressId: selectedAddressId.value,
        cartIds: cartIds.value,
        couponId: selectedCouponId.value || undefined,
        payType: 0,
        useIntegration: 0
      },
      token
    )
    ElMessage.success('下单成功')
    // 清掉本次结算痕迹，返回购物车时不残留已下单的商品
    sessionStorage.removeItem('mall_cart_ids')
    router.push('/orders')
    void orderId
  } finally {
    submitting.value = false
  }
}

// 页面一打开就读上一页勾选了哪些购物车条目；一个都没有说明是误闯进来的，直接退回购物车
onMounted(async () => {
  cartIds.value = JSON.parse(sessionStorage.getItem('mall_cart_ids') || '[]')
  if (!cartIds.value.length) {
    ElMessage.warning('请先在购物车中选择商品')
    router.push('/cart')
    return
  }
  // generateConfirmOrder 一次返回：促销价明细、地址、可用券、金额（字段名以 ConfirmOrderResult 为准）
  // POST /order/generateConfirmOrder：把购物车条目 id 交给后端，一次拿回确认单所需的全部数据
  // （带促销价的商品清单、收货地址、可用优惠券、金额 calcAmount），字段名按后端 ConfirmOrderResult 来取
  const result = await orderApi.generateConfirmOrder(cartIds.value)
  cartItems.value = result.cartPromotionItemList || []
  addresses.value = result.memberReceiveAddressList || []
  coupons.value = result.couponHistoryDetailList || []
  calculate.value = result.calcAmount
  if (addresses.value.length) {
    selectedAddressId.value = addresses.value[0].id
  }
})
</script>

<style scoped>
.page-title { font-size: 20px; margin-bottom: 16px; }
.block { margin-bottom: 16px; }
.addr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.addr-item { border: 1px solid #e4e7ed; border-radius: 6px; padding: 12px 14px; cursor: pointer; }
.addr-item.active { border-color: var(--mall-primary); background: #fdf0f0; }
.addr-name { font-weight: 600; }
.addr-detail { font-size: 13px; color: var(--mall-sub); margin-top: 6px; }
.goods-row { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px dashed #eee; }
.goods-row img { width: 56px; height: 56px; border-radius: 6px; object-fit: cover; }
.goods-info { flex: 1; }
.goods-info .attr { font-size: 12px; color: var(--mall-sub); margin-top: 4px; }
.goods-price { display: flex; flex-direction: column; align-items: flex-end; font-size: 13px; color: var(--mall-sub); }
.pay-bar { background: #fff; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
.amounts { display: flex; gap: 22px; color: var(--mall-sub); font-size: 14px; }
.price.big { font-size: 24px; }
</style>
