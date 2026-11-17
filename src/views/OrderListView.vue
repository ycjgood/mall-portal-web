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
    const data = await orderApi.list({ status: status.value, pageNum: pageNum.value, pageSize })
    orders.value = data.list || []
    total.value = Number(data.total || 0)
  } finally {
    loading.value = false
  }
}

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
  await orderApi.paySuccessMock(order.id)
  ElMessage.success('支付成功')
  load()
}

async function confirmReceive(order: any) {
  await ElMessageBox.confirm('确认已收到商品？', '确认收货')
  await orderApi.confirmReceiveOrder(order.id)
  ElMessage.success('已确认收货')
  load()
}

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
