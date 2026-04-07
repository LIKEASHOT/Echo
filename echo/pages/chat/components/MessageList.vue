<template>
  <scroll-view
    class="message-list"
    scroll-y="true"
    :scroll-top="scrollTop"
    :scroll-with-animation="true"
    @scrolltolower="handleScrollToLower"
  >
    <!-- 消息列表 -->
    <view class="messages-container" :class="{ 'phone-mode': mode === 'phone' }">
      <view
        v-for="(message, index) in messages"
        :key="message.id"
        class="message-item"
        :class="{ 'first-message': index === 0, 'last-message': index === messages.length - 1 }"
      >
        <MessageBubble
          :message="message"
          :mode="mode"
          :show-timestamp="shouldShowTimestamp(index)"
          @play-audio="handlePlayAudio"
          @bubble-tap="handleBubbleTap"
        />
      </view>

      <!-- 加载状态指示器 -->
      <view v-if="isLoading && messages.length > 0" class="loading-indicator">
        <view class="loading-spinner"></view>
        <text class="loading-text">AI正在思考...</text>
      </view>

      <!-- 空状态 -->
      <view v-if="messages.length === 0 && !isLoading" class="empty-state">
        <view class="empty-icon">💬</view>
        <text class="empty-text">开始您的英语对话之旅吧！</text>
        <text class="empty-hint">点击下方录音按钮或输入文字开始对话</text>
      </view>
    </view>

  </scroll-view>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import MessageBubble from './MessageBubble.vue'

// 组件属性
const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  mode: {
    type: String,
    default: 'normal',
    validator: (value) => ['normal', 'phone'].includes(value)
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  autoScroll: {
    type: Boolean,
    default: true
  }
})

// 组件事件
const emit = defineEmits(['play-audio', 'bubble-tap', 'load-more'])

// 响应式数据
const scrollTop = ref(0)


// 监听消息变化，自动滚动
watch(() => props.messages.length, async (newLength, oldLength) => {
  console.log('MessageList: 消息数量变化', oldLength, '->', newLength)
  console.log('MessageList: 当前消息列表', props.messages.map(msg => ({ id: msg.id, type: msg.type, content: msg.content.substring(0, 20) })))

  if (newLength > oldLength && props.autoScroll) {
    await nextTick()
    // 自动滚动到最新消息（通过设置scrollTop为一个大值）
    // 使用 nextTick 确保 DOM 更新后再滚动
    nextTick(() => {
      scrollTop.value = 99999
    })
  }
})

// 监听消息内容变化
watch(() => props.messages, (newMessages, oldMessages) => {
  console.log('MessageList: 消息内容变化')
  console.log('新消息:', newMessages[newMessages.length - 1])
}, { deep: true })

// 判断是否显示时间戳
const shouldShowTimestamp = (index) => {
  if (index === 0) return true

  const currentMessage = props.messages[index]
  const prevMessage = props.messages[index - 1]

  if (!currentMessage || !prevMessage) return true

  // 相邻消息时间间隔超过5分钟时显示时间戳
  const timeDiff = currentMessage.timestamp - prevMessage.timestamp
  return timeDiff > 5 * 60 * 1000
}

// 处理音频播放
const handlePlayAudio = (data) => {
  emit('play-audio', data)
}

// 处理气泡点击
const handleBubbleTap = (message) => {
  emit('bubble-tap', message)
}



// 处理滚动到底部
const handleScrollToLower = () => {
  emit('load-more')
}



// 滚动到底部
const scrollToBottom = () => {
  // 使用 nextTick 确保 DOM 更新后再滚动
  nextTick(() => {
    scrollTop.value = 99999
  })
}

// 暴露给父组件
defineExpose({
  scrollToBottom
})

// 组件挂载后自动滚动到底部
onMounted(() => {
  setTimeout(() => {
    scrollToBottom()
  }, 200)
})

</script>

<style lang="scss" scoped>
.message-list {
  flex: 1;
  background-color: #F5F5F5;
}

.messages-container {
  box-sizing: border-box;
  padding: 32rpx 0;
  /* 普通模式：输入框约120rpx高，留有余量 */
  padding-bottom: 120rpx;
  min-height: 100%;

  /* 电话模式：输入框约240rpx高，留有余量 */
  &.phone-mode {
    padding-bottom: 240rpx;
  }
}

.message-item {
  &.first-message {
    margin-top: 32rpx;
  }

  &.last-message {
    margin-bottom: 32rpx;
  }
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  gap: 16rpx;

  .loading-spinner {
    width: 32rpx;
    height: 32rpx;
    border: 3rpx solid #E5E5EA;
    border-top: 3rpx solid #007AFF;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    font-size: 28rpx;
    color: #666666;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  padding: 64rpx;
  text-align: center;

  .empty-icon {
    font-size: 120rpx;
    margin-bottom: 32rpx;
    opacity: 0.6;
  }

  .empty-text {
    font-size: 36rpx;
    color: #333333;
    margin-bottom: 16rpx;
    font-weight: 500;
  }

  .empty-hint {
    font-size: 28rpx;
    color: #666666;
    line-height: 1.5;
  }
}


// 动画
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

// 响应式设计
@media screen and (max-width: 750px) {
  .messages-container {
    padding: 16rpx 0;
    /* 小屏幕普通模式 */
    padding-bottom: 110rpx;

    /* 小屏幕电话模式 */
    &.phone-mode {
      padding-bottom: 240rpx; 
    }
  } 

  .empty-state {
    height: 50vh;
    padding: 32rpx;

    .empty-icon {
      font-size: 100rpx;
      margin-bottom: 24rpx;
    }

    .empty-text {
      font-size: 32rpx;
    }

    .empty-hint {
      font-size: 26rpx;
    }
  }

}
</style>