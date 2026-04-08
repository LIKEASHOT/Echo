<template>
  <view class="normal-input" :style="{ bottom: keyboardHeight + 'px' }">
    <!-- 输入工具栏 -->
    <view class="input-toolbar">
      <!-- 语音按钮 -->
      <view
        class="voice-btn"
        :class="{ 'active': isVoiceMode }"
        @tap="toggleVoiceMode"
      >
        <text class="voice-icon">🎤</text>
      </view>

      <!-- 输入框容器 -->
      <view class="input-container" :class="{ 'voice-mode': isVoiceMode }">
        <!-- 文本输入模式 -->
        <view v-if="!isVoiceMode" class="text-input-wrapper">
          <textarea
            class="text-input"
            :value="inputText"
            placeholder="输入消息或点击语音按钮..."
            :auto-height="true"
            :maxlength="-1"
            @input="handleInput"
            @focus="handleFocus"
            @blur="handleBlur"
            @keyboardheightchange="handleKeyboardHeightChange"
            :disabled="disabled" 
          />

        </view>

        <!-- 语音输入模式 -->
        <view v-else class="voice-input-wrapper">
          <view
            class="record-btn"
            :class="{
              'recording': isRecording,
              'disabled': disabled
            }"
            @tap="toggleRecording"
          >
            <text class="record-text">
              {{ isRecording ? `录音中... ${recordingDuration}s` : '点击录音' }}
            </text>
            <view v-if="isRecording" class="recording-indicator">
              <view class="pulse"></view>
            </view>
          </view>
        </view>
      </view>

      <!-- 发送按钮 -->
      <view
        class="send-btn"
        :class="{ 'active': canSend, 'disabled': disabled }"
        @tap="handleSend"
      >
        <text class="send-text">{{ isVoiceMode ? '📤' : '📤' }}</text>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// 组件属性
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

// 组件事件
const emit = defineEmits(['send-text', 'send-voice', 'start-recording', 'stop-recording'])

// 响应式数据
const inputText = ref('')
const isVoiceMode = ref(false)
const cursor = ref(0)
const isRecording = ref(false)
const recordingDuration = ref(0)
const hasRecordedAudio = ref(false) // 是否有录音内容
const recordedAudioDuration = ref(0) // 录音时长
const recordedAudioPath = ref('') // 录音文件路径

// 键盘高度相关
const keyboardHeight = ref(0)

// 录音管理器
let recorderManager = null
let recordingTimer = null

// 计算属性
const canSend = computed(() => {
  if (props.disabled) return false

  // 如果有录音内容，优先允许发送语音
  if (hasRecordedAudio.value) {
    return true
  }

  // 否则检查是否有文本内容
  return inputText.value.trim().length > 0
})

// 键盘高度变化处理
const handleKeyboardHeightChange = (event) => {
  console.log('键盘事件对象:', event)
  const height = event.detail?.height || event.height || 0
  console.log('解析出的键盘高度:', height, '当前键盘高度:', keyboardHeight.value)

  // 只有当高度真正改变时才更新，避免重复设置
  if (keyboardHeight.value !== height) {
    keyboardHeight.value = height/20
    console.log('键盘高度已更新为:', height)
  }
}

// 切换语音模式
const toggleVoiceMode = () => {
  if (props.disabled) return

  isVoiceMode.value = !isVoiceMode.value
  // showEmoji.value = false

  if (isVoiceMode.value) {
    // 切换到语音模式时，清空输入框
    inputText.value = ''
  }
} 
 

// 处理输入
const handleInput = (e) => {
  inputText.value = e.detail.value
  cursor.value = e.detail.cursor || 0
}

// 处理聚焦
const handleFocus = () => {
  console.log('输入框聚焦')
  // 聚焦时不需要特殊处理，键盘高度由keyboardheightchange事件处理
}

// 处理失焦
const handleBlur = () => {
  console.log('输入框失焦')
  // 失焦时重置键盘高度，确保输入框回到底部
  keyboardHeight.value = 0
}

// 发送文本消息
const handleSendText = () => {
  if (!canSend.value || isVoiceMode.value) return

  const text = inputText.value.trim()
  if (text) {
    emit('send-text', text)
    inputText.value = ''
    cursor.value = 0
    // showEmoji.value = false
  }
}

// 发送按钮点击
const handleSend = () => {
  console.log('发送按钮点击', {
    disabled: props.disabled,
    canSend: canSend.value,
    isVoiceMode: isVoiceMode.value,
    hasRecordedAudio: hasRecordedAudio.value,
    recordedAudioDuration: recordedAudioDuration.value
  })

  if (props.disabled || !canSend.value) {
    console.log('发送被阻止')
    return
  }

  // 优先发送录音内容（无论是否在语音模式）
  if (hasRecordedAudio.value && recordedAudioPath.value) {
    console.log('发送语音消息')
    emit('send-voice', {
      duration: recordedAudioDuration.value,
      filePath: recordedAudioPath.value
    })

    // 发送后重置录音状态
    hasRecordedAudio.value = false
    recordedAudioDuration.value = 0
    recordedAudioPath.value = ''
  } else {
    // 发送文本消息
    handleSendText()
  }
}

