<template>
  <div class="page">
    <!-- 顶栏 -->
    <header class="topbar">
      <div class="container topbar-inner">
        <a class="logo" @click="$router.push('/')">
          <span class="logo-mark">mall</span> 商城
        </a>
        <div class="search">
          <el-input
            v-model="keyword"
            placeholder="搜索商品"
            clearable
            @keyup.enter="goSearch"
          >
            <template #append>
              <el-button :icon="Search" @click="goSearch" />
            </template>
          </el-input>
        </div>
        <div class="actions">
          <el-badge :value="cart.count || undefined" :offset="[4, 8]">
            <el-button text @click="$router.push('/cart')">
              <el-icon><ShoppingCart /></el-icon>&nbsp;购物车
            </el-button>
          </el-badge>
          <el-button text class="seckill-link" @click="$router.push('/seckill')">⚡ 限时秒杀</el-button>
          <el-button text @click="$router.push('/orders')">我的订单</el-button>
          <template v-if="user.isLogin">
            <el-dropdown>
              <span class="user-name">
                <el-icon><User /></el-icon>&nbsp;{{ user.member?.username || '会员' }}
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="$router.push('/orders')">我的订单</el-dropdown-item>
                  <el-dropdown-item divided @click="doLogout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <el-button text type="primary" @click="$router.push('/login')">登录</el-button>
            <el-button text @click="$router.push('/register')">注册</el-button>
          </template>
        </div>
      </div>
    </header>

    <!-- 页面主体 -->
    <main class="main">
      <router-view @cart-changed="cart.refresh" />
    </main>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="container">
        <p>mall 商城 · Vue3 + SpringBoot 3 实战项目</p>
        <p class="tip">订单超时未付款将由延迟消息自动取消 · 库存支持高并发防超卖</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, ShoppingCart, User } from '@element-plus/icons-vue'
import { useUserStore } from '../stores/user'
import { useCartStore } from '../stores/cart'

const router = useRouter()
const user = useUserStore()
const cart = useCartStore()
const keyword = ref('')

function goSearch() {
  router.push({ path: '/products', query: { keyword: keyword.value } })
}
function doLogout() {
  user.logout()
  cart.clearLocal()
  ElMessage.success('已退出登录')
  router.push('/')
}
onMounted(() => {
  if (user.isLogin) {
    user.fetchInfo()
    cart.refresh()
  }
})
</script>

<style scoped>
.page { min-height: 100vh; display: flex; flex-direction: column; }
.topbar { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.05); position: sticky; top: 0; z-index: 100; }
.topbar-inner { display: flex; align-items: center; gap: 28px; height: 64px; }
.logo { font-size: 22px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.logo-mark { color: var(--mall-primary); }
.search { flex: 1; max-width: 480px; }
.actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.seckill-link { color: #e5399b; font-weight: 600; }
.user-name { display: inline-flex; align-items: center; cursor: pointer; color: var(--mall-text); outline: none; }
.main { flex: 1; padding: 16px 0 32px; }
.footer { background: #2b2b33; color: #9a9aa2; padding: 24px 0; text-align: center; font-size: 13px; }
.footer .tip { margin-top: 6px; font-size: 12px; color: #6c6c75; }
</style>
