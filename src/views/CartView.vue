<template>
  <div class="container cart-page">
    <h2 class="page-title">我的购物车</h2>

    <el-table :data="items" v-loading="loading" style="width: 100%" v-if="items.length">
      <el-table-column type="selection" width="50" @selection-change="onSelect" ref="tableRef" />
      <el-table-column label="商品" min-width="380">
        <template #default="{ row }">
          <div class="item-info">
            <img :src="row.productPic" />
            <div>
              <p class="name">{{ row.productName }}</p>
              <p class="attr">{{ row.productAttr || '默认规格' }}</p>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="单价" width="140">
        <template #default="{ row }"><span class="price">¥{{ row.price }}</span></template>
      </el-table-column>
      <el-table-column label="数量" width="170">
        <template #default="{ row }">
          <el-input-number
            :model-value="row.quantity"
            :min="1"
            size="small"
            @change="(v: number) => changeQty(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="小计" width="130">
        <template #default="{ row }">
          <span class="price">¥{{ (row.price * row.quantity).toFixed(2) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90">
        <template #default="{ row }">
          <el-button text type="danger" @click="removeItem(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else-if="!loading" description="购物车是空的，去逛逛吧">
      <el-button type="primary" @click="$router.push('/')">去逛逛</el-button>
    </el-empty>

    <!-- 结算栏 -->
    <div class="checkout-bar" v-if="items.length">
      <div class="left">
        <span>已选 <b>{{ selected.length }}</b> 件</span>
        <el-button text type="danger" size="small" :disabled="!selected.length" @click="removeSelected">
          删除选中
        </el-button>
      </div>
      <div class="right">
        <span class="total">
          合计：<span class="price">¥{{ totalAmount.toFixed(2) }}</span>
        </span>
        <el-button type="danger" size="large" :disabled="!selected.length" @click="goConfirm">
          去结算
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { cartApi } from '../api'
import { useCartStore } from '../stores/cart'

const router = useRouter()
const cart = useCartStore()
const items = ref<any[]>([])
const selected = ref<any[]>([])
const loading = ref(true)

const totalAmount = computed(() =>
  selected.value.reduce((sum, it) => sum + it.price * it.quantity, 0)
)

function onSelect(rows: any[]) {
  selected.value = rows
}

async function changeQty(row: any, quantity: number) {
  await cartApi.updateQuantity(row.id, quantity)
  row.quantity = quantity
  cart.refresh()
}

async function removeItem(row: any) {
  await cartApi.delete([row.id])
  items.value = items.value.filter((it) => it.id !== row.id)
  cart.refresh()
}

async function removeSelected() {
  await cartApi.delete(selected.value.map((it) => it.id))
  await reload()
  cart.refresh()
}

function goConfirm() {
  // 结算时按「选中商品」走促销计算与确认单
  sessionStorage.setItem('mall_cart_ids', JSON.stringify(selected.value.map((it) => it.id)))
  router.push('/order/confirm')
}

async function reload() {
  items.value = (await cartApi.list()) || []
}

onMounted(async () => {
  try {
    await reload()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-title { font-size: 20px; margin-bottom: 16px; }
.item-info { display: flex; gap: 12px; align-items: center; }
.item-info img { width: 64px; height: 64px; border-radius: 6px; object-fit: cover; }
.item-info .name { font-size: 14px; }
.item-info .attr { font-size: 12px; color: var(--mall-sub); margin-top: 4px; }
.checkout-bar { background: #fff; border-radius: 8px; margin-top: 16px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
.left { display: flex; align-items: center; gap: 14px; color: var(--mall-sub); }
.right { display: flex; align-items: center; gap: 18px; }
.total .price { font-size: 22px; }
</style>
