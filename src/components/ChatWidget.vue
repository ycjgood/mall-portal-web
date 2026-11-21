<template>
  <div class="chat-widget">
    <!-- 收起态：右下角的悬浮气泡按钮。点一下展开对话面板 -->
    <button v-if="!open" class="chat-fab" type="button" @click="openPanel" aria-label="打开智能客服">
      <el-icon :size="20"><ChatDotRound /></el-icon>
      <span>问小智</span>
    </button>

    <!-- 展开态：一个固定定位的小窗口，不随页面滚动，所有页面都能看到 -->
    <transition name="chat-pop">
      <div v-if="open" class="chat-panel">
        <!-- 顶部标题栏 -->
        <div class="chat-header">
          <div class="chat-title">
            <el-icon :size="18"><ChatDotRound /></el-icon>
            <div>
              <strong>小智 · 商城助手</strong>
              <small>基于商品资料回答，不编造信息</small>
            </div>
          </div>
          <div class="chat-header-actions">
            <button type="button" title="清空对话" @click="clearChat">清空</button>
            <button type="button" title="收起" @click="open = false">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </div>

        <!-- 消息列表：ref 拿到 DOM，生成过程中自动滚到底部 -->
        <div ref="bodyRef" class="chat-body">
          <div v-for="m in messages" :key="m.id" class="msg-row" :class="m.role">
            <div class="bubble" :class="{ failed: m.failed }">
              <!-- 生成中的空消息显示「正在思考」，有内容后逐字追加 -->
              <span v-if="m.streaming && !m.content" class="thinking">正在翻资料…</span>
              <span v-else class="text">{{ m.content }}</span>
              <!-- 流式光标：回答还没结束时闪一下，提示仍在生成 -->
              <span v-if="m.streaming && m.content" class="cursor" />
            </div>
          </div>

          <!-- 首屏快捷问题：只在还没有用户提问时出现，降低「不知道问什么」的门槛 -->
          <div v-if="showQuick" class="quick">
            <p>你可以这样问：</p>
            <button v-for="q in quickQuestions" :key="q" type="button" @click="send(q)">{{ q }}</button>
          </div>
        </div>

        <!-- 输入区：Enter 发送、Shift+Enter 换行；生成中按钮变成「停止」 -->
        <div class="chat-footer">
          <textarea
            v-model="input"
            rows="2"
            :disabled="generating"
            placeholder="问问商品参数，例如：iPhone 14 电池容量多大"
            @keydown.enter.exact.prevent="send()"
          />
          <el-button v-if="generating" type="info" size="small" @click="stopGenerate">停止</el-button>
          <el-button v-else type="primary" size="small" :disabled="!input.trim()" @click="send()">
            发送<el-icon class="send-icon"><Promotion /></el-icon>
          </el-button>
          <p class="disclaimer">价格、库存实时变动，请以商品页为准 · 回答由本地 AI 生成</p>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
/**
 * 【模块职责】商城右下角的「AI 智能客服悬浮窗」。顾客在任何页面点一下「问小智」，
 * 就能用大白话问商品参数（如「iPhone 14 电池容量多大」），回答会一个字一个字蹦出来。
 * 类比：商场里随叫随到的导购员，但他只按《商品说明书》回答，绝不瞎报价钱。
 *
 * 【输入】
 *   - 用户在输入框敲的问题，或点击首屏的快捷问题
 *   - 后端 /chat/ask 通过 SSE 长连接持续推回来的文字片段
 * 【输出】
 *   - 屏幕上的对话气泡（用户 / 助手）、打字机效果、加载与错误提示
 *   - 不修改购物车、订单等任何业务数据；纯问答，问错了也不会影响下单
 *
 * 【执行流程】
 *   1) 点悬浮按钮 openPanel() 展开面板，并显示一条欢迎语。
 *   2) 输入问题按 Enter（或点快捷问题）→ send()：
 *        · 立刻把用户的话加进消息列表（界面马上反馈）
 *        · 追加一条空的助手消息，标记为 streaming=true（显示「正在翻资料…」）
 *   3) 调 api/chat.ts 的 askChatStream()，它负责连后端 SSE 并把每段文字回调回来。
 *   4) onChunk 把文字追加到那条助手消息里 → 每加一次就滚到底部 → 打字机效果。
 *   5) onDone 收到 [DONE] → 去掉光标、恢复输入；onError 显示温和的错误提示。
 *   6) 生成途中可以点「停止」→ AbortController.abort() 掐断长连接。
 *
 * 【关键变量/状态】
 *   - open：面板展开/收起
 *   - messages：对话消息数组，每条含 id / role(user|assistant) / content / streaming / failed
 *   - generating：是否正在生成，用来禁用输入框、把发送按钮换成「停止」
 *   - controller：本次请求的 AbortController 把手，用于中途停止
 *   - bodyRef：消息列表的 DOM 引用，用来自动滚到底部
 *   - showQuick：是否显示首屏快捷问题（只在还没提问过时显示）
 *
 * 【注意事项 / 容易踩的坑】
 *   1. ★ 改消息内容时不能直接改「push 进去的那个原始对象」！Vue 的 ref 数组会把元素包成
 *      响应式代理，改原始对象界面不会刷新。所以回调里用 find(m => m.id === replyId)
 *      取回代理对象再改 —— 这是 Vue3 最常见的「数据变了页面不动」坑。
 *   2. 中文可能被拆在两个网络包里，解码必须用 TextDecoder 的 stream 模式（已封装在 chat.ts）。
 *   3. AI 服务是独立的 8086，和商城后端 8085 分开；它挂了只影响这个悬浮窗，
 *      所以错误提示要温和，别让顾客以为商城坏了。
 *   4. 后端会主动拒答无关问题、且禁止报价格库存（业务铁律）；前端不做二次加工，
 *      后端说什么就显示什么，避免前后端规则打架。
 *   5. 组件挂在 MainLayout 里，因此全站每个页面都有它；组件自身不依赖登录态，
 *      未登录也能问商品问题（价格/订单类工具以后接了再要求登录）。
 */