// 初始化录音管理器
const initRecorderManager = () => {
  if (!recorderManager) {
    try {
      recorderManager = uni.getRecorderManager()

      recorderManager.onStart(() => {
        console.log('录音开始')
        isRecording.value = true
        recordingDuration.value = 0
        hasRecordedAudio.value = false

        // 开始计时
        recordingTimer = setInterval(() => {
          recordingDuration.value += 1
          if (recordingDuration.value >= 60) { // 最多60秒
            stopRecording()
          }
        }, 1000)
      })

      recorderManager.onStop((res) => {
        console.log('录音停止', res)
        isRecording.value = false

        // 清除定时器
        if (recordingTimer) {
          clearInterval(recordingTimer)
          recordingTimer = null
        }

        const duration = recordingDuration.value
        recordingDuration.value = 0

        if (res && res.tempFilePath && duration > 0) {
          // 保存录音文件信息
          hasRecordedAudio.value = true
          recordedAudioDuration.value = duration
          recordedAudioPath.value = res.tempFilePath

          console.log('录音文件保存到:', res.tempFilePath)

          // 显示录音文件路径信息
          showRecordingPathInfo(res.tempFilePath)

          uni.showToast({
            title: `录音完成 (${duration}秒)`,
            icon: 'success',
            duration: 1500
          })
        } else {
          console.error('录音失败或没有录音文件')
          // 如果录音API不可用，模拟一个录音结果
          if (duration > 0) {
            hasRecordedAudio.value = true
            recordedAudioDuration.value = duration
            recordedAudioPath.value = 'simulated_audio.wav' // 模拟文件路径

            showRecordingPathInfo(recordedAudioPath.value)

            uni.showToast({
              title: `录音完成 (${duration}秒) - 模拟`,
              icon: 'success',
              duration: 1500
            })
          } else {
            uni.showToast({
              title: '录音失败',
              icon: 'error'
            })
          }
        }
      })

      recorderManager.onError((error) => {
        console.error('录音错误:', error)
        isRecording.value = false

        if (recordingTimer) {
          clearInterval(recordingTimer)
          recordingTimer = null
        }

        // 如果录音API出错，也模拟一个结果，让界面能工作
        const duration = recordingDuration.value
        if (duration > 0) {
          hasRecordedAudio.value = true
          recordedAudioDuration.value = duration
          recordedAudioPath.value = 'simulated_audio.wav'

          showRecordingPathInfo(recordedAudioPath.value)

          uni.showToast({
            title: `录音完成 (${duration}秒) - 模拟`,
            icon: 'success',
            duration: 1500
          })
        } else {
          uni.showToast({
            title: '录音失败',
            icon: 'error'
          })
        }
      })

    } catch (error) {
      console.error('初始化录音管理器失败:', error)

      // 如果完全无法初始化录音管理器，提供模拟功能
      console.log('使用模拟录音功能')
      recorderManager = {
        start: (options) => {
          console.log('模拟开始录音')
          isRecording.value = true
          recordingDuration.value = 0
          hasRecordedAudio.value = false

          recordingTimer = setInterval(() => {
            recordingDuration.value += 1
            if (recordingDuration.value >= 60) {
              this.onStop && this.onStop({ tempFilePath: 'simulated_audio.wav' })
            }
          }, 1000)

          this.onStart && this.onStart()
        },
        stop: () => {
          console.log('模拟停止录音')
          if (recordingTimer) {
            clearInterval(recordingTimer)
            recordingTimer = null
          }
          this.onStop && this.onStop({ tempFilePath: 'simulated_audio.wav' })
        }
      }
    }
  }
}

// 切换录音状态
const toggleRecording = () => {
  if (props.disabled) return

  if (isRecording.value) {
    // 正在录音，停止录音
    stopRecording()
  } else {
    // 没有录音，开始录音
    startRecording()
  }
}

// 开始录音
const startRecording = () => {
  // 初始化录音管理器
  initRecorderManager()

  // 检查录音权限（兼容性处理）
  if (typeof uni.authorize === 'function') {
    uni.authorize({
      scope: 'scope.record',
      success: () => {
        startRecordingInternal()
      },
      fail: () => {
        showPermissionModal()
      }
    })
  } else {
    // 如果authorize不可用，直接尝试录音
    console.log('uni.authorize不可用，直接开始录音')
    startRecordingInternal()
  }
}

// 显示权限提示弹窗
const showPermissionModal = () => {
  uni.showModal({
    title: '录音权限',
    content: '需要录音权限才能使用语音功能，请在设置中开启',
    showCancel: false,
    confirmText: '知道了',
    success: () => {
      // 尝试打开设置页面（如果可用）
      if (typeof uni.openSetting === 'function') {
        uni.openSetting()
      }
    }
  })
}

