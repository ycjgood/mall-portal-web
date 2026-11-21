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
/**
 * 【模块职责】商品详情页：看大图、价格、参数，选规格（比如颜色、容量）、选数量，然后加入购物车。
 * 类比：像拿起一件商品翻看标签，决定要哪个款式、买几件，再放进购物篮。
 *
 * 【输入】网址参数 route.params.id（商品 id）；用户操作：点规格、调数量、点加入购物车。
 * 【输出】渲染详情；加购成功后刷新购物车角标；调后端 /product/detail/:id 与 /cart/add；
 *         未登录时跳登录页并带 redirect。
 * 【执行流程】
 *   1) onMounted 按 id 调 productApi.detail 拉详情，同时把规格里的 spData 拼成金 / 128G 这样的可读文案。
 *   2) 默认选中第一个还有库存的规格；用户点其它规格时 selectSku 记录 selectedSkuId（缺货的点不动）。
 *   3) currentSku 是个计算属性：只要选中的规格或详情变了，它自动算出当前该显示的价格和库存，不用手动同步。
 *   4) 点加购：没登录先跳登录；已登录则带商品快照调 /cart/add，成功后 cart.refresh() 更新角标。
 * 【关键变量/状态】
 *   - detail：后端返回的整个商品详情（含 skuStockList 规格列表、product 主信息）。
 *   - selectedSkuId：当前选中的规格 id，null 表示还没选到可售规格。
 *   - currentSku：computed，按 selectedSkuId 从规格列表里找出来的那一条，价格和库存都取它。
 *   - quantity：购买件数，最大不能超过当前规格库存。
 *   - loading：详情没回来前显示转圈。
 * 【注意事项】
 *   1. 加购必须带商品快照字段（名称、图片、价格、规格、品牌、分类等）：后端 /cart/add 不会回查商品表，缺了购物车里会显示空白。
 *   2. 价格优先用 currentSku 的规格价，没有才退回商品主价；不同规格可能不同价，别一律用主价。
 *   3. 库存为 0 的规格要禁用，且加购按钮在没有可售规格时也不能点，避免把卖完的规格提交给后端。
 */
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

// computed = 自动跟着变的算式：只要选中的规格 id 或商品详情变了，
// 它就重新从 skuStockList 里找出对应那条规格，价格、库存都随之刷新，不用手动同步
const currentSku = computed(() =>
  detail.value?.skuStockList?.find((s: any) => s.id === selectedSkuId.value)
)

// 选规格：缺货（stock 等于 0）的直接不让点；这里只记一个 selectedSkuId，
// 价格和库存等具体值交给上面的 currentSku 自动算出来
function selectSku(sku: any) {
  if (sku.stock === 0) return
  selectedSkuId.value = sku.id
}

// 加购：先挡一道未登录（跳登录并带 redirect，登录后会回到本页），
// 再把选中规格、数量和商品快照一起提交给后端
async function addToCart() {
  if (!user.isLogin) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  // portal 的 /cart/add 不回查商品，商品快照（名称/图片/价格/规格）需由前端带入
  // POST /cart/add：这些字段是商品快照，后端不会回查商品表，
  // 商品名、图片、价格、规格、品牌、分类都要前端一并带过去，购物车才不会显示空白；
  // 价格优先取当前选中规格的价，没有规格时退回商品主价
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
    // GET /product/detail/:id：按网址里的商品 id 拉详情（含 skuStockList 规格列表、product 主信息）。
    // 拿到后还要做两件准备：默认选中第一个有库存的规格、把每个规格的 spData 拼成可读文案存进 spDataText，
    // 这样模板里才能直接显示颜色、容量这类规格名；finally 里无论成功失败都要关掉转圈
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
