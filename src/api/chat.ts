/**
 * 【模块职责】AI 问答的「流式电话线」。商城右下角的悬浮窗不通过 axios 发请求，
 * 而是走这里：用浏览器原生的 fetch 打开一条长连接，把后端一个字一个字推回来的
 * 回答，实时交给界面显示（打字机效果）。
 * 类比：普通接口像发短信等回信；这里像打电话，对方说一句你听一句，不用等他讲完。
 *
 * 【为什么不放在 request.ts 里】
 * request.ts 里的 axios 适合「一次请求、一次响应」的普通接口；
 * 而 AI 回答是 SSE 流（Server-Sent Events，服务器持续往浏览器推数据），
 * axios 默认会等整段收完才返回，做不出逐字效果。所以单独封装一份。
 *
 * 【输入】
 *   - question：顾客输入的问题文本，例如「iPhone 14 电池容量多大」
 *   - handlers：三个回调
 *       · onChunk(text)：后端又推来一小段文字时调用（可能只有两三个字）
 *       · onDone()：收到 [DONE] 或连接正常结束时调用
 *       · onError(msg)：网络错误 / 后端报错时调用
 * 【输出】
 *   - 返回 AbortController：调用它的 .abort() 可以中途「停止生成」，
 *     界面上的停止按钮就是用这个实现的。
 *
 * 【执行流程】
 *   1) 拼好地址 /chat/ask?q=编码后的问题（由 vite 代理转到 8086，见 vite.config.ts）
 *   2) fetch 发起 GET，请求头声明我要接收 text/event-stream
 *   3) 用 ReadableStream 的 reader 一段段读字节，TextDecoder 以 stream 模式解码中文
 *      （★ 必须 stream:true，否则一个汉字被拆在两个网络包里会变成乱码）
 *   4) 按空行 \n\n 切出一个个 SSE 事件，取其中的 data: 行
 *   5) data 是 [DONE] 就收尾；否则把文字交给 onChunk
 *   6) 出错或被中止时走 catch，区分「用户主动停止」和「真出错」
 *
 * 【关键变量/状态】
 *   - controller：AbortController，用来中断 fetch 长连接
 *   - buffer：网络包拼起来的临时字符串。SSE 事件可能被拆在两次读取里，
 *     所以不能来一段就解析一段，要先攒着、遇到空行才算一个完整事件
 *   - decoder：TextDecoder('utf-8')，把二进制字节还原成中文文本
 *
 * 【注意事项】
 *   1. 后端可能输出 `data: 您好` 也可能 `data:您好`（带不带空格都合法），
 *      解析时统一去掉一个前导空格，别把空格当成回答内容显示出来。
 *   2. 同一个事件里可能有多行 data:（回答里含换行时），要用 \n 拼起来，不能只取第一行。
 *   3. AI 服务是独立的 8086，挂了只影响这个悬浮窗；这里的错误提示要温和，
 *      别让顾客以为商城坏了。
 *   4. 后端目前对该接口没有鉴权；正式上线前需要补登录态与限流。
 */

/** AI 流式回答的回调集合 */
export interface ChatStreamHandlers {
  /** 收到一小段生成文字 */
  onChunk: (text: string) => void
  /** 回答结束（含正常结束与用户主动停止） */
  onDone: () => void
  /** 出错，参数是给用户看的提示语 */
  onError: (message: string) => void
}

/** 后端结束标记，与 ChatController 里 concatWith 的 [DONE] 对应 */
const DONE_MARK = '[DONE]'

/**
 * 发起一次流式问答。
 * @returns AbortController —— 界面可调用 abort() 中途停止
 */
export function askChatStream(question: string, handlers: ChatStreamHandlers): AbortController {
  const controller = new AbortController()
  const url = `/chat/ask?q=${encodeURIComponent(question)}`

  // 用 Promise 链而不是 async/await 包住整个函数：这样函数能立刻把 controller 返回给界面，
  // 界面马上就能拿到「停止」的把手，不必等请求结束
  fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal
  })
    .then(async (resp) => {
      // resp.ok 为 false 说明后端返回了 4xx/5xx，此时 resp.body 里不是 SSE 文本
      if (!resp.ok || !resp.body) {
        throw new Error(`AI 服务暂时不可用（HTTP ${resp.status}）`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      // 循环读流，直到后端关闭连接
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // stream: true 让解码器记住「半个汉字」，下次读取时接着拼，避免中文乱码
        buffer += decoder.decode(value, { stream: true })

        // SSE 协议：事件与事件之间用一个空行分隔。
        // 最后一段可能只是半个事件（还没收到空行），留在 buffer 里等下次
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          // 一个事件里可能有多个 data: 行（回答内容本身含换行时）
          const dataLines = event
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).replace(/^ /, ''))
          if (dataLines.length === 0) continue
          const data = dataLines.join('\n')

          if (data === DONE_MARK) {
            handlers.onDone()
            return
          }
          if (data) handlers.onChunk(data)
        }
      }
      // 连接正常关闭但没收到 [DONE]（比如网络提前断开），也当作结束，避免界面一直转圈
      handlers.onDone()
    })
    .catch((err: Error) => {
      if (err.name === 'AbortError') {
        // 用户点了「停止生成」：不算错误，静默收尾
        handlers.onDone()
      } else {
        handlers.onError(err.message || '连接中断，请稍后再试')
      }
    })

  return controller
}
