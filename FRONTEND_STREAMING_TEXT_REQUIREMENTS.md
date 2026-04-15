# 前端接入说明：全双工模型回复流式文字输出

## 背景

后端计划把全双工语音对话里的模型回复改成“文字先流式输出，语音随后按句子/短段落播放”的模式。

也就是说：

- LLM 生成回复时，后端会实时把文字增量推给前端显示。
- TTS 不做 token 级流式合成，仍然等后端拿到完整回复后按句子/短段落合成音频。
- 前端不要根据流式文字自己做 TTS，音频仍然只播放后端发来的 `tts_audio_chunk`。

这样可以让用户先看到模型正在回复，降低等待感，同时避免 TTS 因为输入过短、英文半句、编号等情况产生怪声。

## WebSocket 事件

全双工连接仍然使用现有 WebSocket：

```text
ws://<host>:<port>/ws/full-duplex
```

前端需要新增或确认处理以下事件。

## 1. 用户语音识别结果：`user_text`

后端在一句用户语音识别完成后发送：

```json
{
  "event": "user_text",
  "payload": {
    "turn_id": "turn_xxx",
    "message_id": "user_xxx",
    "text": "你是谁",
    "is_final": true
  }
}
```

前端处理要求：

- 新增一条用户消息气泡。
- 使用 `message_id` 做去重。
- 记录当前活跃轮次 `activeTurnId = payload.turn_id`。

示例：

```js
function handleUserText(payload) {
  activeTurnId = payload.turn_id

  const exists = messages.some(item => item.id === payload.message_id)
  if (exists) return

  messages.push({
    id: payload.message_id,
    role: 'user',
    text: payload.text || '',
    streaming: false,
    turnId: payload.turn_id
  })
}
```

## 2. AI 回复增量：`ai_text_delta`

这是新增事件。后端在 LLM 边生成时持续发送：

```json
{
  "event": "ai_text_delta",
  "payload": {
    "turn_id": "turn_xxx",
    "message_id": "assistant_xxx",
    "delta": "我是",
    "is_final": false
  }
}
```

前端处理要求：

- 找到对应 `message_id` 的 assistant 消息。
- 如果不存在，就创建一条新的 assistant 消息。
- 将 `payload.delta` 追加到当前 assistant 消息文本末尾。
- 将该消息标记为 `streaming: true`。

示例：

```js
function handleAiTextDelta(payload) {
  if (payload.turn_id !== activeTurnId) return

  let msg = messages.find(item => item.id === payload.message_id)

  if (!msg) {
    msg = {
      id: payload.message_id,
      role: 'assistant',
      text: '',
      streaming: true,
      interrupted: false,
      turnId: payload.turn_id
    }
    messages.push(msg)
  }

  msg.text += payload.delta || ''
  msg.streaming = true
}
```

## 3. AI 回复最终文本：`ai_text`

后端在 LLM 完整回复生成结束后发送：

```json
{
  "event": "ai_text",
  "payload": {
    "turn_id": "turn_xxx",
    "message_id": "assistant_xxx",
    "text": "我是你的助手，可以帮助你练习英语。",
    "is_final": true
  }
}
```

前端处理要求：

- 找到对应 assistant 消息。
- 如果不存在，就创建一条 assistant 消息。
- 用 `payload.text` 覆盖当前显示文本，作为最终版本。
- 将 `streaming` 标记为 `false`。

示例：

```js
function handleAiTextFinal(payload) {
  if (payload.turn_id !== activeTurnId) return

  let msg = messages.find(item => item.id === payload.message_id)

  if (!msg) {
    msg = {
      id: payload.message_id,
      role: 'assistant',
      text: '',
      streaming: false,
      interrupted: false,
      turnId: payload.turn_id
    }
    messages.push(msg)
  }

  msg.text = payload.text || msg.text
  msg.streaming = false
}
```

## 4. TTS 音频：`tts_audio_chunk`

这个事件保持现有逻辑，不需要因为文字流式输出而改变。

```json
{
  "event": "tts_audio_chunk",
  "payload": {
    "turn_id": "turn_xxx",
    "audio": "<base64 pcm>",
    "sample_rate": 16000,
    "format": "pcm_s16le",
    "text_span": "我是你的助手，",
    "is_last_chunk": true
  }
}
```

前端处理要求：

