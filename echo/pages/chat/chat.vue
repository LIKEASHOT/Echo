<template>
  <view class="chat-page">
    <!-- 顶部占位，防止内容被导航栏遮挡 -->
    <view :style="{ height: windowTop + 'px' }"></view>

    <!-- #ifdef H5 -->
    <button
      class="export-copy-button"
      :style="{ top: exportButtonTop }"
      @tap="handleExportChat"
    >
      导出
    </button>
    <!-- #endif -->
    
    <!-- 消息列表 -->
    <MessageList
      v-show="currentMode === 'normal'"
      ref="messageListRef"
      :messages="messages"
      :mode="currentMode"
      :is-loading="isLoading"
      :style="{ height: messageListHeight }"
      @play-audio="handlePlayAudio"
      @bubble-tap="handleBubbleTap"
      @load-more="handleLoadMore"
    />

    <!-- 输入区域 -->
    <NormalInput
      v-show="currentMode === 'normal'"
      ref="normalInputRef"
      :disabled="isLoading"
      @send-text="handleSendText"
      @send-voice="handleSendVoice"
      @start-recording="startVoiceRecording"
      @stop-recording="stopVoiceRecording"
    />

    <!-- 全双工通话层 -->
    <FullDuplexScreen
      v-if="currentMode === 'phone'"
      :messages="messages"
      @end-call="switchMode"
      @sync-messages="handleDuplexMessages"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { onLoad, onShow, onHide, onNavigationBarButtonTap } from '@dcloudio/uni-app'
import MessageList from './components/MessageList.vue'
import NormalInput from './components/NormalInput.vue'
import FullDuplexScreen from './components/FullDuplexScreen.vue'

// 导入配置
import { MODE_CONFIG } from '@/config/app.config.js'
import { API_CONFIG } from '@/config/api.config.js'

// 导入stores
import { useAudioStore } from '@/stores/audio.js'

// 导入API工具
import { sendChatMessage, speechToText, textToSpeech, getSystemPrompt } from '@/utils/api.js'

// 组件引用
const messageListRef = ref(null)
const normalInputRef = ref(null)
const phoneInputRef = ref(null)

// 使用stores
const audioStore = useAudioStore()

// 录音定时器和录音管理器
let recordingTimer = null
let phoneRecorderManager = null
let recordedFilePath = null // 保存录音文件路径

// 对话状态跟踪
let hasNewMessages = false // 是否有新消息产生
let lastSavedMessageCount = 0 // 上次保存时的消息数量
let currentHistoryId = null // 当前对话的历史记录ID（如果是恢复的对话）

// 响应式数据
const messages = ref([
	{
		id: '1',
		content: '你好！我是你的英语对话练习助手。请说一句英语让我听听吧！',
		isUser: false,
		timestamp: Date.now() - 10000,
		status: 'sent',
		type: 'text'
	} 
])
const currentMode = ref('normal')
const isLoading = ref(false)
const isRecording = ref(false)
const recordingDuration = ref(0)

// 计算属性
const currentModeConfig = computed(() => {
	return currentMode.value === 'normal' ? MODE_CONFIG.NORMAL : MODE_CONFIG.PHONE
})

// 响应式数据 - 补充
const windowTop = ref(0)
// 系统信息获取
try {
	const systemInfo = uni.getSystemInfoSync()
	windowTop.value = systemInfo.windowTop || 0
} catch (e) {
	console.error('获取系统信息失败', e)
}

// 消息列表高度（输入框现在使用固定定位，不占用页面空间）
const messageListHeight = computed(() => {
	// 减去导航栏占位高度
	return `calc(100vh - ${windowTop.value}px)`
})

const exportButtonTop = computed(() => `${windowTop.value + 10}px`)

// 键盘事件现在由输入框组件处理

// 页面加载逻辑已在上面的onLoad中处理

// 页面显示
onShow(() => {
	console.log('聊天页面显示')
	// 确保导航栏标题正确显示
	updateNavigationBarTitle()
})

// 导航栏按钮点击处理
onNavigationBarButtonTap((e) => {
	console.log('导航栏按钮点击:', e)
	if (e && (e.index === 1 || e.text === '导出')) {
		handleExportChat()
		return
	}
	switchMode()
})

// 更新导航栏标题
const updateNavigationBarTitle = () => {
	const title = currentMode.value === 'normal' ? '智能助手' : '智能英语口语练习'
	uni.setNavigationBarTitle({
		title
	})
}

