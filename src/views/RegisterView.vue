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
/**
 * 【模块职责】新会员注册页：填用户名、密码、手机号、验证码，提交后去登录页登录。
 * 类比：像办会员卡，先填资料、核对短信码，办完还得拿卡去登录一次。
 *
 * 【输入】表单四项 username、password、telephone、authCode；网址里的 query（可能含 redirect，要透传给登录页）。
 * 【输出】注册成功跳登录页；调后端 /sso/getAuthCode 与 /sso/register。不改任何全局状态（注册后仍需手动登录）。
 * 【执行流程】
 *   1) 点获取验证码：先用正则校验手机号是 1 开头的 11 位，不合格直接提示。
 *   2) 调 getAuthCode 拿验证码。因为 mall 的短信是模拟实现，验证码直接放在返回里，页面自动回填并展示。
 *   3) 点注册：四项都非空才提交，调 memberApi.register。
 *   4) 成功后提示并跳登录页，同时把 route.query 带过去，保留原来的 redirect。
 * 【关键变量/状态】
 *   - form：四项表单数据。
 *   - sentCode / code：是否已获取过验证码、以及验证码内容（用于按钮文字和回填）。
 *   - loading：提交按钮转圈状态。
 * 【注意事项】
 *   1. 短信是模拟的：验证码不会真发到手机，后端直接把码返回在响应里，开发环境才这样自动回填；接真实短信后要去掉自动回填。
 *   2. 注册接口的四个参数走 URL 查询串（params），不是请求体，别改。
 *   3. 注册成功不等于已登录，这里特意不带 token，让用户走一次登录流程。
 */
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
  // GET /sso/getAuthCode：按手机号取验证码。因为后端短信是模拟实现，
  // 验证码直接放在返回数据里（不是真发到手机），所以下面能自动回填到输入框
  const data = await memberApi.getAuthCode(form.telephone)
  code.value = data
  sentCode.value = true
  form.authCode = data
  ElMessage.success('验证码已获取（模拟短信，自动回填）')
}

// 注册提交：四项都填了才发请求；成功后去登录页，并把网址参数（含 redirect）原样带过去
async function doRegister() {
  if (!form.username || !form.password || !form.telephone || !form.authCode) {
    ElMessage.warning('请完整填写注册信息')
    return
  }
  loading.value = true
  try {
    // POST /sso/register：四个参数同样走 URL 查询串。注册成功不代表已登录，
    // 所以这里不带 token，让用户去登录页走一遍登录流程
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