import { computed, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, Close, Promotion } from '@element-plus/icons-vue'
import { askChatStream } from '../api/chat'

/** 一条对话消息 */
interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  streaming: boolean
  failed?: boolean
}

const WELCOME = '你好，我是小智～可以问我商品参数、规格、卖点，例如「iPhone 14 电池容量多大」。价格与库存请以商品页为准哦。'
const quickQuestions = ['iPhone 14 电池容量多大', '小米 12 支持多少瓦快充', '有哪些华为手机']

const open = ref(false)
const input = ref('')
const messages = ref<ChatMessage[]>([])
const generating = ref(false)
const bodyRef = ref<HTMLElement | null>(null)
let controller: AbortController | null = null
let seq = 0

/** 只在还没提过问时显示快捷问题（欢迎语不算用户提问） */
const showQuick = computed(() => !messages.value.some((m) => m.role === 'user'))

/** 消息追加后滚到最底部，模拟聊天软件的行为 */
function scrollToBottom() {
  nextTick(() => {
    if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  })
}

/** 首次展开时放一条欢迎语，避免空面板 */
function openPanel() {
  open.value = true
  if (messages.value.length === 0) {
    messages.value.push({ id: ++seq, role: 'assistant', content: WELCOME, streaming: false })
  }
  scrollToBottom()
}

/**
 * 发送一个问题。
 * @param preset 快捷问题文本；不传就读输入框
 */
function send(preset?: string) {
  const q = (preset ?? input.value).trim()
  if (!q || generating.value) return
  open.value = true
  input.value = ''

  // ① 先把用户的话和一条空的助手消息放上去，界面立刻有反馈
  messages.value.push({ id: ++seq, role: 'user', content: q, streaming: false })
  const replyId = ++seq
  messages.value.push({ id: replyId, role: 'assistant', content: '', streaming: true })
  generating.value = true
  scrollToBottom()

  // ② 打开 SSE 长连接。回调里一律通过 id 回查响应式对象再修改（见注意事项 1）
  controller = askChatStream(q, {
    onChunk: (text) => {
      const target = messages.value.find((m) => m.id === replyId)
      if (target) target.content += text
      scrollToBottom()
    },
    onDone: () => {
      const target = messages.value.find((m) => m.id === replyId)
      if (target) target.streaming = false
      generating.value = false
      controller = null
      scrollToBottom()
    },
    onError: (msg) => {
      const target = messages.value.find((m) => m.id === replyId)
      if (target) {
        target.content = target.content || msg
        target.streaming = false
        target.failed = true
      }
      generating.value = false
      controller = null
      ElMessage.warning('小智暂时没连上，请稍后再试～')
      scrollToBottom()
    }
  })
}

/** 中途停止生成：掐断 fetch 长连接，chat.ts 会把 AbortError 当成正常结束 */
function stopGenerate() {
  controller?.abort()
}

