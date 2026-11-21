<template>
  <div class="container orders-page">
    <h2 class="page-title">我的订单</h2>

    <el-tabs v-model="status" @tab-change="load(true)">
      <el-tab-pane label="全部" :name="-1" />
      <el-tab-pane label="待付款" :name="0" />
      <el-tab-pane label="已发货" :name="2" />
      <el-tab-pane label="已完成" :name="3" />
      <el-tab-pane label="已关闭" :name="4" />
    </el-tabs>

    <div v-loading="loading">
      <el-card shadow="never" class="order-card" v-for="order in orders" :key="order.id">
        <div class="order-head">
          <span>订单号：{{ order.orderSn }}</span>
          <span class="time">{{ order.createTime?.replace('T', ' ')?.slice(0, 19) }}</span>
          <el-tag :type="statusType(order.status)" size="small">{{ statusText(order.status) }}</el-tag>
        </div>
        <div class="order-body">
          <div class="goods">
            <img v-for="it in order.orderItemList" :key="it.id" :src="it.productPic" :title="it.productName" />
          </div>
          <div class="amount">
            <span class="price">¥{{ order.payAmount }}</span>
            <span class="count">共 {{ order.orderItemList?.length }} 种商品</span>
          </div>
          <div class="ops">
            <template v-if="order.status === 0">
              <el-button size="small" type="danger" plain @click="cancel(order)">取消订单</el-button>
              <el-tooltip content="支付网关未接入，可用下方模拟支付完成订单" placement="top">
                <el-button size="small" type="primary" @click="mockPay(order)">去支付</el-button>
              </el-tooltip>
            </template>
            <el-button v-if="order.status === 2" size="small" type="success" plain
                       @click="confirmReceive(order)">确认收货</el-button>
            <el-button size="small" text @click="showDetail(order)">详情</el-button>
          </div>
        </div>
      </el-card>
      <el-empty v-if="!loading && !orders.length" description="暂无订单" />
    </div>

    <div class="pager">
      <el-pagination
        v-model:current-page="pageNum"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        background
        @current-change="load()"
      />
    </div>

    <!-- 订单详情 -->
    <el-drawer v-model="drawerVisible" title="订单详情" size="480px">
      <el-descriptions :column="1" border v-if="detail">
        <el-descriptions-item label="订单号">{{ detail.orderSn }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusText(detail.status) }}</el-descriptions-item>
        <el-descriptions-item label="收货人">
          {{ detail.receiverName }} {{ detail.receiverPhone }}
        </el-descriptions-item>
        <el-descriptions-item label="收货地址">{{ detail.receiverDetailAddress }}</el-descriptions-item>
        <el-descriptions-item label="实付金额"><span class="price">¥{{ detail.payAmount }}</span></el-descriptions-item>
        <el-descriptions-item label="商品">
          <div v-for="it in detail.orderItemList" :key="it.id" class="detail-goods">
            <img :src="it.productPic" width="40" height="40" style="border-radius:4px;object-fit:cover" />
            {{ it.productName }} × {{ it.quantity }}
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
/**
 * 【模块职责】我的订单页：按状态分页看订单，对待付款的订单可以取消或模拟支付，已发货的可以确认收货，还能点开抽屉看详情。
 * 类比：像翻自己的小票夹，按没付钱、已发货、已完成分格放好。
 *
 * 【输入】用户点状态标签（全部、待付款、已发货、已完成、已关闭）、翻页，以及各操作按钮。
 * 【输出】渲染订单卡片列表与详情抽屉；调 /order/list、/order/detail、/order/cancelUserOrder、
 *         /order/paySuccess（模拟支付）、/order/confirmReceiveOrder；每次操作后重新拉列表。
 * 【执行流程】
 *   1) onMounted 调 load(true)，按当前 status 从第一页拉 /order/list。
 *   2) status 是数字（0 待付款、1 待发货、2 已发货、3 已完成、4 已关闭），
 *      statusText 和 statusType 把它翻译成中文和标签颜色，页面只显示翻译后的文字。
 *   3) 取消订单、模拟支付、确认收货：先弹确认框，再调对应接口，成功后 load() 重新拉列表刷新状态。
 *   4) 点详情调 /order/detail，把结果放进 detail 并打开右侧抽屉。
 * 【关键变量/状态】
 *   - orders：当前页订单数组；total、pageNum、pageSize：分页信息（每页 6 条）。
 *   - status：当前选中的状态标签，-1 表示全部。
 *   - drawerVisible / detail：详情抽屉是否打开、抽屉里显示的订单数据。
 *   - loading：列表转圈。
 * 【注意事项】
 *   1. 状态值是后端约定的数字，不是中文；改成中文去查会查不到，翻译只发生在显示层。
 *   2. 去支付是模拟支付：真实支付网关尚未接入，调 /order/paySuccess 让订单走完待付款到待发货的状态流转，别当成真扣款。
 *   3. 取消订单会立即释放库存，后端另有超时未付自动取消（延迟消息）；前端只负责发起点和刷新列表。
 */
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi } from '../api'

