<template>
  <div class="container cart-page">
    <h2 class="page-title">我的购物车</h2>

    <!-- 勾选事件 selection-change 必须绑在整张 el-table 上：
         列只负责画出勾选框，当前勾了哪些行由表格统一抛给 onSelect -->
    <el-table :data="items" v-loading="loading" style="width: 100%" v-if="items.length" @selection-change="onSelect">
      <el-table-column type="selection" width="50" />
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
/**
 * 【模块职责】购物车页：列出已加购的商品，支持勾选、改数量、删除，最后把勾选中的商品送去结算。
 * 类比：像推着购物车到收银台前，先决定这次要结哪几样，其余的先留在车里。
 *
 * 【输入】无路由参数；用户操作：勾选行、改数量、删单个或删选中、点去结算。
 *         间接依赖后端 /cart/list 返回的条目（含 id、price、quantity、商品快照）。
 * 【输出】渲染表格与合计金额；点结算时把选中条目的 id 存进 sessionStorage 并跳确认订单页；
 *         调 /cart/list、/cart/update/quantity、/cart/delete；每次改动后刷新顶栏角标。
 * 【执行流程】
 *   1) onMounted 调 reload() 拉 /cart/list 填满表格。
 *   2) 用户勾选行，el-table 的 selection-change 事件把当前所有选中的行交给 onSelect，存进 selected。
 *   3) totalAmount 是计算属性，自动把 selected 里每行的单价乘数量累加，合计实时变化。
 *   4) 改数量或删除都先调接口，再改本地表格数据并 cart.refresh() 更新角标。
 *   5) 点去结算：把 selected 的 id 数组写进 sessionStorage 的 mall_cart_ids，跳到确认订单页；
 *      确认订单页再从这个键读出来，只对这些商品生成确认单。
 * 【关键变量/状态】
 *   - items：表格里的全部购物车条目。
 *   - selected：当前被勾选的条目数组（结算只认它，不是全部 items）。
 *   - totalAmount：computed，选中条目的金额合计。
 *   - loading：表格转圈。
 * 【注意事项】
 *   1. 勾选事件 selection-change 必须绑在 el-table 整张表格上，不能绑到 el-table-column 列上；
 *      列只负责画勾选框，当前勾了哪些行由整张表统一抛出。
 *   2. 结算用 sessionStorage 传 id 而不是网址参数，避免一长串 id 暴露在地址栏；一个都没选时确认订单页会挡回购物车。
 *   3. 没勾任何商品时去结算和删除选中按钮是禁用的，防止提交空订单。
 *   4. 这里的合计只是前端展示，下单最终金额以后端 ConfirmOrderResult 的 calcAmount 为准（含促销、运费）。
 */
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

// 合计金额是 computed：只累加勾选中的行（selected），没勾的不算钱。
// 所以勾选一变化，下面的合计会立刻跟着变，无需手动重算
const totalAmount = computed(() =>
  selected.value.reduce((sum, it) => sum + it.price * it.quantity, 0)
)

function onSelect(rows: any[]) {
  selected.value = rows
}

// 改数量：先调 /cart/update/quantity 让后端改成功，再改页面里这一行的 quantity，
// 最后 cart.refresh() 更新顶栏角标（合计金额是 computed，会自动跟着变）
async function changeQty(row: any, quantity: number) {
  await cartApi.updateQuantity(row.id, quantity)
  row.quantity = quantity
  cart.refresh()
}

// 删除单个或批量删除：都调 /cart/delete，参数是要删的购物车条目 id 数组
// （api 层会用逗号拼成字符串传）。删完更新本地表格，再 cart.refresh() 刷新角标
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

// 结算跳转：确认订单页不靠网址传商品，而是从这里把勾选条目的 id 数组存进 sessionStorage，
// 键名 mall_cart_ids；确认订单页 onMounted 时再读出来，只结算这几件。
// 用 sessionStorage 而不是网址参数，是为了地址栏干净，且刷新确认页时数据还在
function goConfirm() {
  // 结算时按「选中商品」走促销计算与确认单
  sessionStorage.setItem('mall_cart_ids', JSON.stringify(selected.value.map((it) => it.id)))
  router.push('/order/confirm')
}

// 拉 /cart/list 刷新整张表格：首次进页面（onMounted）和批量删除后都会调它
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