const getExportContent = (message) => {
	const content = message?.recognizedText || message?.content || ''
	return String(content).trim()
}

const buildExportHistory = () => {
	return messages.value
		.filter(msg => msg && !['error', 'failed', 'sending'].includes(msg.status))
		.map(msg => ({
			role: msg.isUser ? 'user' : 'assistant',
			content: getExportContent(msg)
		}))
		.filter(msg => msg.content)
}

const getLastUserMessage = (history) => {
	for (let i = history.length - 1; i >= 0; i--) {
		if (history[i].role === 'user') {
			return history[i].content
		}
	}
	return ''
}

const buildTrainingMessages = async () => {
	const history = buildExportHistory()
	const lastUserMessage = getLastUserMessage(history)

	if (!lastUserMessage) {
		return []
	}

	const systemPrompt = (await getSystemPrompt({
		mode: currentMode.value,
		history,
		message: lastUserMessage
	})).trim()

	if (!systemPrompt) {
		throw new Error('后端未返回system prompt')
	}

	const trainingMessages = [{
		role: 'system',
		content: systemPrompt
	}]

	trainingMessages.push(...history)

	return trainingMessages
}

const copyWithLegacyClipboard = (text) => {
	if (typeof document === 'undefined') return false

	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.setAttribute('readonly', '')
	textarea.style.position = 'fixed'
	textarea.style.left = '-9999px'
	textarea.style.top = '-9999px'
	document.body.appendChild(textarea)
	textarea.select()

	let copied = false
	try {
		copied = document.execCommand('copy')
	} catch (error) {
		console.error('fallback复制失败:', error)
	}

	document.body.removeChild(textarea)
	return copied
}

const copyTextToClipboard = (text) => {
	return new Promise((resolve, reject) => {
		uni.setClipboardData({
			data: text,
			success: resolve,
			fail: (error) => {
				if (copyWithLegacyClipboard(text)) {
					resolve()
				} else {
					reject(error)
				}
			}
		})
	})
}

const handleExportChat = async () => {
	try {
		uni.showLoading({
			title: '导出中',
			mask: true
		})

		const trainingMessages = await buildTrainingMessages()

		if (trainingMessages.length < 2) {
			uni.hideLoading()
			uni.showToast({
				title: '内容不足',
				icon: 'none',
				duration: 1600
			})
			return
		}

		const jsonlLine = JSON.stringify({
			messages: trainingMessages
		})

		await copyTextToClipboard(`${jsonlLine}\n`)
		console.log('[export] JSONL copied:', jsonlLine)
		uni.hideLoading()
		uni.showToast({
			title: '已复制JSONL',
			icon: 'success',
			duration: 1600
		})
	} catch (error) {
		uni.hideLoading()
		console.error('导出聊天记录失败:', error)
		uni.showToast({
			title: error.message || '导出失败',
			icon: 'error',
			duration: 1800
		})
	}
}

// 快速切换模式（延续当前对话）
// 删除指定模式中指定对话ID的历史记录
const deleteHistoryById = (mode, historyId) => {
	try {
		const key = mode === 'normal' ? 'echosage_history_normal' : 'echosage_history_phone'
		let history = uni.getStorageSync(key) || []

		// 删除指定的对话记录
		const originalLength = history.length
		history = history.filter(item => item.id !== historyId)
		const deletedCount = originalLength - history.length

		if (deletedCount > 0) {
			uni.setStorageSync(key, history)
			console.log(`已删除${mode}模式中ID为${historyId}的历史记录`)
		}
	} catch (error) {
		console.error('删除历史记录失败:', error)
	}
}

// 处理全双工通话同步回来的消息
const handleDuplexMessages = (newMsgs) => {
	if (!newMsgs || newMsgs.length === 0) return
	const existingIds = new Set(messages.value.map(m => m.id))
	let added = 0
	for (const msg of newMsgs) {
		if (!existingIds.has(msg.id)) {
			messages.value.push(msg)
			added++
		}
	}
	if (added > 0) {
		hasNewMessages = true
		console.log(`[chat] 合并全双工消息 ${added} 条，立即保存`)
		saveHistory()
	}
}

