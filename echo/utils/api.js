import { API_CONFIG } from '@/config/api.config.js'
import { ERROR_MESSAGES } from '@/config/app.config.js'

/**
 * API请求工具类
 */
class ApiClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL
    this.timeout = API_CONFIG.TIMEOUT
    this.retryConfig = API_CONFIG.RETRY
  }

  /**
   * 统一请求方法
   * @param {string} endpoint - API端点
   * @param {Object} data - 请求数据
   * @param {Object} options - 请求选项
   * @returns {Promise}
   */
  async request(endpoint, data = {}, options = {}) {
    const url = this.baseURL + endpoint
    const config = {
      url,
      data,
      method: options.method || 'POST',
      header: {
        'Content-Type': options.contentType || 'application/json',
        ...options.headers
      },
      timeout: options.timeout || this.timeout,
      ...options
    }

    let attempts = 0
    const maxAttempts = options.retry !== false ? this.retryConfig.MAX_ATTEMPTS : 1

    while (attempts < maxAttempts) {
      try {
        attempts++
        console.log(`API请求 (${attempts}/${maxAttempts}):`, url, config.method)
        console.log('请求数据:', JSON.stringify(data).substring(0, 200))

        const response = await this.uniRequest(config)

        // 检查响应状态
        if (response.statusCode >= 200 && response.statusCode < 300) {
          console.log('API请求成功:', endpoint, '响应:', JSON.stringify(response.data).substring(0, 200))
          return response.data
        } else {
          throw new Error(response.data?.message || `HTTP ${response.statusCode}`)
        }

      } catch (error) {
        console.error(`API请求失败 (${attempts}/${maxAttempts}):`, error)

        // 如果不是最后一次尝试，等待后重试
        if (attempts < maxAttempts) {
          await this.delay(this.retryConfig.DELAY * attempts)
          continue
        }

        // 最后一次尝试失败，抛出错误
        throw this.handleError(error, endpoint)
      }
    }
  }

  /**
   * uni.request的Promise包装
   */
  uniRequest(config) {
    return new Promise((resolve, reject) => {
      uni.request({
        ...config,
        success: resolve,
        fail: reject
      })
    })
  }

  /**
   * 语音转文字
   * @param {string} audioData - 音频base64数据或file_id
   * @param {string} format - 音频格式
   * @param {boolean} useFileId - 是否使用file_id方式（默认为false，使用base64）
   * @returns {Promise<Object>}
   */
  async speechToText(audioData, format = 'mp3', useFileId = false) {
    const data = {
      format,
      language: 'auto' // 支持中英文自动识别
    }

    // 根据参数类型决定使用哪种方式
    if (useFileId) {
      data.file_id = audioData // 使用file_id方式
      console.log('使用file_id方式:', audioData)
    } else {
      data.audio = audioData // 使用base64方式
      console.log('使用base64方式，数据长度:', audioData.length)
    }

    const result = await this.request(API_CONFIG.ENDPOINTS.SPEECH_TO_TEXT, data, {
      contentType: 'application/json'
    })

    // 返回完整的响应数据
    if (result.success && result.data) {
      return {
        text: result.data.text || '',
        confidence: result.data.confidence || 0,
        language: result.data.language || 'unknown',
        duration: result.data.duration || 0,
        metadata: result.data.metadata || {}
      }
    }

    throw new Error(result.message || '语音识别失败')
  }

  /**
   * 发送聊天消息
   * @param {string} message - 用户消息
   * @param {Array} history - 对话历史
   * @param {Object} options - 聊天选项
   * @returns {Promise<Object>}
   */
  async sendChatMessage(message, history = [], options = {}) {
    const data = {
      message,
      history: history.slice(-10), // 只保留最近10条消息
      mode: options.mode || 'normal',
      ...options
    }

    const result = await this.request(API_CONFIG.ENDPOINTS.CHAT, data)

    // 返回完整的响应数据
    if (result.success && result.data) {
      return {
        text: result.data.text || '',
        audio_url: result.data.audio_url || null,
        metadata: result.data.metadata || {}
      }
    }

    throw new Error(result.message || '对话生成失败')
  }

  /**
   * 获取当前导出上下文对应的动态 system prompt
   * @param {Object} payload - 导出上下文
   * @param {string} payload.mode - 对话模式
   * @param {Array} payload.history - 当前聊天记录
   * @param {string} payload.message - 最后一条用户输入
   * @returns {Promise<string>}
   */
  async getSystemPrompt(payload = {}) {
    const result = await this.request(API_CONFIG.ENDPOINTS.SYSTEM_PROMPT, {
      mode: payload.mode || 'normal',
      history: Array.isArray(payload.history) ? payload.history : [],
      message: payload.message || ''
    })

    const prompt = result?.data?.system_prompt || result?.data?.prompt || result?.system_prompt || result?.prompt || ''
    if (prompt) {
      return String(prompt)
    }

    throw new Error(result.message || '获取system prompt失败')
  }

  /**
   * 文字转语音
   * @param {string} text - 要合成的文本
   * @param {Object} options - 语音选项
   * @returns {Promise<Object>}
   */
  async textToSpeech(text, options = {}) {
    const data = {
      text,
      language: options.language || 'en',
      ...options
    }

    const result = await this.request(API_CONFIG.ENDPOINTS.TEXT_TO_SPEECH, data)

    // 返回完整的响应数据
    if (result.success && result.data) {
      return {
        audio_url: result.data.audio_url || '',
        duration: result.data.duration || 0,
        size: result.data.size || 0,
        metadata: result.data.metadata || {}
      }
    }

    throw new Error(result.message || '语音合成失败')
  }

  /**
   * 文件上传（可选，用于上传音频文件）
   * @param {string} filePath - 文件路径
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>}
   */
  async uploadFile(filePath, options = {}) {
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: this.baseURL + (options.endpoint || '/upload'),
        filePath,
        name: options.name || 'file',
        formData: options.formData || {},
        header: options.headers || {},
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            resolve(data)
          } catch (error) {
            reject(new Error('上传响应解析失败'))
          }
        },
        fail: reject
      })
    })
  }

  /**
   * 错误处理
   * @param {Error} error - 原始错误
   * @param {string} endpoint - 请求端点
   * @returns {Error}
   */
  handleError(error, endpoint) {
    let message = ERROR_MESSAGES.NETWORK_ERROR

    if (error.message) {
      // 根据错误消息判断错误类型
      if (error.message.includes('timeout')) {
        message = '请求超时，请检查网络连接'
      } else if (error.message.includes('404')) {
        message = '服务不可用，请稍后重试'
      } else if (error.message.includes('500')) {
        message = ERROR_MESSAGES.SERVER_ERROR
      } else {
        message = error.message
      }
    }

    const apiError = new Error(message)
    apiError.endpoint = endpoint
    apiError.originalError = error

    return apiError
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 更新基础URL
   * @param {string} newBaseURL - 新的基础URL
   */
  updateBaseURL(newBaseURL) {
    this.baseURL = newBaseURL
    console.log('API基础URL已更新:', newBaseURL)
  }

  /**
   * 获取当前基础URL
   */
  getBaseURL() {
    return this.baseURL
  }
}

// 创建API客户端实例
const apiClient = new ApiClient()

// 导出便捷方法
export const apiRequest = apiClient.request.bind(apiClient)
export const speechToText = apiClient.speechToText.bind(apiClient)
export const sendChatMessage = apiClient.sendChatMessage.bind(apiClient)
export const getSystemPrompt = apiClient.getSystemPrompt.bind(apiClient)
export const textToSpeech = apiClient.textToSpeech.bind(apiClient)
export const uploadFile = apiClient.uploadFile.bind(apiClient)
export const updateApiBaseURL = apiClient.updateBaseURL.bind(apiClient)
export const getApiBaseURL = apiClient.getBaseURL.bind(apiClient)

// 导出默认实例
export default apiClient
