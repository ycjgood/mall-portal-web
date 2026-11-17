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

async function doLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await user.login(form.username, form.password)
    await cart.refresh()
    ElMessage.success('登录成功')
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