const switchMode = async () => {
	// 设置切换标记，阻止自动加载历史记录
	isSwitchingMode = true

	const oldMode = currentMode.value
	const newMode = currentMode.value === 'normal' ? 'phone' : 'normal'

	// 切换模式前停止录音
	if (isRecording.value) {
		if (currentMode.value === 'phone') {
			stopAndSendVoice()
		} else {
			stopVoiceRecording()
		}
	}

	// 如果有对话记录，将其转移到新模式
	if (currentHistoryId && messages.value.length > 1) { // 确保有实际的对话内容
		// 删除旧模式的记录
		deleteHistoryById(oldMode, currentHistoryId)

		// 保存到新模式
		const newKey = newMode === 'normal' ? 'echosage_history_normal' : 'echosage_history_phone'
		let newHistory = uni.getStorageSync(newKey) || []

		// 创建新模式的对话记录
		const newHistoryItem = {
			id: currentHistoryId, // 保持相同的ID
			mode: newMode,
			timestamp: Date.now(),
			messages: [...messages.value]
		}

		// 添加到新模式的开头
		newHistory.unshift(newHistoryItem)

		// 只保留最近50条记录
		if (newHistory.length > 50) {
			newHistory = newHistory.slice(0, 50)
		}

		uni.setStorageSync(newKey, newHistory)
		console.log('对话已转移到新模式:', newMode, currentHistoryId)
	}

	// 切换模式（聊天记录保持不变）- 使用setTimeout避免响应式副作用
	setTimeout(() => {
		currentMode.value = newMode
		updateNavigationBarTitle()
	}, 0)

	// 使用Toast通知用户模式切换
	uni.showToast({
		title: `切换成功`,
		icon: 'success',
		duration: 2000
	})

	// 停止音频播放
	audioStore.stopAll()

	// 重置切换标记
	setTimeout(() => {
		isSwitchingMode = false
	}, 100)

	console.log('模式切换完成，聊天记录保持不变')
}

// 页面隐藏
onHide(() => {
	console.log('聊天页面隐藏')

	// 停止所有音频播放
	audioStore.stopAudio()
	audioStore.clearPlaybackQueue()
})

// 页面卸载
onUnmounted(() => {
	handlePageUnload()
})

// 保存历史记录
const saveHistory = () => {
	// 检查是否有新消息产生
	if (!hasNewMessages || messages.value.length <= 1) {
		console.log('没有新消息，不保存历史记录')
		return
	}

	try {
		const key = currentMode.value === 'normal' ? 'echosage_history_normal' : 'echosage_history_phone'
		let history = uni.getStorageSync(key) || []

		// 如果当前对话是从历史记录恢复的，更新现有记录
		if (currentHistoryId) {
			const existingIndex = history.findIndex(item => item.id === currentHistoryId)
			if (existingIndex !== -1) {
				// 更新现有记录
				history[existingIndex] = {
					...history[existingIndex],
					timestamp: Date.now(), // 更新时间戳
					messages: [...messages.value] // 更新消息列表
				}


				// 将更新后的记录移到最前面
				const updatedItem = history.splice(existingIndex, 1)[0]
				history.unshift(updatedItem)

				uni.setStorageSync(key, history)
				console.log('历史记录已更新:', currentMode.value, currentHistoryId)

				// 重置标志
				hasNewMessages = false
				lastSavedMessageCount = messages.value.length
				return
			}
		}

		// 检查是否已经存在相同的对话（比较消息内容）
		const isDuplicate = history.some(item => {
			if (item.messages.length !== messages.value.length) return false

			// 比较消息内容是否相同
			return item.messages.every((savedMsg, index) => {
				const currentMsg = messages.value[index]
				return savedMsg.content === currentMsg.content &&
				       savedMsg.type === currentMsg.type &&
				       savedMsg.isUser === currentMsg.isUser
			})
		})

		if (isDuplicate) {
			console.log('发现重复对话，跳过保存')
			hasNewMessages = false // 重置标志
			lastSavedMessageCount = messages.value.length
			return
		}

		// 创建新记录
		const historyItem = {
			id: Date.now().toString(),
			mode: currentMode.value,
			timestamp: Date.now(),
			messages: [...messages.value] // 深拷贝消息列表
		}

		// 添加新记录到开头
		history.unshift(historyItem)

		// 只保留最近50条记录
		if (history.length > 50) {
			history = history.slice(0, 50)
		}

		uni.setStorageSync(key, history)
		console.log('历史记录已保存:', currentMode.value, historyItem.id)

		// 设置当前对话的历史ID（用于后续更新）
		currentHistoryId = historyItem.id

		// 重置标志
		hasNewMessages = false
		lastSavedMessageCount = messages.value.length

	} catch (error) {
		console.error('保存历史记录失败:', error)
	}
}

