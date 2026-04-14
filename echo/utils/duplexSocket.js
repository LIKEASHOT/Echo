// duplexSocket.js - 仅提供 WebSocket URL 和文本聊天能力
// 全双工语音模式的 WebSocket 由 renderjs 内部的原生 WebSocket 直接管理
import { API_CONFIG } from '@/config/api.config.js'

export function getWsUrl() {
  return API_CONFIG.BASE_URL.replace('http', 'ws') + '/ws/full-duplex'
}
