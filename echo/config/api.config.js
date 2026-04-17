/**
 * API配置文件
 * 统一管理后端接口地址和相关配置
 */

// 后端服务器地址配置
export const API_CONFIG = {
  // 后端基础地址 - 修改此地址即可切换不同环境
  // BASE_URL: 'http://117.50.163.138:8000', // 开发环境 
  // BASE_URL: 'https://api.echosage.com', // 生产环境 
  //BASE_URL: 'http://211.80.196.57:8000', // 线上测试
  BASE_URL: 'http://127.0.0.1:8000',
 

  // API路径配置
  ENDPOINTS: {
    // 语音识别
    SPEECH_TO_TEXT: '/api/speech-to-text',
    // 文本对话
    CHAT: '/api/chat',
    // 语音合成
    TEXT_TO_SPEECH: '/api/text-to-speech',
    // WebSocket连接（可选）
    WEBSOCKET: '/ws/chat'
  },

  // 请求超时时间（毫秒）
  TIMEOUT: 50000,

  // 重试配置
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000 // 重试间隔
  }
}

// WebSocket配置
export const WS_CONFIG = {
  RECONNECT_INTERVAL: 3000, // 重连间隔
  MAX_RECONNECT_ATTEMPTS: 5,
  HEARTBEAT_INTERVAL: 30000 // 心跳间隔
}

// 语音配置
export const AUDIO_CONFIG = {
  RECORDER: {
    FORMAT: 'mp3',
    SAMPLE_RATE: 16000,
    MAX_DURATION: 60000, // 最长录音时间（毫秒）
    MIN_DURATION: 500    // 最短录音时间（毫秒）
  },
  PLAYER: {
    AUTOPLAY_DELAY: 500 // 自动播放延迟（毫秒）
  }
}

// 应用配置
export const APP_CONFIG = {
  // 消息相关
  MESSAGE: {
    MAX_LENGTH: 1000,      // 单条消息最大长度
    HISTORY_LIMIT: 100,    // 本地历史记录最大条数
    AUTO_SCROLL_DELAY: 300 // 自动滚动延迟
  },

  // 界面相关
  UI: {
    ANIMATION_DURATION: 300, // 动画持续时间
    TOAST_DURATION: 2000     // Toast显示时间
  }
}

// 导出默认配置
export default {
  API_CONFIG,
  WS_CONFIG,
  AUDIO_CONFIG,
  APP_CONFIG
}