// 恢复历史记录
const restoreHistory = (historyData) => {
	if (historyData && historyData.messages) {
		messages.value = [...historyData.messages]
		currentHistoryId = historyData.id // 记录当前对话的历史ID
		console.log('历史记录已恢复:', historyData.messages.length, '条消息, ID:', currentHistoryId)

		// 重置状态，避免保存已存在的对话
		hasNewMessages = false
		lastSavedMessageCount = messages.value.length
	}
}

// 页面卸载时保存历史
const handlePageUnload = () => {
	console.log('聊天页面卸载')

	// 停止所有音频播放
	audioStore.stopAudio()
	audioStore.clearPlaybackQueue()

	// 保存历史记录
	saveHistory()

	// 清除录音定时器
	if (recordingTimer) {
		clearInterval(recordingTimer)
		recordingTimer = null
	}

	// 停止并清理录音管理器
	if (phoneRecorderManager && isRecording.value) {
		try {
			phoneRecorderManager.stop()
		} catch (error) {
			console.error('清理录音管理器失败:', error)
		}
	}
	phoneRecorderManager = null

	// 清理输入组件资源
	if (normalInputRef.value && normalInputRef.value.cleanup) {
		normalInputRef.value.cleanup()
	}
}

// 标记是否正在进行模式切换（避免自动加载历史记录）
let isSwitchingMode = false

// 键盘相关状态已移至输入框组件处理

// 页面加载时检查是否需要恢复历史
onLoad((options) => {
	console.log('聊天页面加载', options)

	// 从URL参数获取模式
	if (options.mode) {
		currentMode.value = options.mode
	}

	// 根据模式设置导航栏标题
	updateNavigationBarTitle()
 
	// 检查是否需要恢复历史记录
	if (options.restore === 'true') {
		const selectedHistory = uni.getStorageSync('echosage_selected_history')
		if (selectedHistory && selectedHistory.mode === currentMode.value) {
			restoreHistory(selectedHistory.history)
			// 清除临时数据
			uni.removeStorageSync('echosage_selected_history')
		}
	} else if (options.new === 'true') {
		// 开启新对话：重置所有状态，创建全新的对话
		currentHistoryId = null
		hasNewMessages = false
		lastSavedMessageCount = 0
		// 清空消息列表为初始状态
		messages.value = [
			{
				id: 'welcome',
				content: '欢迎开始新的英语对话练习！请说一句英语让我听听吧！',
				isUser: false,
				timestamp: Date.now(),
				status: 'sent',
				type: 'text'
			}
		]
		console.log('开启新对话，创建初始状态')
	} else {
		// 默认情况：加载最近的对话
		currentHistoryId = null
		// 尝试加载最近的对话
		loadRecentConversation()
	}
})

// 检查语音文件是否存在
const checkVoiceFileExists = (filePath) => {
	return new Promise((resolve) => {
		if (filePath.includes('uniapp_save')) {
			// 对于uni.saveFile保存的文件，使用getSavedFileInfo
			uni.getSavedFileInfo({
				filePath: filePath,
				success: (res) => {
					console.log('语音文件存在，大小:', res.size, '字节')
					resolve(true)
				},
				fail: (err) => {
					console.warn('语音文件不存在:', filePath, '错误:', err)
					resolve(false)
				}
			})
		} else {
			// 对于其他路径，使用FileSystemManager
			try {
				const fs = uni.getFileSystemManager()
				const fileInfo = fs.getFileInfoSync({
					filePath: filePath
				})
				console.log('语音文件存在，大小:', fileInfo.size, '字节')
				resolve(true)
			} catch (error) {
				console.warn('语音文件不存在:', filePath, '错误:', error.message)
				resolve(false)
			}
		}
	})
}

// 保存语音文件到持久化存储
const saveVoiceFileToPersistentStorage = (tempFilePath) => {
	return new Promise((resolve, reject) => {
		uni.saveFile({
			tempFilePath: tempFilePath,
			success: (res) => {
				console.log('语音文件保存成功:', res.savedFilePath)

				// 保存后立即验证文件
				uni.getSavedFileInfo({
					filePath: res.savedFilePath,
					success: (fileInfo) => {
						console.log('保存的文件验证成功，大小:', fileInfo.size, '字节')
						resolve(res.savedFilePath)
					},
					fail: (verifyError) => {
						console.error('保存的文件验证失败:', verifyError)
						// 即使验证失败，也返回保存的路径，因为uni.saveFile已经成功保存
						console.warn('文件保存成功但验证失败，仍然返回保存路径')
						resolve(res.savedFilePath)
					}
				})
			},
			fail: (err) => {
				console.error('语音文件保存失败:', err)
				reject(err)
			}
		})
	})
}

