import { AUDIO_CONFIG } from '@/config/api.config.js'
import { ERROR_MESSAGES } from '@/config/app.config.js'

/**
 * 语音录制管理器
 */
export class VoiceRecorder {
  constructor(options = {}) {
    this.recorder = null
    this.isRecording = false
    this.recordingDuration = 0
    this.timer = null
    this.options = {
      onStart: options.onStart || (() => {}),
      onStop: options.onStop || (() => {}),
      onError: options.onError || (() => {}),
      onTimeUpdate: options.onTimeUpdate || (() => {}),
      maxDuration: options.maxDuration || AUDIO_CONFIG.RECORDER.MAX_DURATION,
      minDuration: options.minDuration || AUDIO_CONFIG.RECORDER.MIN_DURATION
    }
  }

  /**
   * 检查录音权限
   */
  async checkPermission() {
    return new Promise((resolve) => {
      uni.getSetting({
        success: (res) => {
          if (res.authSetting['scope.record']) {
            resolve(true)
          } else {
            // 请求授权
            uni.authorize({
              scope: 'scope.record',
              success: () => resolve(true),
              fail: () => {
                uni.showModal({
                  title: '录音权限',
                  content: '需要录音权限才能使用语音功能，请在设置中开启',
                  showCancel: false,
                  confirmText: '去设置',
                  success: () => {
                    uni.openSetting()
                  }
                })
                resolve(false)
              }
            })
          }
        },
        fail: () => resolve(false)
      })
    })
  }

  /**
   * 开始录音
   */
  async startRecording() {
    if (this.isRecording) {
      console.warn('已经在录音中')
      return false
    }

    try {
      // 检查权限
      const hasPermission = await this.checkPermission()
      if (!hasPermission) {
        throw new Error('没有录音权限')
      }

      // 获取录音管理器
      this.recorder = uni.getRecorderManager()

      // 设置录音事件
      this.recorder.onStart(() => {
        console.log('录音开始')
        this.isRecording = true
        this.recordingDuration = 0

        // 启动定时器
        this.timer = setInterval(() => {
          this.recordingDuration += 1
          this.options.onTimeUpdate(this.recordingDuration)

          // 检查最大时长
          if (this.recordingDuration >= this.options.maxDuration / 1000) {
            this.stopRecording()
          }
        }, 1000)

        this.options.onStart()
      })

      this.recorder.onStop((res) => {
        console.log('录音停止', res)
        this.isRecording = false

        // 清除定时器
        if (this.timer) {
          clearInterval(this.timer)
          this.timer = null
        }

        // 检查录音时长
        if (this.recordingDuration < this.options.minDuration / 1000) {
          this.options.onError(new Error('录音时间太短'))
          return
        }

        // 返回录音结果
        this.options.onStop({
          tempFilePath: res.tempFilePath,
          duration: res.duration,
          fileSize: res.fileSize
        })
      })

      this.recorder.onError((error) => {
        console.error('录音错误:', error)
        this.isRecording = false

        if (this.timer) {
          clearInterval(this.timer)
          this.timer = null
        }

        this.options.onError(error)
      })

      // 开始录音
      this.recorder.start({
        format: AUDIO_CONFIG.RECORDER.FORMAT,
        duration: this.options.maxDuration,
        sampleRate: AUDIO_CONFIG.RECORDER.SAMPLE_RATE
      })

      return true

    } catch (error) {
      console.error('开始录音失败:', error)
      this.options.onError(error)
      return false
    }
  }

  /**
   * 停止录音
   */
  stopRecording() {
    if (!this.isRecording || !this.recorder) {
      return false
    }

    try {
      this.recorder.stop()
      return true
    } catch (error) {
      console.error('停止录音失败:', error)
      this.options.onError(error)
      return false
    }
  }

  /**
   * 取消录音
   */
  cancelRecording() {
    if (!this.isRecording) {
      return false
    }

    this.isRecording = false

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    if (this.recorder) {
      try {
        this.recorder.stop()
      } catch (error) {
        // 忽略停止错误
      }
    }

    return true
  }

  /**
   * 获取录音状态
   */
  getRecordingState() {
    return {
      isRecording: this.isRecording,
      duration: this.recordingDuration
    }
  }

  /**
   * 销毁录音管理器
   */
  destroy() {
    this.cancelRecording()
    this.recorder = null
  }
}

/**
 * 音频播放器
 */
export class AudioPlayer {
  constructor(options = {}) {
    this.audioContext = null
    this.currentSrc = null
    this.isPlaying = false
    this.options = {
      onPlay: options.onPlay || (() => {}),
      onPause: options.onPause || (() => {}),
      onStop: options.onStop || (() => {}),
      onEnded: options.onEnded || (() => {}),
      onError: options.onError || (() => {}),
      onTimeUpdate: options.onTimeUpdate || (() => {}),
      autoplay: options.autoplay || false
    }

    this.initAudioContext()
  }

