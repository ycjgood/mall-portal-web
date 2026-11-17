<template>
  <div class="seckill-page">
    <!-- 活动标题 + 当前时间 -->
    <div class="seckill-header">
      <div class="header-left">
        <h1 class="title">⚡ 限时秒杀</h1>
        <p class="promotion-title" v-if="result.promotionTitle">{{ result.promotionTitle }}</p>
      </div>
      <div class="now-time">{{ nowText }}</div>
    </div>

    <el-empty v-if="loaded && !result.promotionId" description="当前没有进行中的秒杀活动" />

    <!-- 场次 tab -->
    <div class="session-tabs" v-if="result.promotionId">
      <div
        v-for="(s, i) in result.sessions"
        :key="s.id"
        class="session-tab"
        :class="{ active: i === activeIndex, done: s.phase === 'ended', going: s.phase === 'going' }"
        @click="activeIndex = i"
      >
        <p class="time">{{ s.startTimeStr.slice(0, 5) }}</p>
        <p class="phase">
          {{ s.phase === 'going' ? '抢购中' : s.phase === 'ended' ? '已结束' : '即将开始' }}
        </p>
      </div>
    </div>

    <!-- 倒计时 -->
    <div class="countdown-bar" v-if="activeSession">
      <span>{{ phaseText }}</span>
      <span class="cd" v-if="activeSession.phase !== 'ended' && countdownText">{{ countdownText }}</span>
      <span class="rule">限量抢购 · 每人限购 {{ limitHint }} 件 · 库存实时扣减防超卖</span>
    </div>

    <!-- 商品网格 -->
    <div class="seckill-grid" v-if="activeSession">
      <div v-for="p in activeSession.productList" :key="p.id" class="seckill-card card-hover">
        <div class="pic-wrap" @click="goDetail(p)">
          <img :src="p.pic" :alt="p.name" loading="lazy" />
          <span class="badge" v-if="activeSession.phase === 'going'">抢购中</span>
        </div>
        <div class="info">
          <p class="name" @click="goDetail(p)">{{ p.name }}</p>
          <p class="sub">{{ p.subTitle || '' }}</p>
          <div class="price-row">
            <span class="flash-price">¥{{ p.flashPromotionPrice }}</span>
            <span class="origin-price">¥{{ p.price }}</span>
            <span class="discount" v-if="discount(p)">{{ discount(p) }}折</span>
          </div>
          <div class="count-row">
            <span>仅剩 {{ p.flashPromotionCount }} 件</span>
            <el-button
              type="danger"
              size="small"
              round
              :disabled="activeSession.phase !== 'going' || p.flashPromotionCount <= 0"
              @click="buy(p)"
            >
              {{ activeSession.phase === 'going' ? (p.flashPromotionCount > 0 ? '立即抢购' : '已抢完') : '未开始' }}
            </el-button>
          </div>
        </div>
      </div>
      <el-empty v-if="!activeSession.productList.length" description="该场次暂无商品" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { seckillApi, cartApi, productApi, type SeckillSessionDetail } from '../api'
import { useUserStore } from '../stores/user'
import { useCartStore } from '../stores/cart'

const router = useRouter()
const user = useUserStore()
const cart = useCartStore()

const loaded = ref(false)
const result = ref<{ promotionId: number | null; promotionTitle: string; sessions: any[] }>({
  promotionId: null,
  promotionTitle: '',
  sessions: []
})
const activeIndex = ref(0)
const nowText = ref('')
const countdownText = ref('')
let timer: number | undefined

const activeSession = computed<SeckillSessionDetail | null>(() => result.value.sessions[activeIndex.value] || null)
const phaseText = computed(() => {
  const p = activeSession.value?.phase
  return p === 'going' ? '本场抢购中' : p === 'ended' ? '本场已结束' : '距本场开始'
})
const limitHint = computed(() => {
  const list = activeSession.value?.productList || []
  return list.length ? Math.max(...list.map((p: any) => p.flashPromotionLimit || 1)) : 1
})

function discount(p: any) {
  const f = Number(p.flashPromotionPrice)
  const o = Number(p.price)
  if (!o || !f || f >= o) return ''
  return (Math.round((f / o) * 100) / 10).toFixed(1)
}

/** 按当前时间给每个场次打 phase 标记并排序：进行中 > 即将开始 > 已结束 */
function markPhases() {
  const now = new Date()
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  for (const s of result.value.sessions) {
    const [sh, sm, ss] = s.startTimeStr.split(':').map(Number)
    const [eh, em, es] = s.endTimeStr.split(':').map(Number)
    s.startSec = sh * 3600 + sm * 60 + ss
    s.endSec = eh * 3600 + em * 60 + es
    s.phase = nowSec >= s.endSec ? 'ended' : nowSec >= s.startSec ? 'going' : 'upcoming'
  }
  // 默认选中：优先进行中的场次，其次最近的未开始场次
  const goingIdx = result.value.sessions.findIndex((s) => s.phase === 'going')
  if (goingIdx >= 0) {
    activeIndex.value = goingIdx
  } else {
    const upIdx = result.value.sessions.findIndex((s) => s.phase === 'upcoming')
    activeIndex.value = upIdx >= 0 ? upIdx : 0
  }
}