// 加载最近的对话
const loadRecentConversation = async () => {
	// 如果正在进行模式切换，不加载历史记录
	if (isSwitchingMode) {
		console.log('正在进行模式切换，跳过加载历史记录')
		return
	}

	try {
		const key = currentMode.value === 'normal' ? 'echosage_history_normal' : 'echosage_history_phone'
		const history = uni.getStorageSync(key) || []

		if (history.length > 0) {
			// 获取最近的对话（第一条）
			const recentConversation = history[0]
			if (recentConversation && recentConversation.messages) {
				// 异步处理消息，检查语音文件是否存在
				const processedMessages = []
				for (const msg of recentConversation.messages) {
					if (msg.type === 'voice' && msg.filePath && msg.isUser) {
						// 检查用户语音文件是否存在
						const fileExists = await checkVoiceFileExists(msg.filePath)
						if (!fileExists) {
							// 文件不存在，标记为已丢失
							const processedMsg = {
								...msg,
								content: '语音消息 (文件已丢失)',
								status: 'failed'
							}
							processedMessages.push(processedMsg)
							console.warn('语音文件不存在，已标记为丢失:', msg.filePath)
						} else {
							processedMessages.push(msg)
						}
					} else {
						processedMessages.push(msg)
					}
				}

				messages.value = processedMessages
				currentHistoryId = recentConversation.id // 记录历史ID
				console.log('已恢复最近对话:', processedMessages.length, '条消息, ID:', currentHistoryId)

				// 重置状态，避免保存已存在的对话
				hasNewMessages = false
				lastSavedMessageCount = messages.value.length
			}
		}
	} catch (error) {
		console.error('加载最近对话失败:', error)
	}
}

// 处理文本消息发送
const handleSendText = async (text) => {
	console.log('发送文本消息:', text)

	// 添加用户消息
	const userMessage = {
		id: Date.now().toString(),
		content: text,
		isUser: true,
		timestamp: Date.now(),
		status: 'sent',
		type: 'text'
	}
	messages.value.push(userMessage)

	// 标记有新消息
	hasNewMessages = true

	// 滚动到底部
	nextTick(() => {
		if (messageListRef.value && messageListRef.value.scrollToBottom) {
			messageListRef.value.scrollToBottom()
		}
	})

	// 设置加载状态
	isLoading.value = true

	try {
		// 构建对话历史（转换为后端需要的格式）
		const history = messages.value
			.filter(msg => msg.type === 'text')
			.slice(-10)
			.map(msg => ({
				role: msg.isUser ? 'user' : 'assistant',
				content: msg.content
			}))

		// 调用后端API
		const response = await sendChatMessage(text, history, {
			mode: currentMode.value
		})

		console.log('AI回复:', response)

		// 添加AI回复消息
		const aiMessage = {
			id: (Date.now() + 1).toString(),
			content: response.text,
			isUser: false,
			timestamp: Date.now(),
			status: 'sent',
			type: 'text',
			audioUrl: response.audio_url ? API_CONFIG.BASE_URL + response.audio_url : null
		}
		messages.value.push(aiMessage)

		// 滚动到底部
		nextTick(() => {
			if (messageListRef.value && messageListRef.value.scrollToBottom) {
				messageListRef.value.scrollToBottom()
			}
		})

	} catch (error) {
		console.error('发送消息失败:', error)
		
		// 添加错误提示消息
		const errorMessage = {
			id: (Date.now() + 1).toString(),
			content: '抱歉，消息发送失败，请检查网络连接后重试。',
			isUser: false,
			timestamp: Date.now(),
			status: 'error',
			type: 'text'
		}
		messages.value.push(errorMessage)

		uni.showToast({
			title: error.message || '发送失败',
			icon: 'error',
			duration: 2000
		})
	} finally {
		isLoading.value = false
	}
}

