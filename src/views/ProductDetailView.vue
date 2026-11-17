<template>
  <div class="container detail-page" v-loading="loading">
    <template v-if="detail">
      <div class="main">
        <div class="pic">
          <img :src="detail.product?.pic" :alt="detail.product?.name" />
        </div>
        <div class="info">
          <h1 class="name">{{ detail.product?.name }}</h1>
          <p class="sub">{{ detail.product?.subTitle }}</p>

          <div class="price-box">
            <span class="label">价格</span>
            <span class="price big">¥{{ currentSku?.price ?? detail.product?.price }}</span>
            <span class="market" v-if="detail.product?.originalPrice">¥{{ detail.product.originalPrice }}</span>
            <span class="sale">已售 {{ detail.product?.sale }}</span>
          </div>

          <div class="sku-box" v-if="detail.skuStockList?.length">
            <span class="label">规格</span>
            <div class="sku-list">
              <div
                v-for="sku in detail.skuStockList"
                :key="sku.id"
                class="sku-item"
                :class="{ active: sku.id === selectedSkuId, disabled: sku.stock === 0 }"
                @click="selectSku(sku)"
              >
                {{ sku.spDataText || sku.skuCode }}
              </div>
            </div>
          </div>

          <div class="stock-line">
            库存：<b>{{ currentSku?.stock ?? detail.product?.stock }}</b> 件
          </div>

          <div class="buy-row">
            <el-input-number v-model="quantity" :min="1" :max="currentSku?.stock || 999" />
            <el-button type="danger" size="large" :disabled="!currentSku || currentSku.stock === 0"
                       @click="addToCart">
              加入购物车
            </el-button>
          </div>

          <div class="service">✓ 超时未付自动取消 &nbsp;|&nbsp; ✓ 高并发库存保护 &nbsp;|&nbsp; ✓ 提交防重复</div>
        </div>
      </div>

      <el-card class="attr-card" shadow="never">
        <template #header>商品参数</template>
        <el-descriptions :column="3" border>
          <el-descriptions-item
            v-for="attr in detail.productAttributeValueList"
            :key="attr.id"
            :label="attr.name"
          >
            {{ attr.value }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { productApi, cartApi } from '../api'
import { useUserStore } from '../stores/user'
import { useCartStore } from '../stores/cart'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const cart = useCartStore()

const loading = ref(true)
const detail = ref<any>(null)
const selectedSkuId = ref<number | null>(null)
const quantity = ref(1)

// spData 形如 [{"key":"颜色","value":"金"}]，拼成可读文案
function skuText(sku: any) {
  try {
    return JSON.parse(sku.spData).map((kv: any) => kv.value).join(' / ')
  } catch {
    return sku.skuCode
  }
}

const currentSku = computed(() =>
  detail.value?.skuStockList?.find((s: any) => s.id === selectedSkuId.value)
)

function selectSku(sku: any) {
  if (sku.stock === 0) return
  selectedSkuId.value = sku.id
}

async function addToCart() {
  if (!user.isLogin) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  // portal 的 /cart/add 不回查商品，商品快照（名称/图片/价格/规格）需由前端带入
  await cartApi.add({
    productId: detail.value.product.id,
    productSkuId: selectedSkuId.value,
    quantity: quantity.value,
    price: currentSku.value?.price ?? detail.value.product.price,
    productPic: detail.value.product.pic,
    productName: detail.value.product.name,
    productBrand: detail.value.product.brandName,
    productCategoryId: detail.value.product.productCategoryId,
    productAttr: currentSku.value?.spDataText || ''
  })
  await cart.refresh()
  ElMessage.success('已加入购物车')
}

onMounted(async () => {
  try {
    detail.value = await productApi.detail(route.params.id)
    // 默认选中第一个有库存的 SKU
    const first = detail.value?.skuStockList?.find((s: any) => s.stock > 0)
    if (first) {
      selectedSkuId.value = first.id
    }
    // 预生成展示文案
    detail.value?.skuStockList?.forEach((s: any) => (s.spDataText = skuText(s)))
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-page { padding-top: 8px; }
.main { display: flex; gap: 28px; background: #fff; border-radius: 8px; padding: 28px; }
.pic { width: 420px; flex-shrink: 0; }
.pic img { width: 100%; border-radius: 8px; }
.info { flex: 1; }
.name { font-size: 22px; line-height: 1.4; }
.sub { color: var(--mall-sub); margin-top: 8px; }
.price-box { background: #fdf0f0; margin-top: 16px; padding: 16px; border-radius: 6px; display: flex; align-items: baseline; gap: 10px; }
.price-box .label, .sku-box .label { color: var(--mall-sub); margin-right: 8px; font-size: 13px; }
.price.big { font-size: 26px; }
.market { color: var(--mall-sub); text-decoration: line-through; }
.sale { margin-left: auto; color: var(--mall-sub); font-size: 13px; }
.sku-box { margin-top: 20px; display: flex; }
.sku-list { display: flex; flex-wrap: wrap; gap: 10px; }
.sku-item { border: 1px solid #dcdfe6; border-radius: 4px; padding: 6px 16px; cursor: pointer; font-size: 14px; }
.sku-item.active { border-color: var(--mall-primary); color: var(--mall-primary); background: #fdf0f0; }
.sku-item.disabled { color: #c0c4cc; cursor: not-allowed; text-decoration: line-through; }
.stock-line { margin-top: 16px; font-size: 14px; color: var(--mall-sub); }
.buy-row { margin-top: 20px; display: flex; gap: 16px; }
.service { margin-top: 22px; color: var(--mall-sub); font-size: 12px; }
.attr-card { margin-top: 20px; }
</style>
