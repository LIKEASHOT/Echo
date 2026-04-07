/**
 * 应用全局配置文件
 */

// 应用基本信息
export const APP_INFO = {
  NAME: 'EchoSage',
  VERSION: '1.0.0',
  DESCRIPTION: '智能英语语音对话学习App'
}

// 存储键名配置
export const STORAGE_KEYS = {
  // 消息历史
  MESSAGE_HISTORY: 'echosage_message_history',
  // 用户设置
  USER_SETTINGS: 'echosage_user_settings',
  // 当前模式
  CURRENT_MODE: 'echosage_current_mode',
  // 语音设置
  AUDIO_SETTINGS: 'echosage_audio_settings'
}

// 默认设置
export const DEFAULT_SETTINGS = {
  // 默认模式：'normal' | 'phone'
  DEFAULT_MODE: 'normal',
  // 语音自动播放
  AUTO_PLAY_VOICE: true,
  // 语音播放速度
  VOICE_SPEED: 1.0,
  // 语音音量
  VOICE_VOLUME: 1.0,
  // 消息历史保留天数
  HISTORY_RETENTION_DAYS: 7,
  // 网络超时重试次数
  NETWORK_RETRY_COUNT: 3
}

// 错误消息配置
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  SERVER_ERROR: '服务器错误，请稍后重试',
  AUDIO_PERMISSION_DENIED: '录音权限被拒绝，请在设置中开启麦克风权限',
  AUDIO_RECORD_FAILED: '录音失败，请重试',
  AUDIO_PLAY_FAILED: '语音播放失败',
  INVALID_AUDIO_FORMAT: '音频格式不支持',
  MESSAGE_TOO_LONG: '消息内容过长，请简短描述',
  CHAT_TIMEOUT: '对话超时，请重试'
}

// 成功消息配置
export const SUCCESS_MESSAGES = {
  MESSAGE_SENT: '消息发送成功',
  AUDIO_RECORDED: '录音完成',
  MODE_SWITCHED: '模式切换成功',
  SETTINGS_SAVED: '设置保存成功'
}

// 模式配置
export const MODE_CONFIG = {
  NORMAL: {
    KEY: 'normal',
    NAME: '普通对话',
    DESCRIPTION: '传统聊天界面，支持文本和语音输入'
  },
  PHONE: {
    KEY: 'phone',
    NAME: '电话练习',
    DESCRIPTION: '模拟电话对话，全语音交互体验'
  }
}

// 消息类型配置
export const MESSAGE_TYPES = {
  TEXT: 'text',
  VOICE: 'voice',
  SYSTEM: 'system'
}

// 消息状态配置
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  PLAYING: 'playing'
}

// 导出默认配置
export default {
  APP_INFO,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  MODE_CONFIG,
  MESSAGE_TYPES,
  MESSAGE_STATUS
}