// 处理语音消息发送
const handleSendVoice = async (voiceData) => {
	console.log('=== 处理语音消息发送 ===')
	console.log('发送语音消息:', voiceData)

	const duration = voiceData?.duration || 0
	const filePath = voiceData?.filePath || ''
	console.log('语音时长:', duration, '文件路径:', filePath)

	// 创建语音消息气泡
	const voiceMessage = {
		id: Date.now().toString(),
		content: `语音消息 (${duration}秒)`,
		isUser: true,
		timestamp: Date.now(),
		status: 'sending',
		type: 'voice',
		duration: duration,
		audioUrl: null,
		filePath: filePath,
		recognizedText: '' // 用于存储识别的文字
	}
	console.log('创建语音消息:', voiceMessage)

	// 添加到消息列表
	messages.value.push(voiceMessage)

	// 标记有新消息
	hasNewMessages = true

	// 滚动到底部
	nextTick(() => {
		if (messageListRef.value && messageListRef.value.scrollToBottom) {
			messageListRef.value.scrollToBottom()
		}
	})

	// 设置加载状态
	isLoading.value = true

	try {
		console.log('开始上传音频文件到后端...')
 
		// 方法1：直接使用uni.uploadFile上传wav文件到通用上传接口
		const uploadResponse = await new Promise((resolve, reject) => {
			uni.uploadFile({
				url: API_CONFIG.BASE_URL + '/upload',
				filePath: filePath,
				name: 'file',
				formData: {
					'type': 'audio'
				},
				success: (res) => {
					console.log('文件上传成功:', res)
					try {
						const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
						resolve(data)
					} catch (error) {
						reject(new Error('上传响应解析失败'))
					}
				},
				fail: (err) => {
					console.error('文件上传失败:', err)
					reject(err)
				}
			})
		})

		console.log('音频文件上传成功:', uploadResponse)

		// 获取上传后的文件标识
		const fileId = uploadResponse.file_id || uploadResponse.data?.file_id

		if (!fileId) {
			throw new Error('上传成功但未返回文件ID')
		}

		console.log('✓ 文件上传完成，file_id:', fileId)

		// 保存语音文件到持久化存储
		const savedFilePath = await saveVoiceFileToPersistentStorage(filePath)
		voiceMessage.filePath = savedFilePath // 更新消息中的文件路径

		// 调用语音识别API - 使用file_id方式
		console.log('准备调用语音识别API...')
		const sttResult = await speechToText(fileId, 'mp3', true) // 第三个参数表示使用file_id
		console.log('语音识别结果:', sttResult)

		const recognizedText = sttResult.text

		// 更新语音消息状态和识别文字
		voiceMessage.status = 'sent'
		voiceMessage.recognizedText = recognizedText

		// 强制触发Vue响应式更新
		const messageIndex = messages.value.findIndex(msg => msg.id === voiceMessage.id)
		if (messageIndex !== -1) {
			messages.value.splice(messageIndex, 1, {
				...messages.value[messageIndex],
				status: voiceMessage.status,
				recognizedText: voiceMessage.recognizedText
			})
		}

		// 检查语音识别结果是否为空
		if (!recognizedText || recognizedText.trim() === '') {
			console.log('语音识别结果为空，跳过对话API调用')

			// 添加语音识别失败的提示消息
			const errorMessage = {
				id: (Date.now() + 1).toString(),
				content: '抱歉，未能识别您的语音内容，请尝试重新录音或使用文字输入。',
				isUser: false,
				timestamp: Date.now(),
				status: 'sent',
				type: 'text'
			}
			messages.value.push(errorMessage)

			// 标记有新消息
			hasNewMessages = true

			// 滚动到底部
			nextTick(() => {
				if (messageListRef.value && messageListRef.value.scrollToBottom) {
					messageListRef.value.scrollToBottom()
				}
			})

			uni.showToast({
				title: '语音识别失败',
				icon: 'error',
				duration: 2000
			})

			return // 提前返回，不再调用对话API
		}

		// 构建对话历史
		const history = messages.value
			.filter(msg => msg.type === 'text' || (msg.type === 'voice' && msg.status === 'sent'))
			.slice(-10)
			.map(msg => ({
				role: msg.isUser ? 'user' : 'assistant',
				content: msg.type === 'voice' ? (msg.recognizedText || msg.content) : msg.content
			}))

		// 调用对话API，获取AI回复（包含文字和语音）
		const chatResponse = await sendChatMessage(recognizedText, history, {
			mode: currentMode.value,
			need_audio: true // 语音消息需要语音合成
		})

		console.log('AI回复:', chatResponse)

		// 添加AI回复消息（语音类型，包含文字和音频URL）
		const aiMessage = {
			id: (Date.now() + 1).toString(),
			content: chatResponse.text, // AI回复的文字内容
			isUser: false,
			timestamp: Date.now(),
			status: 'sent',
			type: 'voice', // 改为voice类型，因为包含语音
			audioUrl: chatResponse.audio_url ? API_CONFIG.BASE_URL + chatResponse.audio_url : null,
			recognizedText: chatResponse.text, // AI回复的文字也存在recognizedText中
			duration: chatResponse.metadata?.duration || 0
		}
		messages.value.push(aiMessage)

		// 滚动到底部
		nextTick(() => {
			if (messageListRef.value && messageListRef.value.scrollToBottom) {
				messageListRef.value.scrollToBottom()
			}
		})

		// 自动播放AI的语音回复
		if (aiMessage.audioUrl) {
			console.log('自动播放AI语音回复:', aiMessage.audioUrl)
			nextTick(() => {
				handlePlayAudio(aiMessage)
			})
		}

	} catch (error) {
		console.error('语音消息处理失败:', error)

		// 更新消息状态为失败
		voiceMessage.status = 'failed'

		// 强制触发Vue响应式更新
		const messageIndex = messages.value.findIndex(msg => msg.id === voiceMessage.id)
		if (messageIndex !== -1) {
			messages.value.splice(messageIndex, 1, {
				...messages.value[messageIndex],
				status: voiceMessage.status 
			})
		} 

		// 添加错误提示消息
		const errorMessage = {
			id: (Date.now() + 1).toString(),
			content: '抱歉，语音识别失败，请重试。',
			isUser: false,
			timestamp: Date.now(),
			status: 'error',
			type: 'text'
		}
		messages.value.push(errorMessage)

		uni.showToast({
			title: error.message || '语音识别失败',
			icon: 'error',
			duration: 2000
		})
	} finally {
		isLoading.value = false
	}

	console.log('=== 语音消息发送处理完成 ===')
}