const orders = ref<any[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 6
const status = ref(-1)
const loading = ref(true)
const drawerVisible = ref(false)
const detail = ref<any>(null)

// 后端用数字表示订单状态（0 待付款、1 待发货、2 已发货、3 已完成、4 已关闭），
// 这里把数字翻译成中文给用户看；下面的 statusType 同理，只是换成标签颜色
function statusText(s: number) {
  return ({ 0: '待付款', 1: '待发货', 2: '已发货', 3: '已完成', 4: '已关闭' } as Record<number, string>)[s] || '未知'
}
function statusType(s: number) {
  return ({ 0: 'warning', 1: 'primary', 2: 'primary', 3: 'success', 4: 'info' } as Record<number, any>)[s] || 'info'
}

async function load(resetPage = false) {
  if (resetPage) pageNum.value = 1
  loading.value = true
  try {
    // GET /order/list：按状态加页码分页查。status 传的是后端约定的数字（-1 表示全部），不是中文标签
    const data = await orderApi.list({ status: status.value, pageNum: pageNum.value, pageSize })
    orders.value = data.list || []
    total.value = Number(data.total || 0)
  } finally {
    loading.value = false
  }
}

// 取消订单：先弹确认框，再调 /order/cancelUserOrder。成功后库存立即释放，
// 然后 load() 重新拉列表，卡片上的状态才会刷新
async function cancel(order: any) {
  await ElMessageBox.confirm('确定取消这笔订单吗？库存将立即释放。', '取消订单', { type: 'warning' })
  await orderApi.cancelUserOrder(order.id)
  ElMessage.success('订单已取消，库存已释放')
  load()
}

/**
 * mall 的支付网关是占位实现（AlipayController 只有演示回调）。
 * 这里用 paySuccess 模拟支付成功，走完「待付款 → 待发货」的真实状态流转。
 */
async function mockPay(order: any) {
  await ElMessageBox.confirm('将模拟支付成功（未接入真实支付网关）', '模拟支付', { type: 'info' })
  // POST /order/paySuccess：模拟支付成功（真实支付网关未接入），
  // 让订单走完待付款到待发货的状态流转，方便把流程演示完整
  await orderApi.paySuccessMock(order.id)
  ElMessage.success('支付成功')
  load()
}

// 确认收货：先弹确认框，再调 /order/confirmReceiveOrder 把订单推进到已完成，然后 load() 刷新列表
async function confirmReceive(order: any) {
  await ElMessageBox.confirm('确认已收到商品？', '确认收货')
  await orderApi.confirmReceiveOrder(order.id)
  ElMessage.success('已确认收货')
  load()
}

// 点详情：调 /order/detail/:id 拿完整订单（含收货人、地址、商品明细），
// 结果放进 detail 后打开右侧抽屉展示；列表里只有摘要，详情要单独查
async function showDetail(order: any) {
  detail.value = await orderApi.detail(order.id)
  drawerVisible.value = true
}

onMounted(() => load(true))
</script>

<style scoped>
.page-title { font-size: 20px; margin: 4px 0 8px; }
.order-card { margin-bottom: 12px; }
.order-head { display: flex; gap: 20px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.order-head .time { color: var(--mall-sub); font-size: 13px; margin-right: auto; }
.order-body { display: flex; align-items: center; gap: 20px; padding-top: 12px; }
.goods { flex: 1; display: flex; gap: 8px; }
.goods img { width: 56px; height: 56px; border-radius: 6px; object-fit: cover; }
.amount { display: flex; flex-direction: column; align-items: flex-end; }
.amount .count { font-size: 12px; color: var(--mall-sub); }
.ops { display: flex; gap: 8px; }
.pager { display: flex; justify-content: center; margin-top: 20px; }
.detail-goods { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
</style>
