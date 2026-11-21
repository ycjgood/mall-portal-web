<template>
  <div class="auth-wrap">
    <el-card class="auth-card">
      <h2 class="auth-title">登录 mall 商城</h2>
      <el-form :model="form" @submit.prevent="doLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" class="submit" :loading="loading" @click="doLogin">
          登 录
        </el-button>
        <p class="extra">
          还没有账号？<a class="link" @click="$router.push({ path: '/register', query: $route.query })">去注册</a>
        </p>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 【模块职责】会员登录页。输入用户名密码，验证通过后把登录凭证记下来，然后回到原来想去的页面。
 * 类比：像进会员制商店前出示会员卡，出示完还放你回原来想逛的柜台。
 *
 * 【输入】表单里的 username 与 password；网址里的 query.redirect（被拦截器或路由守卫拦下来时记下的原地址）。
 * 【输出】登录成功改写 Pinia 用户仓库（token、member）并刷新购物车角标；跳到 redirect 或首页；
 *         底层会调 /sso/login、/sso/info、/cart/list。
 * 【执行流程】
 *   1) 用户填完点登录，先做非空校验，缺一项就提示并停止。
 *   2) loading 置 true 让按钮转圈防重复点；调 user.login()，里面会存 token 并拉会员资料。
 *   3) 再调 cart.refresh() 把购物车角标补上，提示登录成功。
 *   4) 读 route.query.redirect 跳回原页面（没有就回首页），finally 里把 loading 收回。
 * 【关键变量/状态】
 *   - form：表单数据（用户名、密码），用 reactive 包着，输入框一改它就跟着变。
 *   - loading：按钮是否转圈，防止网络慢时用户连点多次。
 *   - route.query.redirect：登录前想去的地址。
 *   - user / cart：两个 Pinia 仓库，登录成功后被改写。
 * 【注意事项】
 *   1. 会员账号是商城 C 端自己的一套（test / 123456），和 5173 管理后台账号不通用。
 *   2. 去注册链接把当前的 route.query 原样带过去，这样注册回来登录时 redirect 不会丢。
 *   3. 登录失败（密码错等）由 request.ts 统一弹后端 message；这里没有 catch，靠 finally 只负责关掉 loading。
 */
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../stores/user'
import { useCartStore } from '../stores/cart'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const cart = useCartStore()
const form = reactive({ username: '', password: '' })
const loading = ref(false)

// 登录动作：先校验、再调仓库里的 login（内部会存 token 并拉会员资料）、
// 然后刷新购物车角标，最后按 redirect 回到登录前想去的页面
async function doLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    // user.login 内部会调 /sso/login 与 /sso/info，并把 token 存进 Pinia 和 localStorage
    await user.login(form.username, form.password)
    // 登录成功后顺带拉一次 /cart/list，把顶栏购物车角标补上
    await cart.refresh()
    ElMessage.success('登录成功')
    // 优先回登录前被拦下来的那个页面（redirect），没有就回首页
    router.push((route.query.redirect as string) || '/')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-wrap { display: flex; justify-content: center; padding: 60px 0; }
.auth-card { width: 400px; padding: 10px 8px; }
.auth-title { text-align: center; margin-bottom: 24px; }
.submit { width: 100%; }
.extra { text-align: center; margin-top: 14px; font-size: 13px; color: var(--mall-sub); }
.link { color: var(--mall-primary); cursor: pointer; }
</style>
