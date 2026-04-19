<template>
  <view class="message-bubble-wrapper" :class="{ 'user-message': isUser, 'ai-message': !isUser }">
    <!-- AI头像（仅AI消息显示） -->
    <view v-if="!isUser" class="avatar">
      <image class="avatar-image" src="/static/avatar.png" mode="aspectFill"></image>
    </view>

    <!-- 消息内容 -->
    <view class="message-content">
      <!-- 消息气泡 -->
      <view
        class="message-bubble"
        :class="{ 'user-bubble': isUser, 'ai-bubble': !isUser }"
        @tap="handleBubbleTap"
      >
        <!-- 文本消息 -->
        <view
          v-if="message.type === 'text'"
          class="text-message-container"
          :class="{ 'long-pressing': isLongPressing }"
        >
          <text
            class="message-text"
            @longpress="handleLongPress(message.content, 'text')"
            @touchstart="handleLongPressStart($event, 'text')"
            @touchend="handleLongPressEnd"
          >{{ message.content }}</text>
        </view>

        <!-- 语音消息 -->
        <view v-else-if="message.type === 'voice'" class="voice-content" :class="{ 'playing': isPlaying }">
          <text class="voice-icon" :class="{ 'playing': isPlaying }">🎵</text>
          <text class="voice-text" :class="{ 'playing': isPlaying }">语音消息</text>
          <text class="voice-duration" :class="{ 'playing': isPlaying }">{{ formatDuration(message.duration) }}</text>
        </view>
      </view>

      <!-- 语音识别的文字内容（显示在气泡下方） -->
      <view
        v-if="message.type === 'voice'"
        class="recognized-text-container"
        :class="{ 'long-pressing': isLongPressing }"
      >
        <text
          v-if="message.recognizedText"
          class="recognized-text"
          @longpress="handleLongPress(message.recognizedText, 'recognized')"
          @touchstart="handleLongPressStart($event, 'voice')"
          @touchend="handleLongPressEnd"
        >{{ message.recognizedText }}</text>
        <text v-else-if="message.status === 'failed'" class="recognized-text error-text">语音识别失败</text>
        <text v-else class="recognized-text processing-text">正在识别中...</text>
      </view>

      <!-- 消息状态和时间 -->
      <view class="message-meta">
        <!-- 发送状态 -->
        <view v-if="showStatus" class="message-status">
          <text v-if="message.status === 'sending'" class="status-sending">发送中...</text>
          <text v-else-if="message.status === 'failed'" class="status-failed">发送失败</text>
        </view>

        <!-- 时间戳 -->
        <text v-if="showTimestamp" class="message-time">{{ formatTime(message.timestamp) }}</text>
      </view>
    </view>

  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useAudioStore } from '@/stores/audio.js'

// 组件属性
const props = defineProps({
  message: {
    type: Object,
    required: true,
    validator: (value) => {
      return value && value.id && typeof value.content === 'string'
    }
  },
  mode: {
    type: String,
    default: 'normal',
    validator: (value) => ['normal', 'phone'].includes(value)
  },
  showTimestamp: {
    type: Boolean,
    default: true
  },
  showStatus: {
    type: Boolean,
    default: true
  }
})

// 组件事件
const emit = defineEmits(['play-audio', 'bubble-tap'])

// 使用音频store
const audioStore = useAudioStore()

// 长按状态
const isLongPressing = ref(false)

// 计算属性
const isUser = computed(() => props.message.isUser)
const isPlaying = computed(() => audioStore.currentPlayingId === props.message.id && audioStore.isPlaying)

// 长按开始 - 显示缩放动画
const handleLongPressStart = (event, messageType = 'text') => {
  // 只有文本消息或有识别文字的语音消息才显示缩放动画
  if (messageType === 'text' || (messageType === 'voice' && props.message.recognizedText)) {
    isLongPressing.value = true
  }
}

// 长按结束 - 隐藏缩放动画
const handleLongPressEnd = () => {
  isLongPressing.value = false
}

// 长按复制文本内容
const handleLongPress = (text, type = 'text') => {
  if (!text || text.trim() === '') {
    handleLongPressEnd()
    return
  }

  uni.setClipboardData({
    data: text,
    success: () => {
      // 复制成功，触发震动反馈
      uni.vibrateShort({
        type: 'light'
      })

      uni.showToast({
        title: type === 'recognized' ? '识别文字已复制' : '消息已复制',
        icon: 'success',
        duration: 1500
      })

      handleLongPressEnd()
    },
    fail: () => {
      uni.showToast({
        title: '复制失败',
        icon: 'error',
        duration: 1500
      })

      handleLongPressEnd()
    }
  })
}

