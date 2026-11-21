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
      <!-- 这里是页面插槽：网址对应哪一页就显示哪一页。
           另外监听子页面抛来的 cart-changed 自定义事件，一收到就刷新购物车角标 -->
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
/**
 * 【模块职责】整站的外壳：顶部一条导航栏（logo、搜索框、购物车、秒杀入口、我的订单、登录或用户名），
 * 中间是留给各页面的空位，底部是页脚。用户逛到任何页面都能看到这层外壳。
 * 类比：像商场的门头和导览台，逛到哪个柜台（页面）都不变。
 *
 * 【输入】用户在搜索框输入的关键字（keyword）、点击各按钮的操作，以及子页面抛上来的 cart-changed 事件。
 * 【输出】按用户操作跳转页面；展示购物车角标；登录时显示用户名、未登录时显示登录与注册按钮；
 *         本身不直接调后端接口，但会触发 user.fetchInfo() 与 cart.refresh() 两个拉取动作。
 * 【执行流程】
 *   1) 打开任意页面，顶栏先渲染；购物车角标读 cart.count。
 *   2) 输入关键字回车或点放大镜，goSearch() 跳到商品列表页并带上 keyword 参数。
 *   3) 点退出登录，doLogout() 清用户与购物车状态、回首页。
 *   4) 页面挂载后如果已登录，补拉一次会员资料和购物车，保证角标准确。
 * 【关键变量/状态】
 *   - keyword：搜索框里临时存的字，一回车就带给商品列表页。
 *   - user：Pinia 用户仓库，决定显示用户名还是登录与注册。
 *   - cart：Pinia 购物车仓库，提供角标数字 count。
 *   - router：跳转工具，页面里 $router.push 也是它。
 * 【注意事项】
 *   1. router-view 上监听了 cart-changed 自定义事件，一收到就调 cart.refresh()：子页面加购成功后要抛这个事件，
 *      顶栏角标才会刷新；新写的页面若只调接口不抛事件，角标会不准（也可以直接调 cart.refresh()）。
 *   2. 只在已登录（user.isLogin）时才去拉购物车，未登录时接口会返回 401，由 request.ts 统一跳登录页。
 *   3. 顶栏按钮都是前端路由跳转，不直接打接口；需要登录的页面（购物车、订单）由 router 的 auth 守卫先做检查。
 */
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

// 把搜索框里的字带进网址参数，跳到商品列表页；列表页会读 route.query.keyword 去查后端
function goSearch() {
  router.push({ path: '/products', query: { keyword: keyword.value } })
}
// 退出登录：用户仓库清凭证、购物车仓库清本地缓存（避免下一个人看到上一个人的角标），再回首页
function doLogout() {
  user.logout()
  cart.clearLocal()
  ElMessage.success('已退出登录')
  router.push('/')
}
// 页面外壳显示后，如果已登录就补一次数据：拉会员资料（顶栏显示用户名）和购物车（角标准确）。
// 未登录时不去请求，避免白白触发 401 跳登录
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