/** 清空对话并恢复欢迎语；若正在生成先中断，避免旧回答串进新对话 */
function clearChat() {
  if (generating.value) controller?.abort()
  messages.value = [{ id: ++seq, role: 'assistant', content: WELCOME, streaming: false }]
  generating.value = false
  controller = null
  input.value = ''
  scrollToBottom()
}
</script>

<style scoped>
.chat-widget { position: relative; z-index: 1000; }

/* 悬浮按钮 */
.chat-fab {
  position: fixed; right: 24px; bottom: 24px;
  display: inline-flex; align-items: center; gap: 6px;
  height: 48px; padding: 0 18px;
  border: none; border-radius: 24px; cursor: pointer;
  background: var(--mall-primary); color: #fff;
  font-size: 14px; font-weight: 600;
  box-shadow: 0 6px 20px rgba(233, 59, 61, .35);
  transition: transform .2s, box-shadow .2s;
}
.chat-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(233, 59, 61, .45); }

/* 面板 */
.chat-panel {
  position: fixed; right: 24px; bottom: 84px;
  width: 360px; height: 520px; max-height: calc(100vh - 110px);
  display: flex; flex-direction: column;
  background: #fff; border-radius: 12px; overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .18);
  border: 1px solid #eee;
}
.chat-pop-enter-active, .chat-pop-leave-active { transition: opacity .2s, transform .2s; }
.chat-pop-enter-from, .chat-pop-leave-to { opacity: 0; transform: translateY(12px) scale(.97); }

/* 顶部 */
.chat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; color: #fff;
  background: linear-gradient(135deg, #f05a5c, var(--mall-primary));
}
.chat-title { display: flex; align-items: center; gap: 8px; }
.chat-title strong { display: block; font-size: 15px; }
.chat-title small { display: block; font-size: 11px; opacity: .85; margin-top: 2px; }
.chat-header-actions { display: flex; align-items: center; gap: 6px; }
.chat-header-actions button {
  background: rgba(255, 255, 255, .18); border: none; color: #fff;
  border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer;
  display: inline-flex; align-items: center;
}
.chat-header-actions button:hover { background: rgba(255, 255, 255, .3); }

/* 消息区 */
.chat-body { flex: 1; overflow-y: auto; padding: 14px; background: #fafafa; }
.msg-row { display: flex; margin-bottom: 12px; }
.msg-row.user { justify-content: flex-end; }
.msg-row.assistant { justify-content: flex-start; }
.bubble {
  max-width: 84%; padding: 9px 12px; border-radius: 10px;
  font-size: 13px; line-height: 1.65; white-space: pre-wrap; word-break: break-word;
}
.msg-row.user .bubble { background: var(--mall-primary); color: #fff; border-bottom-right-radius: 2px; }
.msg-row.assistant .bubble { background: #fff; color: var(--mall-text); border: 1px solid #eee; border-bottom-left-radius: 2px; }
.bubble.failed { color: #e6a23c; }
.thinking { color: var(--mall-sub); }
.cursor { display: inline-block; width: 2px; height: 13px; margin-left: 2px; background: var(--mall-primary); vertical-align: -2px; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* 快捷问题 */
.quick p { font-size: 12px; color: var(--mall-sub); margin-bottom: 8px; }
.quick button {
  display: block; width: 100%; text-align: left; margin-bottom: 6px;
  padding: 7px 10px; font-size: 12px; color: var(--mall-text);
  background: #fff; border: 1px solid #eee; border-radius: 8px; cursor: pointer;
}
.quick button:hover { border-color: var(--mall-primary); color: var(--mall-primary); }

/* 输入区 */
.chat-footer { padding: 10px 12px 8px; border-top: 1px solid #eee; background: #fff; }
.chat-footer textarea {
  width: 100%; resize: none; border: 1px solid #e4e7ed; border-radius: 8px;
  padding: 8px 10px; font-size: 13px; font-family: inherit; color: var(--mall-text);
  outline: none; margin-bottom: 8px;
}
.chat-footer textarea:focus { border-color: var(--mall-primary); }
.chat-footer textarea:disabled { background: #f7f7f7; }
.send-icon { margin-left: 4px; }
.disclaimer { margin-top: 6px; font-size: 11px; color: var(--mall-sub); line-height: 1.4; }

/* 小屏适配：面板别超出屏幕 */
@media (max-width: 480px) {
  .chat-panel { right: 12px; bottom: 76px; width: calc(100vw - 24px); height: 68vh; }
  .chat-fab { right: 12px; bottom: 12px; }
}
</style>