// 开始语音录音
const startVoiceRecording = () => {
	isRecording.value = true
	recordingDuration.value = 0
	recordedFilePath = null

	// 初始化电话模式的录音管理器
	if (currentMode.value === 'phone' && !phoneRecorderManager) {
		try {
			phoneRecorderManager = uni.getRecorderManager()

			phoneRecorderManager.onStart(() => {
				console.log('电话模式录音开始')
			})

			phoneRecorderManager.onStop((res) => {
				console.log('电话模式录音停止', res)
				if (res && res.tempFilePath) {
					recordedFilePath = res.tempFilePath
					console.log('电话模式录音文件保存到:', recordedFilePath)

					// 在录音完成后立即创建消息
					const duration = recordingDuration.value
					recordingDuration.value = 0
					isRecording.value = false

					// 清除定时器
					if (recordingTimer) {
						clearInterval(recordingTimer)
						recordingTimer = null
					}

					// 处理电话模式语音消息（与普通模式相同）
					handleSendVoice({
						duration: duration,
						filePath: recordedFilePath
					})
				} else {
					console.error('电话模式录音失败')
					isRecording.value = false
					recordingDuration.value = 0
					if (recordingTimer) {
						clearInterval(recordingTimer)
						recordingTimer = null
					}
				}
			})

			phoneRecorderManager.onError((error) => {
				console.error('电话模式录音错误:', error)
				uni.showToast({
					title: '录音失败',
					icon: 'error'
				})
			})
		} catch (error) {
			console.error('初始化电话模式录音管理器失败:', error)
		}
	}

	// 开始录音
	if (currentMode.value === 'phone' && phoneRecorderManager) {
		try {
			phoneRecorderManager.start({
				format: 'mp3',
				sampleRate: 16000,
				numberOfChannels: 1,
				encodeBitRate: 64000,
				frameSize: 50
			})
		} catch (error) {
			console.error('电话模式录音启动失败:', error)
		}
	}

	// 清除之前的定时器
	if (recordingTimer) {
		clearInterval(recordingTimer)
	}

	// 模拟录音时长计数
	recordingTimer = setInterval(() => {
		recordingDuration.value += 1
		if (recordingDuration.value >= 60) { // 最多60秒
			if (currentMode.value === 'phone') {
				stopAndSendVoice()
			} else {
				stopVoiceRecording()
			}
			clearInterval(recordingTimer)
			recordingTimer = null
		}
	}, 1000)

	uni.showToast({
		title: '开始录音',
		icon: 'success',
		duration: 1500
	})
}

// 停止语音录音（不发送）
const stopVoiceRecording = () => {
	if (!isRecording.value) return

	isRecording.value = false

	// 清除定时器
	if (recordingTimer) {
		clearInterval(recordingTimer)
		recordingTimer = null
	}

	const duration = recordingDuration.value
	recordingDuration.value = 0

	console.log('录音完成，时长:', duration, '秒')

	uni.showToast({
		title: `录音完成 (${duration}秒)`,
		icon: 'success',
		duration: 1500
	})
}

