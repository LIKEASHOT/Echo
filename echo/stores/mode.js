import { defineStore } from 'pinia'
import { MODE_CONFIG, DEFAULT_SETTINGS } from '@/config/app.config.js'

/**
 * 模式状态管理
 */
export const useModeStore = defineStore('mode', {
  state: () => ({
    // 当前模式：'normal' | 'phone'
    currentMode: DEFAULT_SETTINGS.DEFAULT_MODE,

    // 录音状态
    isRecording: false,

    // 录音时长（秒）
    recordingDuration: 0,

    // 录音定时器
    recordingTimer: null,

    // 模式切换动画状态
    isSwitchingMode: false
  }),

  getters: {
    // 获取当前模式
    getCurrentMode: (state) => state.currentMode,

    // 是否为普通模式
    isNormalMode: (state) => state.currentMode === MODE_CONFIG.NORMAL.KEY,

    // 是否为电话模式
    isPhoneMode: (state) => state.currentMode === MODE_CONFIG.PHONE.KEY,

    // 获取当前模式配置
    getCurrentModeConfig: (state) => {
      return state.currentMode === MODE_CONFIG.NORMAL.KEY
        ? MODE_CONFIG.NORMAL
        : MODE_CONFIG.PHONE
    },

    // 获取录音状态
    getIsRecording: (state) => state.isRecording,

    // 获取录音时长
    getRecordingDuration: (state) => state.recordingDuration,

    // 是否正在切换模式
    getIsSwitchingMode: (state) => state.isSwitchingMode
  },

  actions: {
    /**
     * 切换模式
     * @param {string} newMode - 新模式 ('normal' | 'phone')
     */
    async switchMode(newMode) {
      if (this.isSwitchingMode) return

      // 验证模式
      if (!Object.values(MODE_CONFIG).some(config => config.KEY === newMode)) {
        console.error('无效的模式:', newMode)
        return
      }

      // 如果已经是当前模式，直接返回
      if (this.currentMode === newMode) return

      this.isSwitchingMode = true

      try {
        // 如果正在录音，先停止录音
        if (this.isRecording) {
          this.stopRecording()
        }

        // 切换模式
        const oldMode = this.currentMode
        this.currentMode = newMode

        // 保存到本地存储
        this.saveCurrentMode()

        // 显示切换提示
        const modeConfig = this.getCurrentModeConfig
        uni.showToast({ 
          title: `切换成功`,
          icon: 'success',
          duration: 1500
        })

        // 触发模式切换事件
        uni.$emit('mode-switched', {
          oldMode,
          newMode,
          modeConfig
        })

        console.log(`模式切换: ${oldMode} -> ${newMode}`)

      } catch (error) {
        console.error('模式切换失败:', error)
        uni.showToast({
          title: '模式切换失败',
          icon: 'error'
        })
      } finally {
        this.isSwitchingMode = false
      }
    },

    /**
     * 切换到普通模式
     */
    switchToNormalMode() {
      this.switchMode(MODE_CONFIG.NORMAL.KEY)
    },

    /**
     * 切换到电话模式
     */
    switchToPhoneMode() {
      this.switchMode(MODE_CONFIG.PHONE.KEY)
    },

    /**
     * 开始录音
     */
    startRecording() {
      if (this.isRecording) return

      this.isRecording = true
      this.recordingDuration = 0

      // 启动定时器，更新录音时长
      this.recordingTimer = setInterval(() => {
        this.recordingDuration += 1
      }, 1000)

      // 触发录音开始事件
      uni.$emit('recording-started')

      console.log('开始录音')
    },

    /**
     * 停止录音
     */
    stopRecording() {
      if (!this.isRecording) return

      this.isRecording = false

      // 清除定时器
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer)
        this.recordingTimer = null
      }

      const duration = this.recordingDuration
      this.recordingDuration = 0

      // 触发录音停止事件
      uni.$emit('recording-stopped', { duration })

      console.log(`停止录音，时长: ${duration}秒`)
    },

    /**
     * 取消录音
     */
    cancelRecording() {
      if (!this.isRecording) return

      this.isRecording = false

      // 清除定时器
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer)
        this.recordingTimer = null
      }

      this.recordingDuration = 0

      // 触发录音取消事件
      uni.$emit('recording-cancelled')

      console.log('取消录音')
    },

    /**
     * 从本地存储加载当前模式
     */
    loadCurrentMode() {
      try {
        const savedMode = uni.getStorageSync('echosage_current_mode')
        if (savedMode && Object.values(MODE_CONFIG).some(config => config.KEY === savedMode)) {
          this.currentMode = savedMode
        }
      } catch (error) {
        console.error('加载模式设置失败:', error)
        // 使用默认模式
        this.currentMode = DEFAULT_SETTINGS.DEFAULT_MODE
      }
    },

    /**
     * 保存当前模式到本地存储
     */
    saveCurrentMode() {
      try {
        uni.setStorageSync('echosage_current_mode', this.currentMode)
      } catch (error) {
        console.error('保存模式设置失败:', error)
      }
    },

    /**
     * 重置为默认模式
     */
    resetToDefaultMode() {
      this.switchMode(DEFAULT_SETTINGS.DEFAULT_MODE)
    }
  }
})