function updateClock() {
  const n = new Date()
  nowText.value = n.toLocaleTimeString('zh-CN', { hour12: false })
  const s = activeSession.value as any
  if (!s || s.phase === 'ended') {
    countdownText.value = ''
    return
  }
  const nowSec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()
  const diff = s.phase === 'going' ? s.endSec - nowSec : s.startSec - nowSec
  if (diff <= 0) {
    // 跨过场次边界，重新标记
    markPhases()
    return
  }
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const sec = diff % 60
  const pad = (v: number) => String(v).padStart(2, '0')
  countdownText.value = `${pad(h)} : ${pad(m)} : ${pad(sec)}`
}

async function buy(p: any) {
  if (!user.isLogin) {
    router.push({ path: '/login', query: { redirect: '/seckill' } })
    return
  }
  // 秒杀商品走购物车快照流程：取默认 SKU 加购后直接进结算，
  // 最终价格以后端促销计算为准（防超卖与幂等在订单提交侧兜底）
  const detail = await productApi.detail(p.id)
  const skus: any[] = detail.data.skuStockList || []
  if (!skus.length) {
    ElMessage.error('商品暂无可售库存')
    return
  }
  await cartApi.add({
    productId: p.id,
    productSkuId: skus[0].id,
    quantity: 1,
    price: p.flashPromotionPrice,
    productName: p.name,
    productPic: p.pic,
    productAttr: '秒杀专价'
  })
  await cart.refresh()
  // 从购物车列表里找到刚加的这条，直接带进确认单
  const list = (await cartApi.list()) as any[]
  const item = list.find((it) => it.productSkuId === skus[0].id)
  if (!item) {
    ElMessage.error('加购失败，请重试')
    return
  }
  sessionStorage.setItem('mall_cart_ids', JSON.stringify([item.id]))
  ElMessage.success('已锁定秒杀资格，去结算')
  router.push('/order/confirm')
}

function goDetail(p: any) {
  router.push('/product/' + p.id)
}

onMounted(async () => {
  const res = await seckillApi.sessions()
  result.value = res.data
  markPhases()
  updateClock()
  timer = window.setInterval(updateClock, 1000)
  loaded.value = true
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.seckill-page { max-width: 1200px; margin: 0 auto; }
.seckill-header {
  background: linear-gradient(135deg, #ff2d6f, #ff6a3d);
  color: #fff; border-radius: 10px;
  padding: 22px 28px; display: flex; align-items: center; justify-content: space-between;
}
.header-left .title { font-size: 26px; margin: 0; }
.promotion-title { margin: 6px 0 0; opacity: .9; font-size: 14px; }
.now-time { font-size: 20px; font-variant-numeric: tabular-nums; opacity: .95; }
.session-tabs { display: flex; gap: 10px; margin-top: 16px; overflow-x: auto; }
.session-tab {
  background: #fff; border-radius: 8px; padding: 10px 18px; cursor: pointer;
  text-align: center; border: 2px solid transparent; min-width: 110px; flex-shrink: 0;
}
.session-tab .time { font-size: 17px; font-weight: 700; margin: 0; }
.session-tab .phase { margin: 4px 0 0; font-size: 12px; color: var(--mall-sub); }
.session-tab.active { border-color: #ff2d6f; background: #fff5f8; }
.session-tab.active .time, .session-tab.going .time { color: #ff2d6f; }
.session-tab.done { opacity: .55; }
.countdown-bar {
  background: #fff; border-radius: 8px; margin-top: 12px; padding: 10px 18px;
  display: flex; align-items: center; gap: 14px; font-size: 14px;
}
.countdown-bar .cd { color: #ff2d6f; font-weight: 700; font-variant-numeric: tabular-nums; }
.countdown-bar .rule { margin-left: auto; font-size: 12px; color: var(--mall-sub); }
.seckill-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 14px; }
.seckill-card { background: #fff; border-radius: 8px; overflow: hidden; }
.pic-wrap { height: 190px; overflow: hidden; background: #f7f7f7; position: relative; cursor: pointer; }
.pic-wrap img { width: 100%; height: 100%; object-fit: cover; }
.badge {
  position: absolute; top: 8px; left: 8px; background: #ff2d6f; color: #fff;
  font-size: 12px; padding: 2px 8px; border-radius: 4px;
}
.info { padding: 10px 12px 14px; }
.name { font-size: 14px; line-height: 1.4; height: 39px; overflow: hidden; cursor: pointer;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sub { font-size: 12px; color: var(--mall-sub); margin-top: 4px; height: 18px; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis; }
.price-row { display: flex; align-items: baseline; gap: 8px; margin-top: 8px; }
.flash-price { color: #ff2d6f; font-size: 20px; font-weight: 700; }
.origin-price { color: var(--mall-sub); font-size: 12px; text-decoration: line-through; }
.discount { font-size: 11px; color: #fff; background: #ff9d43; border-radius: 4px; padding: 1px 6px; }
.count-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; color: var(--mall-sub); }
@media (max-width: 900px) { .seckill-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
