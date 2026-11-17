<template>
  <div class="auth-wrap">
    <el-card class="auth-card">
      <h2 class="auth-title">注册 mall 商城</h2>
      <el-form :model="form" @submit.prevent="doRegister">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.telephone" placeholder="手机号" size="large" />
        </el-form-item>
        <el-form-item>
          <div class="code-row">
            <el-input v-model="form.authCode" placeholder="验证码" size="large" />
            <el-button size="large" @click="getAuthCode">{{ sentCode ? code : '获取验证码' }}</el-button>
          </div>
        </el-form-item>
        <el-button type="primary" size="large" class="submit" :loading="loading" @click="doRegister">
          注 册
        </el-button>
        <p class="extra">
          已有账号？<a class="link" @click="$router.push('/login')">去登录</a>
        </p>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { memberApi } from '../api'

const route = useRoute()
const router = useRouter()
const form = reactive({ username: '', password: '', telephone: '', authCode: '' })
const loading = ref(false)
const sentCode = ref(false)
const code = ref('')

/**
 * mall 的短信服务是模拟实现：验证码不会真的发短信，
 * 而是直接返回在响应里（日志也会打印）。开发环境直接回填展示。
 */
async function getAuthCode() {
  if (!/^1\d{10}$/.test(form.telephone)) {
    ElMessage.warning('请输入正确的手机号')
    return
  }
  const data = await memberApi.getAuthCode(form.telephone)
  code.value = data
  sentCode.value = true
  form.authCode = data
  ElMessage.success('验证码已获取（模拟短信，自动回填）')
}

async function doRegister() {
  if (!form.username || !form.password || !form.telephone || !form.authCode) {
    ElMessage.warning('请完整填写注册信息')
    return
  }
  loading.value = true
  try {
    await memberApi.register(form.username, form.password, form.telephone, form.authCode)
    ElMessage.success('注册成功，请登录')
    router.push({ path: '/login', query: route.query })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-wrap { display: flex; justify-content: center; padding: 60px 0; }
.auth-card { width: 420px; padding: 10px 8px; }
.auth-title { text-align: center; margin-bottom: 24px; }
.code-row { display: flex; gap: 10px; width: 100%; }
.submit { width: 100%; }
.extra { text-align: center; margin-top: 14px; font-size: 13px; color: var(--mall-sub); }
.link { color: var(--mall-primary); cursor: pointer; }
</style>
