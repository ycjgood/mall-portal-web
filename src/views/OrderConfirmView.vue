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
    const token = await orderApi.token()
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

onMounted(async () => {
  cartIds.value = JSON.parse(sessionStorage.getItem('mall_cart_ids') || '[]')
  if (!cartIds.value.length) {
    ElMessage.warning('请先在购物车中选择商品')
    router.push('/cart')
    return
  }
  // generateConfirmOrder 一次返回：促销价明细、地址、可用券、金额（字段名以 ConfirmOrderResult 为准）
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