// 停止录音并发送语音消息（电话模式）
const stopAndSendVoice = () => {
	if (!isRecording.value) return

	// 停止录音管理器（消息创建将在onStop回调中处理）
	if (phoneRecorderManager) {
		try {
			phoneRecorderManager.stop()
		} catch (error) {
			console.error('停止电话模式录音失败:', error)
		}
	}
}

// 处理音频播放请求
const handlePlayAudio = (message) => {
	console.log('播放音频消息:', message)

	// 优先使用audioUrl，其次使用filePath
	const audioSrc = message.audioUrl || message.filePath

	if (audioSrc) {
		// 调用audio store播放音频
		audioStore.playAudio(message.id, audioSrc, {
			updateMessageStatus: true
		}).then(success => {
			if (success) {
				console.log('音频播放成功')
			} else {
				console.log('音频播放失败')
				uni.showToast({
					title: '播放失败，请重试',
					icon: 'error',
					duration: 1500
				})
			}
		}).catch(error => {
			console.error('播放音频出错:', error)
			uni.showToast({
				title: '播放出错',
				icon: 'error',
				duration: 1500
			})
		})
	} else {
		console.log('没有音频源')
		uni.showToast({
			title: '音频文件不存在',
			icon: 'error',
			duration: 1500
		})
	}
}

// 处理气泡点击
const handleBubbleTap = (message) => {
	console.log('消息点击:', message)
}

// 处理加载更多
const handleLoadMore = () => {
	console.log('加载更多消息')
}

// 切换模式
const toggleMode = () => {
	const newMode = currentMode.value === 'normal' ? 'phone' : 'normal'

	uni.showModal({
		title: '切换模式',
		content: `确定要切换到${MODE_CONFIG[newMode.toUpperCase()].NAME}模式吗？`,
		success: (res) => {
			if (res.confirm) {
				// 切换模式前停止录音
				if (isRecording.value) {
					if (currentMode.value === 'phone') {
						stopAndSendVoice()
					} else {
						stopVoiceRecording()
					}
				}

				currentMode.value = newMode
				currentHistoryId = null // 重置历史ID，表示新对话开始
				hasNewMessages = false // 重置新消息标志
				lastSavedMessageCount = 0 // 重置保存计数

				uni.showToast({
					title: `切换成功`,
					icon: 'success' 
				})
			}
		}
	})
}
</script>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  height: 100vh;
  background-color: #F5F5F5;
  /* 防止页面在键盘弹出时滚动 */
  overflow: hidden;
  padding-top: 0;
}

.export-copy-button {
  position: fixed;
  right: 20rpx;
  z-index: 1200;
  height: 56rpx;
  min-width: 92rpx;
  padding: 0 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8rpx;
  background-color: #007AFF;
  color: #FFFFFF;
  font-size: 24rpx;
  line-height: 56rpx;
  box-shadow: 0 6rpx 18rpx rgba(0, 122, 255, 0.22);

  &::after {
    border: 0;
  }
}


.header {
  background-color: #007AFF;
  padding-top: var(--status-bar-height);
  position: sticky;
  top: 0;
  z-index: 100;

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32rpx 32rpx 16rpx;
    height: 120rpx;

    .header-title {
      font-size: 36rpx;
      font-weight: 600;
      color: white;
    }

    .mode-switcher {
      display: flex;
      align-items: center;
      gap: 8rpx;
      padding: 12rpx 20rpx;
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 20rpx;
      transition: all 0.3s ease;

      &:active {
        background-color: rgba(255, 255, 255, 0.3);
        transform: scale(0.95);
      }

      .mode-text {
        font-size: 28rpx;
        color: white;
        font-weight: 500;
      }

      .mode-icon {
        font-size: 32rpx;
        margin-left: 8rpx;
      }
    }
  }
}

// 响应式设计
@media screen and (max-width: 750px) {
  .header {
    .header-content {
      padding: 24rpx 24rpx 12rpx;
      height: 100rpx;

      .header-title {
        font-size: 32rpx;
      }

      .mode-switcher {
        padding: 8rpx 16rpx;

        .mode-text {
          font-size: 26rpx;
        }

        .mode-icon {
          font-size: 28rpx;
        }
      }
    }
  }
}
</style>
