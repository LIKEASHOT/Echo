import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/config/app.config.js'

/**
 * 本地存储工具类
 */
export class StorageManager {
  /**
   * 获取存储的数据
   * @param {string} key - 存储键
   * @param {*} defaultValue - 默认值
   * @returns {*}
   */
  static get(key, defaultValue = null) {
    try {
      const value = uni.getStorageSync(key)
      return value !== undefined && value !== null ? value : defaultValue
    } catch (error) {
      console.error('获取存储数据失败:', key, error)
      return defaultValue
    }
  }

  /**
   * 设置存储的数据
   * @param {string} key - 存储键
   * @param {*} value - 要存储的值
   * @returns {boolean}
   */
  static set(key, value) {
    try {
      uni.setStorageSync(key, value)
      return true
    } catch (error) {
      console.error('设置存储数据失败:', key, error)
      return false
    }
  }

  /**
   * 删除存储的数据
   * @param {string} key - 存储键
   * @returns {boolean}
   */
  static remove(key) {
    try {
      uni.removeStorageSync(key)
      return true
    } catch (error) {
      console.error('删除存储数据失败:', key, error)
      return false
    }
  }

  /**
   * 清空所有存储数据
   * @returns {boolean}
   */
  static clear() {
    try {
      uni.clearStorageSync()
      return true
    } catch (error) {
      console.error('清空存储数据失败:', error)
      return false
    }
  }

  /**
   * 获取存储信息
   * @returns {Object}
   */
  static getInfo() {
    try {
      return uni.getStorageInfoSync()
    } catch (error) {
      console.error('获取存储信息失败:', error)
      return null
    }
  }
}

/**
 * 消息历史存储管理
 */
export class MessageHistoryManager {
  /**
   * 保存消息历史
   * @param {Array} messages - 消息数组
   * @returns {boolean}
   */
  static saveHistory(messages) {
    if (!Array.isArray(messages)) {
      console.error('消息历史必须是数组')
      return false
    }

    try {
      // 只保留最近的消息
      const recentMessages = messages.slice(-DEFAULT_SETTINGS.HISTORY_RETENTION_DAYS * 50)

      // 清理消息中的大对象
      const cleanedMessages = recentMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        type: msg.type,
        isUser: msg.isUser,
        timestamp: msg.timestamp,
        status: msg.status
        // 不保存audioUrl，因为URL可能过期
      }))

      return StorageManager.set(STORAGE_KEYS.MESSAGE_HISTORY, cleanedMessages)
    } catch (error) {
      console.error('保存消息历史失败:', error)
      return false
    }
  }

  /**
   * 加载消息历史
   * @returns {Array}
   */
  static loadHistory() {
    try {
      const history = StorageManager.get(STORAGE_KEYS.MESSAGE_HISTORY, [])
      return Array.isArray(history) ? history : []
    } catch (error) {
      console.error('加载消息历史失败:', error)
      return []
    }
  }

  /**
   * 清空消息历史
   * @returns {boolean}
   */
  static clearHistory() {
    return StorageManager.remove(STORAGE_KEYS.MESSAGE_HISTORY)
  }

  /**
   * 添加单条消息到历史
   * @param {Object} message - 消息对象
   * @returns {boolean}
   */
  static addMessage(message) {
    const history = this.loadHistory()
    history.push(message)

    // 限制历史记录数量
    if (history.length > DEFAULT_SETTINGS.HISTORY_RETENTION_DAYS * 50) {
      history.splice(0, history.length - DEFAULT_SETTINGS.HISTORY_RETENTION_DAYS * 50)
    }

    return this.saveHistory(history)
  }
}

/**
 * 设置存储管理
 */
export class SettingsManager {
  /**
   * 获取用户设置
   * @returns {Object}
   */
  static getSettings() {
    const savedSettings = StorageManager.get(STORAGE_KEYS.USER_SETTINGS, {})
    return { ...DEFAULT_SETTINGS, ...savedSettings }
  }

  /**
   * 保存用户设置
   * @param {Object} settings - 设置对象
   * @returns {boolean}
   */
  static saveSettings(settings) {
    const currentSettings = this.getSettings()
    const newSettings = { ...currentSettings, ...settings }
    return StorageManager.set(STORAGE_KEYS.USER_SETTINGS, newSettings)
  }

  /**
   * 获取单个设置项
   * @param {string} key - 设置键
   * @param {*} defaultValue - 默认值
   * @returns {*}
   */
  static getSetting(key, defaultValue = null) {
    const settings = this.getSettings()
    return settings[key] !== undefined ? settings[key] : defaultValue
  }

  /**
   * 设置单个设置项
   * @param {string} key - 设置键
   * @param {*} value - 设置值
   * @returns {boolean}
   */
  static setSetting(key, value) {
    return this.saveSettings({ [key]: value })
  }

  /**
   * 重置设置为默认值
   * @returns {boolean}
   */
  static resetSettings() {
    return StorageManager.set(STORAGE_KEYS.USER_SETTINGS, DEFAULT_SETTINGS)
  }
}

/**
 * 音频设置存储管理
 */
export class AudioSettingsManager {
  /**
   * 获取音频设置
   * @returns {Object}
   */
  static getAudioSettings() {
    return StorageManager.get(STORAGE_KEYS.AUDIO_SETTINGS, {
      volume: 1.0,
      speed: 1.0,
      muted: false,
      autoPlay: true
    })
  }

  /**
   * 保存音频设置
   * @param {Object} settings - 音频设置
   * @returns {boolean}
   */
  static saveAudioSettings(settings) {
    const currentSettings = this.getAudioSettings()
    const newSettings = { ...currentSettings, ...settings }
    return StorageManager.set(STORAGE_KEYS.AUDIO_SETTINGS, newSettings)
  }

  /**
   * 获取音频音量
   * @returns {number}
   */
  static getVolume() {
    return this.getAudioSettings().volume
  }

  /**
   * 设置音频音量
   * @param {number} volume - 音量 (0-1)
   * @returns {boolean}
   */
  static setVolume(volume) {
    return this.saveAudioSettings({ volume: Math.max(0, Math.min(1, volume)) })
  }

  /**
   * 获取播放速度
   * @returns {number}
   */
  static getSpeed() {
    return this.getAudioSettings().speed
  }

  /**
   * 设置播放速度
   * @param {number} speed - 播放速度
   * @returns {boolean}
   */
  static setSpeed(speed) {
    return this.saveAudioSettings({ speed: Math.max(0.5, Math.min(2.0, speed)) })
  }

  /**
   * 获取静音状态
   * @returns {boolean}
   */
  static getMuted() {
    return this.getAudioSettings().muted
  }

  /**
   * 设置静音状态
   * @param {boolean} muted - 是否静音
   * @returns {boolean}
   */
  static setMuted(muted) {
    return this.saveAudioSettings({ muted })
  }

  /**
   * 获取自动播放设置
   * @returns {boolean}
   */
  static getAutoPlay() {
    return this.getAudioSettings().autoPlay
  }

  /**
   * 设置自动播放
   * @param {boolean} autoPlay - 是否自动播放
   * @returns {boolean}
   */
  static setAutoPlay(autoPlay) {
    return this.saveAudioSettings({ autoPlay })
  }
}

// 导出便捷方法
export const storage = StorageManager
export const messageHistory = MessageHistoryManager
export const userSettings = SettingsManager
export const audioSettings = AudioSettingsManager

// 默认导出
export default {
  storage,
  messageHistory,
  userSettings,
  audioSettings
}