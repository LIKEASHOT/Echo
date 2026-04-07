import { defineStore } from 'pinia'
import { MESSAGE_STATUS } from '@/config/app.config.js'

/**
 * 音频状态管理
 */
export const useAudioStore = defineStore('audio', {
  state: () => ({
    // 当前播放的消息ID
    currentPlayingId: null,

    // 播放状态
    isPlaying: false,

    // 播放进度 (0-1)
    playbackProgress: 0,

    // 播放队列（电话模式下自动播放的多条消息）
    playbackQueue: [],

    // 自动播放开关
    autoPlayEnabled: true,

    // 音频上下文
    audioContext: null,

    // 播放设置
    settings: {
      volume: 1.0,      // 音量 (0-1)
      speed: 1.0,       // 播放速度
      muted: false      // 是否静音
    }
  }),

  getters: {
    // 获取当前播放ID
    getCurrentPlayingId: (state) => state.currentPlayingId,

    // 获取播放状态
    getIsPlaying: (state) => state.isPlaying,

    // 获取播放进度
    getPlaybackProgress: (state) => state.playbackProgress,

    // 获取播放队列
    getPlaybackQueue: (state) => state.playbackQueue,

    // 获取队列长度
    getQueueLength: (state) => state.playbackQueue.length,

    // 是否启用自动播放
    getAutoPlayEnabled: (state) => state.autoPlayEnabled,

    // 获取音频设置
    getAudioSettings: (state) => state.settings,

    // 是否有音频在播放
    hasPlayingAudio: (state) => state.isPlaying && state.currentPlayingId,

    // 是否有待播放的队列
    hasPlaybackQueue: (state) => state.playbackQueue.length > 0
  },

  actions: {
    /**
     * 初始化音频上下文
     */
    initAudioContext() {
      if (!this.audioContext) {
        this.audioContext = uni.createInnerAudioContext()
        this.setupAudioListeners()
      }
    },

    /**
     * 设置音频事件监听器
     */
    setupAudioListeners() {
      if (!this.audioContext) return

      // 播放开始
      this.audioContext.onPlay(() => {
        this.isPlaying = true
        console.log('音频播放开始:', this.currentPlayingId)
      })

      // 播放结束
      this.audioContext.onEnded(() => {
        this.isPlaying = false
        this.playbackProgress = 1.0

        // 触发播放结束事件
        uni.$emit('audio-playback-ended', { messageId: this.currentPlayingId })

        // 检查播放队列
        this.checkPlaybackQueue()

        console.log('音频播放结束:', this.currentPlayingId)
      })

      // 播放错误
      this.audioContext.onError((error) => {
        this.isPlaying = false
        this.playbackProgress = 0

        // 触发播放错误事件
        uni.$emit('audio-playback-error', {
          messageId: this.currentPlayingId,
          error
        })

        console.error('音频播放错误:', error)
      })

      // 播放进度更新
      this.audioContext.onTimeUpdate(() => {
        if (this.audioContext.duration > 0) {
          this.playbackProgress = this.audioContext.currentTime / this.audioContext.duration
        }
      })
    },

    /**
     * 播放音频
     * @param {string} messageId - 消息ID
     * @param {string} audioUrl - 音频URL
     * @param {Object} options - 播放选项
     */
    async playAudio(messageId, audioUrl, options = {}) {
      if (!audioUrl) {
        console.warn('音频URL为空')
        return false
      }

      try {
        // 初始化音频上下文
        this.initAudioContext()

        // 如果正在播放其他音频，先停止
        if (this.isPlaying && this.currentPlayingId !== messageId) {
          this.stopAudio()
        }

        // 设置音频源
        this.audioContext.src = audioUrl
        this.currentPlayingId = messageId

        // 应用播放设置
        this.audioContext.volume = this.settings.volume
        this.audioContext.playbackRate = this.settings.speed

        // 开始播放
        this.audioContext.play()

        // 更新消息状态
        if (options.updateMessageStatus) {
          uni.$emit('update-message-status', {
            messageId,
            status: MESSAGE_STATUS.PLAYING
          })
        }

        console.log('开始播放音频:', messageId, audioUrl)
        return true

      } catch (error) {
        console.error('播放音频失败:', error)
        this.resetPlaybackState()
        return false
      }
    },

    /**
     * 停止播放音频
     */
    stopAudio() {
      if (this.audioContext && this.isPlaying) {
        this.audioContext.stop()
      }
      this.resetPlaybackState()
    },

    /**
     * 暂停播放音频
     */
    pauseAudio() {
      if (this.audioContext && this.isPlaying) {
        this.audioContext.pause()
        this.isPlaying = false
      }
    },

    /**
     * 继续播放音频
     */
    resumeAudio() {
      if (this.audioContext && !this.isPlaying && this.currentPlayingId) {
        this.audioContext.play()
        this.isPlaying = true
      }
    },

    /**
     * 重置播放状态
     */
    resetPlaybackState() {
      this.currentPlayingId = null
      this.isPlaying = false
      this.playbackProgress = 0
    },

    /**
     * 添加到播放队列
     * @param {string} messageId - 消息ID
     * @param {string} audioUrl - 音频URL
     */
    addToPlaybackQueue(messageId, audioUrl) {
      if (!audioUrl) return

      // 检查是否已在队列中
      const exists = this.playbackQueue.some(item => item.messageId === messageId)
      if (!exists) {
        this.playbackQueue.push({
          messageId,
          audioUrl,
          addedAt: Date.now()
        })
        console.log('添加到播放队列:', messageId)
      }
    },

    /**
     * 从播放队列移除
     * @param {string} messageId - 消息ID
     */
    removeFromPlaybackQueue(messageId) {
      const index = this.playbackQueue.findIndex(item => item.messageId === messageId)
      if (index !== -1) {
        this.playbackQueue.splice(index, 1)
        console.log('从播放队列移除:', messageId)
      }
    },

    /**
     * 清空播放队列
     */
    clearPlaybackQueue() {
      this.playbackQueue = []
      console.log('清空播放队列')
    },

    /**
     * 检查播放队列并自动播放下一条
     */
    checkPlaybackQueue() {
      if (!this.autoPlayEnabled || this.playbackQueue.length === 0) return

      // 获取下一条要播放的音频
      const nextAudio = this.playbackQueue.shift()
      if (nextAudio) {
        // 延迟播放，给用户一点反应时间
        setTimeout(() => {
          this.playAudio(nextAudio.messageId, nextAudio.audioUrl, {
            updateMessageStatus: true
          })
        }, 800) // 800ms延迟
      }
    },

    /**
     * 设置自动播放开关
     * @param {boolean} enabled - 是否启用自动播放
     */
    setAutoPlay(enabled) {
      this.autoPlayEnabled = enabled
      this.saveAudioSettings()

      if (!enabled) {
        this.clearPlaybackQueue()
      }

      console.log('自动播放设置:', enabled)
    },

    /**
     * 设置音量
     * @param {number} volume - 音量 (0-1)
     */
    setVolume(volume) {
      const clampedVolume = Math.max(0, Math.min(1, volume))
      this.settings.volume = clampedVolume

      if (this.audioContext) {
        this.audioContext.volume = clampedVolume
      }

      this.saveAudioSettings()
    },

    /**
     * 设置播放速度
     * @param {number} speed - 播放速度
     */
    setSpeed(speed) {
      const clampedSpeed = Math.max(0.5, Math.min(2.0, speed))
      this.settings.speed = clampedSpeed

      if (this.audioContext) {
        this.audioContext.playbackRate = clampedSpeed
      }

      this.saveAudioSettings()
    },

    /**
     * 切换静音状态
     */
    toggleMute() {
      this.settings.muted = !this.settings.muted

      if (this.audioContext) {
        this.audioContext.volume = this.settings.muted ? 0 : this.settings.volume
      }

      this.saveAudioSettings()
    },

    /**
     * 从本地存储加载音频设置
     */
    loadAudioSettings() {
      try {
        const settings = uni.getStorageSync('echosage_audio_settings')
        if (settings) {
          this.settings = { ...this.settings, ...settings }
        }
      } catch (error) {
        console.error('加载音频设置失败:', error)
      }
    },

    /**
     * 保存音频设置到本地存储
     */
    saveAudioSettings() {
      try {
        uni.setStorageSync('echosage_audio_settings', this.settings)
      } catch (error) {
        console.error('保存音频设置失败:', error)
      }
    },

    /**
     * 重置音频设置
     */
    resetAudioSettings() {
      this.settings = {
        volume: 1.0,
        speed: 1.0,
        muted: false
      }
      this.saveAudioSettings()
    },

    /**
     * 销毁音频上下文
     */
    destroy() {
      if (this.audioContext) {
        this.audioContext.destroy()
        this.audioContext = null
      }
      this.resetPlaybackState()
      this.clearPlaybackQueue()
    }
  }
})