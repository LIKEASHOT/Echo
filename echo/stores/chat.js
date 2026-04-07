import { defineStore } from 'pinia'
import { MESSAGE_STATUS, MESSAGE_TYPES } from '@/config/app.config.js'

/**
 * 聊天状态管理
 */
export const useChatStore = defineStore('chat', {
  state: () => ({
    // 消息列表
    messages: [],

    // 当前正在发送的消息
    currentMessage: null,

    // 发送状态
    isLoading: false,

    // 错误信息
    error: null,

    // 消息计数器（用于生成唯一ID）
    messageCounter: 0
  }),

  getters: {
    // 获取所有消息
    getAllMessages: (state) => state.messages,

    // 获取用户消息
    getUserMessages: (state) => state.messages.filter(msg => msg.isUser),

    // 获取AI消息
    getAIMessages: (state) => state.messages.filter(msg => !msg.isUser),

    // 获取最后一条消息
    getLastMessage: (state) => state.messages[state.messages.length - 1],

    // 获取发送状态
    getIsLoading: (state) => state.isLoading,

    // 获取错误信息
    getError: (state) => state.error,

    // 获取消息数量
    getMessageCount: (state) => state.messages.length
  },

  actions: {
    /**
     * 生成唯一消息ID
     */
    generateMessageId() {
      this.messageCounter++
      return `msg_${Date.now()}_${this.messageCounter}`
    },

    /**
     * 添加消息
     * @param {Object} message - 消息对象
     */
    addMessage(message) {
      const newMessage = {
        id: this.generateMessageId(),
        timestamp: Date.now(),
        status: MESSAGE_STATUS.SENT,
        type: MESSAGE_TYPES.TEXT,
        ...message
      }

      this.messages.push(newMessage)
      return newMessage.id
    },

    /**
     * 添加用户消息
     * @param {string} content - 消息内容
     * @param {string} type - 消息类型
     */
    addUserMessage(content, type = MESSAGE_TYPES.TEXT) {
      return this.addMessage({
        content,
        type,
        isUser: true
      })
    },

    /**
     * 添加AI消息
     * @param {string} content - 消息内容
     * @param {string} type - 消息类型
     * @param {string} audioUrl - 语音URL
     */
    addAIMessage(content, type = MESSAGE_TYPES.TEXT, audioUrl = null) {
      return this.addMessage({
        content,
        type,
        audioUrl,
        isUser: false
      })
    },

    /**
     * 更新消息
     * @param {string} messageId - 消息ID
     * @param {Object} updates - 更新内容
     */
    updateMessage(messageId, updates) {
      const index = this.messages.findIndex(msg => msg.id === messageId)
      if (index !== -1) {
        this.messages[index] = { ...this.messages[index], ...updates }
      }
    },

    /**
     * 删除消息
     * @param {string} messageId - 消息ID
     */
    deleteMessage(messageId) {
      const index = this.messages.findIndex(msg => msg.id === messageId)
      if (index !== -1) {
        this.messages.splice(index, 1)
      }
    },

    /**
     * 清空所有消息
     */
    clearMessages() {
      this.messages = []
      this.messageCounter = 0
    },

    /**
     * 设置发送状态
     * @param {boolean} loading - 是否正在发送
     */
    setLoading(loading) {
      this.isLoading = loading
    },

    /**
     * 设置错误信息
     * @param {string|null} error - 错误信息
     */
    setError(error) {
      this.error = error
    },

    /**
     * 开始发送消息
     * @param {Object} message - 消息对象
     */
    startSending(message) {
      this.currentMessage = message
      this.isLoading = true
      this.error = null
    },

    /**
     * 消息发送完成
     */
    finishSending() {
      this.currentMessage = null
      this.isLoading = false
      this.error = null
    },

    /**
     * 消息发送失败
     * @param {string} error - 错误信息
     */
    failSending(error) {
      this.isLoading = false
      this.error = error
      if (this.currentMessage) {
        this.updateMessage(this.currentMessage.id, {
          status: MESSAGE_STATUS.FAILED
        })
      }
    },

    /**
     * 从本地存储加载消息历史
     */
    loadMessageHistory() {
      try {
        const history = uni.getStorageSync('echosage_message_history')
        if (history && Array.isArray(history)) {
          this.messages = history
          // 更新计数器
          const maxId = Math.max(...history.map(msg => {
            const idParts = msg.id.split('_')
            return parseInt(idParts[idParts.length - 1]) || 0
          }), 0)
          this.messageCounter = maxId
        }
      } catch (error) {
        console.error('加载消息历史失败:', error)
      }
    },

    /**
     * 保存消息历史到本地存储
     */
    saveMessageHistory() {
      try {
        uni.setStorageSync('echosage_message_history', this.messages)
      } catch (error) {
        console.error('保存消息历史失败:', error)
      }
    }
  }
})