// 格式化时间显示
const formatTime = (timestamp) => {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  // 今天的消息只显示时间
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 昨天及以前的消息显示日期和时间
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化语音时长
const formatDuration = (duration) => {
  if (!duration && duration !== 0) return ''

  // duration已经是秒数，直接使用
  const seconds = Math.floor(duration) || 0
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `0:${remainingSeconds.toString().padStart(2, '0')}`
}

// 处理气泡点击
const handleBubbleTap = () => {
  // 如果是语音消息，触发播放
  if (props.message.type === 'voice') {
    handlePlayTap()
  } else {
    // 其他消息类型触发bubble-tap事件
    emit('bubble-tap', props.message)
  }
}

// 处理播放按钮点击
const handlePlayTap = () => {
  // 检查是否有音频源（audioUrl或filePath）
  const hasAudio = props.message.audioUrl || props.message.filePath
  if (!hasAudio) return

  if (isPlaying.value) {
    // 正在播放，暂停
    audioStore.pauseAudio()
  } else {
    // 开始播放，传递完整消息对象
    emit('play-audio', props.message)
  }
}
</script>

<style lang="scss" scoped>
.message-bubble-wrapper {
  display: flex;
  margin: 16rpx 0;
  padding: 0 32rpx;
  align-items: flex-start;

  &.user-message {
    flex-direction: row-reverse;

    .message-content {
      align-items: flex-end;
    }
  }

  &.ai-message {
    flex-direction: row;
    padding-left: 16rpx;

    .message-content {
      align-items: flex-start;
    }

    .avatar {
      margin-left: 0;
      margin-right: 12rpx;
    }
  }
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: #F5F5F5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 16rpx;
  overflow: hidden;

  .avatar-image {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.message-bubble {
  padding: 20rpx 24rpx;
  border-radius: 18rpx;
  word-wrap: break-word;
  position: relative;

  &.user-bubble {
    background-color: #007AFF;
    color: white;
    border-bottom-right-radius: 6rpx;
  }

  &.ai-bubble {
    background-color: #E5E5EA;
    color: #333333;
    border-bottom-left-radius: 6rpx;
  }
}

.message-text {
  font-size: 32rpx;
  line-height: 1.4;
}

// 长按缩放动画容器
.text-message-container,
.recognized-text-container {
  transition: transform 0.15s ease;

  &.long-pressing {
    transform: scale(0.95);
    transition: transform 0.1s ease;
  }
}

.voice-content {
  display: flex;
  align-items: center;
  gap: 16rpx;
  position: relative;

  .voice-icon {
    font-size: 32rpx;
  }

  .voice-text {
    font-size: 32rpx;
    color: inherit;
    transition: color 0.3s ease;
  }

  .voice-duration {
    font-size: 24rpx;
    color: #666666;
    margin-left: auto;
    transition: color 0.3s ease;
  }

  // 播放时的视觉反馈
  &.playing {
    .voice-icon {
      color: #FFFFFF;
      animation: music-note-bounce 1.5s ease-in-out infinite;
    }

    .voice-text {
      color: #FFFFFF;
      font-weight: 500;
    }

    .voice-duration {
      color: #FFFFFF;
    }
  }
}

// 语音识别文字容器
.recognized-text-container {
  margin-top: 12rpx;
  padding: 16rpx 20rpx;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 12rpx;
  max-width: 100%;

  .recognized-text {
    font-size: 28rpx;
    line-height: 1.5;
    color: #333333;
    word-wrap: break-word;

    &.processing-text {
      color: #FF9500;
      font-style: italic;
    }

    &.error-text {
      color: #FF3B30;
      font-weight: 500;
    }
  }
}

// 用户消息的识别文字样式
.user-message {
  .recognized-text-container {
    background-color: rgba(0, 122, 255, 0.1);

    .recognized-text {
      color: #007AFF;
    }
  }
}

// AI消息的识别文字样式
.ai-message {
  .recognized-text-container {
    background-color: rgba(229, 229, 234, 0.6);

    .recognized-text {
      color: #333333;
    }
  }
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
  padding: 0 8rpx;
}

.message-status {
  .status-sending {
    font-size: 24rpx;
    color: #666666;
  }

  .status-failed {
    font-size: 24rpx;
    color: #FF3B30;
  }
}

.message-time {
  font-size: 24rpx;
  color: #999999;
}

.play-button {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: #007AFF;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 16rpx;
  transition: all 0.3s ease;

  &.playing {
    background-color: #FF9500;
    transform: scale(1.1);
  }

  .play-icon {
    font-size: 32rpx;
  }
}

// 音符跳动动画
@keyframes music-note-bounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  25% {
    transform: translateY(-4rpx) scale(1.1);
  }
  50% {
    transform: translateY(-2rpx) scale(1.05);
  }
  75% {
    transform: translateY(-6rpx) scale(1.15);
  }
}

// 响应式设计
@media screen and (max-width: 750px) {
  .message-bubble-wrapper {
    padding: 0 16rpx;
  }

  .message-content {
    max-width: 80%;
  }

  .message-bubble {
    padding: 16rpx 20rpx;

    &.user-bubble,
    &.ai-bubble {
      border-radius: 16rpx;
    }
  }

  .message-text {
    font-size: 28rpx;
  }

  .voice-content {
    .voice-icon {
      font-size: 28rpx;
    }

    .voice-text {
      font-size: 28rpx;
    }

    .voice-duration {
      font-size: 22rpx;
    }

    &.playing .voice-icon {
      animation: music-note-bounce 1.2s ease-in-out infinite;
    }
  }
}
</style>