  /**
   * 初始化音频上下文
   */
  initAudioContext() {
    if (this.audioContext) {
      this.audioContext.destroy()
    }

    this.audioContext = uni.createInnerAudioContext()

    // 设置事件监听
    this.audioContext.onPlay(() => {
      this.isPlaying = true
      this.options.onPlay()
    })

    this.audioContext.onPause(() => {
      this.isPlaying = false
      this.options.onPause()
    })

    this.audioContext.onStop(() => {
      this.isPlaying = false
      this.options.onStop()
    })

    this.audioContext.onEnded(() => {
      this.isPlaying = false
      this.options.onEnded()
    })

    this.audioContext.onError((error) => {
      this.isPlaying = false
      console.error('音频播放错误:', error)
      this.options.onError(error)
    })

    this.audioContext.onTimeUpdate(() => {
      this.options.onTimeUpdate({
        currentTime: this.audioContext.currentTime,
        duration: this.audioContext.duration,
        progress: this.audioContext.duration > 0 ?
          this.audioContext.currentTime / this.audioContext.duration : 0
      })
    })
  }

  /**
   * 播放音频
   * @param {string} src - 音频URL或本地路径
   * @param {Object} options - 播放选项
   */
  async play(src, options = {}) {
    if (!src) {
      throw new Error('音频源不能为空')
    }

    try {
      // 如果正在播放其他音频，先停止
      if (this.isPlaying && this.currentSrc !== src) {
        this.stop()
      }

      // 设置音频源
      this.audioContext.src = src
      this.currentSrc = src

      // 应用播放选项
      if (options.volume !== undefined) {
        this.audioContext.volume = Math.max(0, Math.min(1, options.volume))
      }
      if (options.speed !== undefined) {
        this.audioContext.playbackRate = Math.max(0.5, Math.min(2.0, options.speed))
      }

      // 开始播放
      await new Promise((resolve, reject) => {
        const playPromise = this.audioContext.play()

        if (playPromise !== undefined) {
          playPromise.then(resolve).catch(reject)
        } else {
          // 兼容性处理
          setTimeout(resolve, 100)
        }
      })

      return true

    } catch (error) {
      console.error('播放音频失败:', error)
      this.options.onError(error)
      return false
    }
  }

  /**
   * 暂停播放
   */
  pause() {
    if (this.audioContext && this.isPlaying) {
      this.audioContext.pause()
    }
  }

  /**
   * 继续播放
   */
  resume() {
    if (this.audioContext && !this.isPlaying && this.currentSrc) {
      this.audioContext.play()
    }
  }

  /**
   * 停止播放
   */
  stop() {
    if (this.audioContext) {
      this.audioContext.stop()
    }
    this.isPlaying = false
  }

  /**
   * 设置播放位置
   * @param {number} position - 播放位置（秒）
   */
  seek(position) {
    if (this.audioContext && position >= 0) {
      this.audioContext.seek(position)
    }
  }

  /**
   * 设置音量
   * @param {number} volume - 音量 (0-1)
   */
  setVolume(volume) {
    if (this.audioContext) {
      this.audioContext.volume = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * 设置播放速度
   * @param {number} speed - 播放速度 (0.5-2.0)
   */
  setSpeed(speed) {
    if (this.audioContext) {
      this.audioContext.playbackRate = Math.max(0.5, Math.min(2.0, speed))
    }
  }

  /**
   * 获取播放状态
   */
  getPlaybackState() {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.audioContext?.currentTime || 0,
      duration: this.audioContext?.duration || 0,
      currentSrc: this.currentSrc
    }
  }

  /**
   * 销毁播放器
   */
  destroy() {
    this.stop()
    if (this.audioContext) {
      this.audioContext.destroy()
      this.audioContext = null
    }
    this.currentSrc = null
  }
}

/**
 * 音频文件处理工具
 */
export class AudioUtils {
  /**
   * 将文件转换为base64
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>}
   */
  static async fileToBase64(filePath) {
    return new Promise((resolve, reject) => {
      uni.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          resolve(res.data)
        },
        fail: (error) => {
          console.error('文件转base64失败:', error)
          reject(error)
        }
      })
    })
  }

  /**
   * 获取音频文件信息
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>}
   */
  static async getAudioInfo(filePath) {
    return new Promise((resolve, reject) => {
      uni.getFileSystemManager().getFileInfo({
        filePath,
        success: (res) => {
          resolve({
            size: res.size,
            createTime: res.createTime,
            path: filePath
          })
        },
        fail: reject
      })
    })
  }

  /**
   * 格式化音频时长
   * @param {number} duration - 时长（秒）
   * @returns {string}
   */
  static formatDuration(duration) {
    if (typeof duration !== 'number' || duration < 0) {
      return '00:00'
    }

    const minutes = Math.floor(duration / 60)
    const seconds = Math.floor(duration % 60)

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  /**
   * 验证音频文件格式
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  static validateAudioFormat(filePath) {
    const supportedFormats = ['.mp3', '.wav', '.m4a', '.aac']
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'))
    return supportedFormats.includes(extension)
  }
}

// 导出便捷的单例实例
let globalVoiceRecorder = null
let globalAudioPlayer = null

export const getVoiceRecorder = (options) => {
  if (!globalVoiceRecorder) {
    globalVoiceRecorder = new VoiceRecorder(options)
  }
  return globalVoiceRecorder
}

export const getAudioPlayer = (options) => {
  if (!globalAudioPlayer) {
    globalAudioPlayer = new AudioPlayer(options)
  }
  return globalAudioPlayer
}

export const destroyGlobalInstances = () => {
  if (globalVoiceRecorder) {
    globalVoiceRecorder.destroy()
    globalVoiceRecorder = null
  }
  if (globalAudioPlayer) {
    globalAudioPlayer.destroy()
    globalAudioPlayer = null
  }
}