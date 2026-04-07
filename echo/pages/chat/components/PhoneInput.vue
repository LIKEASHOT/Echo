<template>
  <view class="phone-input" :style="{ bottom: keyboardHeight + 'px' }">
    <!-- 电话模式输入区域 -->
    <view class="phone-input-container">
      <!-- 录音按钮 -->
      <view class="record-section">
        <view
          class="phone-record-btn"
          :class="{
            'recording': recordingStarted,
            'disabled': disabled
          }"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
          @touchcancel="handleTouchCancel"
        >
          <!-- 录音状态指示器 -->
          <view class="record-indicator">
            <view v-if="!isRecording" class="mic-icon">🎤</view>
            <view v-else class="recording-animation">
              <view class="wave-bar" v-for="i in 5" :key="i" :style="{ animationDelay: i * 0.1 + 's' }"></view>
            </view>
          </view>

          <!-- 按钮文字 -->
          <text class="record-text">
            {{ getRecordButtonText() }}
          </text>

          <!-- 录音时长显示 -->
          <view v-if="recordingStarted && recordingDuration > 0" class="duration-display">
            <text class="duration-text">{{ formatDuration(recordingDuration) }}</text>
          </view>
        </view>

        <!-- 录音提示 -->
        <view v-if="recordingStarted" class="record-tip">
          <text class="tip-text">正在录音，请说话...</text>
        </view>
        <view v-else class="record-tip">
          <text class="tip-text">按住录音按钮开始，与AI进行电话对话</text>
        </view>
      </view>

     
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

// 组件属性
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  isRecording: {
    type: Boolean,
    default: false
  },
  recordingDuration: {
    type: Number,
    default: 0
  }
})

// 组件事件
const emit = defineEmits(['start-recording', 'stop-recording'])

// 响应式数据
const isPressed = ref(false)
const pressTimer = ref(null)
const recordingStarted = ref(false)

// 键盘高度相关
const keyboardHeight = ref(0)

// 键盘高度变化处理
const handleKeyboardHeightChange = (event) => {
  const height = event.detail?.height || event.height || 0
  console.log('电话模式键盘高度变化:', height)
  keyboardHeight.value = height
}

// 获取录音按钮文字
const getRecordButtonText = () => {
  if (props.disabled) {
    return '请等待...'
  }

  if (recordingStarted.value) {
    return '松开结束'
  }

  if (isPressed.value) {
    return '录音中...'
  }

  return '按住录音'
}

// 格式化时长显示
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 处理触摸开始
const handleTouchStart = (e) => {
  if (props.disabled || recordingStarted.value) return

  e.preventDefault()
  isPressed.value = true

  // 延迟开始录音，给用户准备时间
  pressTimer.value = setTimeout(() => {
    if (isPressed.value && !recordingStarted.value) {
      recordingStarted.value = true
      emit('start-recording')
    }
  }, 300) // 300ms延迟

  // 震动反馈
  try {
    uni.vibrateShort({ type: 'light' })
  } catch (error) {
    // 忽略震动错误
  }
}

// 处理触摸结束
const handleTouchEnd = (e) => {
  if (props.disabled) return

  e.preventDefault()
  isPressed.value = false

  // 清除定时器
  if (pressTimer.value) {
    clearTimeout(pressTimer.value)
    pressTimer.value = null
  }

  // 如果已经开始录音，则停止录音
  if (recordingStarted.value) {
    recordingStarted.value = false
    emit('stop-recording')
  }
}

// 处理触摸取消
const handleTouchCancel = (e) => {
  e.preventDefault()
  isPressed.value = false

  // 清除定时器
  if (pressTimer.value) {
    clearTimeout(pressTimer.value)
    pressTimer.value = null
  }
}
</script>

<style lang="scss" scoped>
.phone-input {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: white;
  border-top: 1rpx solid #E5E5EA;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 1000;
  transition: bottom 0.3s ease;
}

.phone-input-container {
  padding: 20rpx 24rpx;
}

.record-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;

  .phone-record-btn {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 0.3s ease;
    box-shadow: 0 8rpx 24rpx rgba(0, 122, 255, 0.3);

    &.recording {
      background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
      transform: scale(1.1);
      box-shadow: 0 12rpx 32rpx rgba(255, 107, 107, 0.4);
      animation: recording-glow 2s ease-in-out infinite;
    }

    &.disabled {
      background: linear-gradient(135deg, #CCCCCC 0%, #AAAAAA 100%);
      box-shadow: none;
      transform: none;
      opacity: 0.6;
    }

    &:active:not(.disabled) {
      transform: scale(0.95);
    }

    .record-indicator {
      margin-bottom: 8rpx;

      .mic-icon {
        font-size: 48rpx;
        color: white;
      }

      .recording-animation {
        display: flex;
        align-items: center;
        gap: 4rpx;
        height: 40rpx;

        .wave-bar {
          width: 6rpx;
          height: 100%;
          background-color: white;
          border-radius: 3rpx;
          animation: wave-animation 1.2s ease-in-out infinite;
        }
      }
    }

    .record-text {
      font-size: 26rpx;
      color: white;
      font-weight: 500;
      text-align: center;
      line-height: 1.2;
    }

    .duration-display {
      position: absolute;
      top: -16rpx;
      right: -16rpx;
      background-color: rgba(255, 255, 255, 0.9);
      border-radius: 20rpx;
      padding: 4rpx 12rpx;
      min-width: 80rpx;
      display: flex;
      align-items: center;
      justify-content: center;

      .duration-text {
        font-size: 24rpx;
        color: #FF6B6B;
        font-weight: bold;
        font-family: 'Courier New', monospace;
      }
    }
  }

  .record-tip {
    text-align: center;

    .tip-text {
      font-size: 26rpx;
      color: #666666;
      line-height: 1.4;
    }
  }
}

.mode-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-top: 16rpx;
  padding: 12rpx 20rpx;
  background-color: #F0F8FF;
  border-radius: 16rpx;
  border: 1rpx solid #B0E0E6;

  .hint-icon {
    font-size: 28rpx;
  }

  .hint-text {
    font-size: 24rpx;
    color: #007AFF;
    font-weight: 500;
  }
}

// 动画
@keyframes recording-glow {
  0%, 100% {
    box-shadow: 0 12rpx 32rpx rgba(255, 107, 107, 0.4);
  }
  50% {
    box-shadow: 0 16rpx 40rpx rgba(255, 107, 107, 0.6);
  }
}

@keyframes wave-animation {
  0%, 100% {
    height: 40rpx;
    opacity: 0.7;
  }
  50% {
    height: 60rpx;
    opacity: 1;
  }
}

// 响应式设计
@media screen and (max-width: 750px) {
  .phone-input-container {
    padding: 24rpx 16rpx;
  }

  .record-section {
    gap: 20rpx;

    .phone-record-btn {
      width: 140rpx;
      height: 140rpx;

      .record-indicator {
        .mic-icon {
          font-size: 42rpx;
        }

        .recording-animation {
          height: 36rpx;

          .wave-bar {
            width: 5rpx;
          }
        }
      }

      .record-text {
        font-size: 24rpx;
      }

      .duration-display {
        top: -12rpx;
        right: -12rpx;
        padding: 2rpx 8rpx;
        min-width: 70rpx;

        .duration-text {
          font-size: 22rpx;
        }
      }
    }

    .record-tip {
      .tip-text {
        font-size: 24rpx;
      }
    }
  }

  .mode-hint {
    padding: 8rpx 16rpx;

    .hint-icon {
      font-size: 26rpx;
    }

    .hint-text {
      font-size: 22rpx;
    }
  }
}
</style>