- 继续把后端音频放入播放队列。
- 不要使用 `ai_text_delta` 触发前端 TTS。
- 文字显示以 `ai_text_delta` / `ai_text` 为准，音频播放以 `tts_audio_chunk` 为准。

示例：

```js
function handleTtsAudioChunk(payload) {
  enqueueAndPlayAudio(payload)
}
```

## 5. 打断：`interrupt`

后端检测到用户插话时会发送：

```json
{
  "event": "interrupt",
  "payload": {
    "turn_id": "turn_xxx",
    "reason": "user_speech"
  }
}
```

前端处理要求：

- 立即停止当前正在播放的音频。
- 清空后续待播放音频队列。
- 将当前仍在流式生成的 assistant 消息标记为中断。
- 建议保留已经显示出来的文字，但可以在 UI 上显示“已打断”状态。

示例：

```js
function handleInterrupt(payload) {
  stopCurrentAudio()
  clearAudioQueue()

  messages.forEach(msg => {
    if (msg.role === 'assistant' && msg.streaming) {
      msg.streaming = false
      msg.interrupted = true
    }
  })
}
```

## 推荐消息结构

前端聊天消息可以使用如下结构：

```js
{
  id: 'assistant_xxx',
  role: 'assistant',
  text: '',
  streaming: true,
  interrupted: false,
  turnId: 'turn_xxx'
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `id` | 消息 ID，对应后端 `message_id` |
| `role` | `user` 或 `assistant` |
| `text` | 当前显示文本 |
| `streaming` | 是否仍在流式生成 |
| `interrupted` | 是否被用户插话打断 |
| `turnId` | 对应后端 `turn_id` |

## WebSocket 消息分发示例

```js
function handleWsMessage(raw) {
  const message = JSON.parse(raw.data)
  const { event, payload } = message

  switch (event) {
    case 'user_text':
      handleUserText(payload)
      break

    case 'ai_text_delta':
      handleAiTextDelta(payload)
      break

    case 'ai_text':
      handleAiTextFinal(payload)
      break

    case 'tts_audio_chunk':
      handleTtsAudioChunk(payload)
      break

    case 'interrupt':
      handleInterrupt(payload)
      break

    default:
      console.log('[full-duplex] unknown event:', event, payload)
  }
}
```

## 防止旧消息串台

因为全双工场景中用户可能频繁打断，前端需要防止旧轮次的消息继续写入当前 UI。

建议：

- 收到 `user_text` 时更新 `activeTurnId`。
- 收到 `ai_text_delta` / `ai_text` 时检查 `payload.turn_id === activeTurnId`。
- 如果不是当前轮次，直接丢弃。

示例：

```js
if (payload.turn_id !== activeTurnId) {
  return
}
```

注意：如果产品需要完整保留历史轮次，则不要简单丢弃旧 turn，而是根据 `turn_id` 写入对应历史消息。当前全双工实时页面推荐先采用丢弃旧 turn 的方案，更安全。

## UI 建议

前端可以给流式中的 assistant 消息加一个轻量状态：

- `streaming: true` 时显示打字光标或“正在生成”状态。
- 收到最终 `ai_text` 后取消状态。
- 收到 `interrupt` 后显示“已打断”或灰色尾巴。

不要因为 TTS 还没播放完就阻塞文字显示。文字和语音是两条轨道：

- 文字轨道：`ai_text_delta` -> `ai_text`
- 音频轨道：`tts_audio_chunk`

## 验收标准

前端完成后，应满足：

- 用户说完一句话后，页面能显示 `user_text` 对应的用户气泡。
- 模型生成时，assistant 气泡能随着 `ai_text_delta` 逐步追加文字。
- 收到最终 `ai_text` 后，assistant 气泡文本被最终完整回复校准。
- TTS 音频仍然按现有 `tts_audio_chunk` 播放。
- 收到 `interrupt` 后，当前音频立即停止，播放队列清空。
- 收到 `interrupt` 后，正在流式生成的 assistant 气泡不再继续追加旧内容。
- 连续打断、多轮对话时，不出现旧回复写入新气泡的问题。

## 重要约定

前端不要把 `ai_text_delta` 当成 TTS 输入。

前端不要依赖 `tts_audio_chunk.text_span` 来显示完整 AI 回复。

完整文本显示以这两个事件为准：

```text
ai_text_delta
ai_text
```

音频播放以这个事件为准：

```text
tts_audio_chunk
```