// 显示录音文件路径信息
const showRecordingPathInfo = (filePath) => {
  console.log('=== 录音文件路径信息 ===')
  console.log('相对路径:', filePath)

  // 不同平台上的实际位置
  const platformInfo = {
    'app-plus': 'Android/iOS应用临时目录',
    'h5': '浏览器内存或临时文件',
    'mp-weixin': '微信小程序临时文件',
    'mp-alipay': '支付宝小程序临时文件'
  }

  const platform = process.env.UNI_PLATFORM || 'unknown'
  console.log('当前平台:', platform)
  console.log('文件位置:', platformInfo[platform] || '未知平台')

  // 在开发环境中显示更详细的信息
  if (platform === 'h5' || platform === 'app-plus') {
    console.log('提示: 这个文件在应用重启后可能会被清理')
    console.log('如需持久保存，请在发送时复制到永久目录')
  }

  console.log('=== 录音文件路径信息 ===')
}

// 内部录音启动函数
const startRecordingInternal = () => {
  try {
    recorderManager.start({
      format: 'mp3', // 保存为mp3格式
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 64000,
      frameSize: 50
    })
    console.log('开始录音')
  } catch (error) {
    console.error('启动录音失败:', error)
    uni.showToast({
      title: '录音启动失败',
      icon: 'error'
    })
  }
}

// 停止录音
const stopRecording = () => {
  if (!isRecording.value) return

  recorderManager.stop()
  console.log('停止录音')
}

// 监听禁用状态变化
watch(() => props.disabled, (newVal) => {
  if (newVal) {
    // 禁用时停止录音
    if (isRecording.value) {
      stopRecording()
    }
  }
})

// 组件销毁时清理资源
const cleanup = () => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  if (isRecording.value && recorderManager) {
    recorderManager.stop()
  }
}

// 暴露清理方法
defineExpose({
  cleanup
})
</script>

<style lang="scss" scoped>
.normal-input {
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

.input-toolbar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  gap: 16rpx;

  .voice-btn {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    background-color: #F5F5F5;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;

    &.active {
      background-color: #007AFF;

      .voice-icon {
        color: white;
      }
    }

    &:active {
      transform: scale(0.95);
    }

    .voice-icon {
      font-size: 32rpx;
      color: #666666;
    }
  }

  .input-container {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    border-radius: 24rpx;
    background-color: #F5F5F5;
    padding: 0 24rpx;
    transition: all 0.3s ease;

    &.voice-mode {
      background-color: #FFF5F5;
    }

    .text-input-wrapper {
      display: flex;
      align-items: center;
      min-height: 80rpx;

      .text-input {
        flex: 1;
        font-size: 32rpx;
        color: #333333;
        padding: 16rpx 0;
        background-color: transparent;
        border: none;
        outline: none;
        /* textarea 专属 */
        resize: none;
        line-height: 1.5;
        min-height: 48rpx;
        max-height: 240rpx;
        overflow-y: auto;
        word-break: break-all;
      }

      .emoji-btn {
        width: 60rpx;
        height: 60rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 8rpx;

        &:active {
          opacity: 0.7;
        }

        .emoji-icon {
          font-size: 32rpx;
        }
      }
    }

    .voice-input-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80rpx;

      .record-btn {
        flex: 1;
        height: 64rpx;
        border-radius: 32rpx;
        background-color: #FF6B6B;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        position: relative;

        &.recording {
          background-color: #FF4757;
          animation: recording-pulse 1.5s ease-in-out infinite;
        }

        &.disabled {
          background-color: #CCCCCC;
          opacity: 0.6;
        }

        &:active:not(.disabled) {
          transform: scale(0.98);
        }

        .record-text {
          font-size: 28rpx;
          color: white;
          font-weight: 500;
        }

        .recording-indicator {
          position: absolute;
          right: 24rpx;
          width: 24rpx;
          height: 24rpx;

          .pulse {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.8);
            animation: indicator-pulse 1s ease-in-out infinite;
          }
        }
      }
    }
  }

  .send-btn {
    width: 140rpx;
    min-width: 140rpx;
    height: 72rpx;
    border-radius: 36rpx;
    border: 2rpx solid #E5E5EA;
    background-color: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-left: 8rpx;
    transition: all 0.3s ease;

    &.active {
      border-color: #007AFF;
      background-color: #007AFF;

      .send-text {
        color: white;
      }
    }

    &.disabled {
      border-color: #E5E5EA;
      background-color: transparent;
      opacity: 0.5;
    }

    &:active:not(.disabled) {
      transform: scale(0.95);
    }

    .send-text {
      font-size: 24rpx;
      color: #666666;
      font-weight: 500;
    }
  }
}


// 动画
@keyframes recording-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes indicator-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2);
  }
}

// 响应式设计
@media screen and (max-width: 750px) {
  .input-toolbar {
    padding: 12rpx 16rpx;
    gap: 12rpx;

    .voice-btn,
    .send-btn {
      width: 72rpx;
      height: 72rpx;
    }

    .input-container {
      padding: 0 20rpx;

      .text-input-wrapper {
        min-height: 72rpx;

        .text-input {
          font-size: 30rpx;
          padding: 12rpx 0;
        }

      }

      .voice-input-wrapper {
        min-height: 72rpx;

        .record-btn {
          height: 60rpx;

          .record-text {
            font-size: 26rpx;
          }
        }
      }
    }
  }

}
</style>