<template>
	<view class="history-page">
		<!-- 顶部导航栏 -->
		<view class="header">
			<view class="nav-bar">
				<view class="back-btn" @tap="goBack">
					<text class="back-icon">←</text>
				</view>
				<text class="nav-title">对话历史</text>
				<view class="placeholder"></view>
			</view>
		</view>

		<!-- 模式切换 -->
		<view class="mode-tabs">
			<view
				class="tab-item"
				:class="{ active: activeTab === 'normal' }"
				@tap="switchTab('normal')"
			>
				<text class="tab-text">普通对话</text>
			</view>
			<view
				class="tab-item"
				:class="{ active: activeTab === 'phone' }"
				@tap="switchTab('phone')"
			>
				<text class="tab-text">电话练习</text>
			</view>
		</view>

		<!-- 历史记录列表 -->
		<view class="history-list">
			<!-- 加载状态 -->
			<view v-if="loading" class="loading-state">
				<view class="loading-spinner"></view>
				<text class="loading-text">加载中...</text>
			</view>

			<!-- 空状态 -->
			<view v-else-if="historyList.length === 0" class="empty-state">
				<view class="empty-icon">📝</view>
				<text class="empty-title">暂无对话记录</text>
				<text class="empty-desc">开始您的第一次对话吧</text>
			</view>

			<!-- 历史记录 -->
			<view v-else class="history-items">
				<view
					v-for="(item, index) in historyList"
					:key="item.id"
					class="history-item"
					@tap="selectHistory(item)"
				>
					<view class="item-header">
						<text class="item-time">{{ formatTime(item.timestamp) }}</text>
						<text class="item-count">{{ item.messages.length }}条消息</text>
					</view>

					<view class="item-preview">
						<text class="preview-text">{{ getPreviewText(item.messages) }}</text>
					</view>

					<view class="item-actions">
						<view class="action-btn delete-btn" @tap.stop="deleteHistory(item.id)">
							<text class="action-icon">🗑️</text>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

// 响应式数据
const activeTab = ref('normal') // 当前激活的标签页
const historyList = ref([]) // 历史记录列表
const loading = ref(true) // 加载状态

// 页面加载
onMounted(() => {
	loadHistory()
})

// 页面显示
onLoad(() => {
	console.log('历史记录页面加载')
})

// 返回上一页
const goBack = () => {
	uni.navigateBack()
}

// 切换标签页
const switchTab = (tab) => {
	activeTab.value = tab
	loadHistory()
}

// 加载历史记录
const loadHistory = () => {
	loading.value = true

	try {
		const key = activeTab.value === 'normal' ? 'echosage_history_normal' : 'echosage_history_phone'
		const history = uni.getStorageSync(key) || []

		// 按时间倒序排列
		historyList.value = history.sort((a, b) => b.timestamp - a.timestamp)

		console.log('加载历史记录:', activeTab.value, historyList.value.length, '条')
	} catch (error) {
		console.error('加载历史记录失败:', error)
		historyList.value = []
	}

	loading.value = false
}

// 选择历史记录
const selectHistory = (item) => {
	console.log('选择历史记录:', item.id)

	// 将选中的历史记录保存到临时存储
	uni.setStorageSync('echosage_selected_history', {
		mode: activeTab.value,
		history: item
	})

	// 跳转到聊天页面
	uni.navigateTo({
		url: `/pages/chat/chat?mode=${activeTab.value}&restore=true`
	})
}

// 删除历史记录
const deleteHistory = (historyId) => {
	uni.showModal({
		title: '确认删除',
		content: '确定要删除这条对话记录吗？',
		success: (res) => {
			if (res.confirm) {
				try {
					const key = activeTab.value === 'normal' ? 'echosage_history_normal' : 'echosage_history_phone'
					const history = uni.getStorageSync(key) || []

					// 过滤掉要删除的记录
					const newHistory = history.filter(item => item.id !== historyId)

					// 保存更新后的历史记录
					uni.setStorageSync(key, newHistory)

					// 重新加载列表
					loadHistory()

					uni.showToast({
						title: '删除成功',
						icon: 'success'
					})
				} catch (error) {
					console.error('删除历史记录失败:', error)
					uni.showToast({
						title: '删除失败',
						icon: 'error'
					})
				}
			}
		}
	})
}

// 格式化时间显示
const formatTime = (timestamp) => {
	if (!timestamp) return ''

	const date = new Date(timestamp)
	const now = new Date()
	const diff = now - date

	// 今天
	if (diff < 24 * 60 * 60 * 1000) {
		return date.toLocaleTimeString('zh-CN', {
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	// 昨天
	if (diff < 2 * 24 * 60 * 60 * 1000) {
		return '昨天 ' + date.toLocaleTimeString('zh-CN', {
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	// 更早
	return date.toLocaleDateString('zh-CN', {
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	})
}

// 获取预览文本
const getPreviewText = (messages) => {
	if (!messages || messages.length === 0) return '无消息内容'

	// 获取第一条用户消息作为预览
	const userMessage = messages.find(msg => msg.isUser)
	if (userMessage) {
		return userMessage.content.length > 30
			? userMessage.content.substring(0, 30) + '...'
			: userMessage.content
	}

	// 如果没有用户消息，取第一条消息
	const firstMessage = messages[0]
	return firstMessage.content.length > 30
		? firstMessage.content.substring(0, 30) + '...'
		: firstMessage.content
}
</script>

<style lang="scss" scoped>
.history-page {
	min-height: 100vh;
	background-color: #F5F5F5;
	display: flex;
	flex-direction: column;
}

.header {
	background-color: #007AFF;
	padding-top: var(--status-bar-height);
	position: sticky;
	top: 0;
	z-index: 100;

	.nav-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 32rpx 32rpx 16rpx;
		height: 120rpx;

		.back-btn {
			width: 80rpx;
			height: 80rpx;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 50%;
			background-color: rgba(255, 255, 255, 0.2);
			transition: all 0.3s ease;

			&:active {
				transform: scale(0.9);
				background-color: rgba(255, 255, 255, 0.3);
			}

			.back-icon {
				font-size: 32rpx;
				color: white;
			}
		}

		.nav-title {
			font-size: 36rpx;
			font-weight: 600;
			color: white;
		}

		.placeholder {
			width: 80rpx;
		}
	}
}

.mode-tabs {
	display: flex;
	background-color: white;
	border-bottom: 1rpx solid #E5E5EA;

	.tab-item {
		flex: 1;
		padding: 32rpx 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s ease;

		&.active {
			border-bottom: 4rpx solid #007AFF;

			.tab-text {
				color: #007AFF;
				font-weight: 600;
			}
		}

		.tab-text {
			font-size: 32rpx;
			color: #666666;
		}
	}
}

.history-list {
	flex: 1;
	padding: 0 32rpx;

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 60vh;
		gap: 24rpx;

		.loading-spinner {
			width: 48rpx;
			height: 48rpx;
			border: 4rpx solid #E5E5EA;
			border-top: 4rpx solid #007AFF;
			border-radius: 50%;
			animation: spin 1s linear infinite;
		}

		.loading-text {
			font-size: 28rpx;
			color: #666666;
		}
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 60vh;
		text-align: center;
		gap: 16rpx;

		.empty-icon {
			font-size: 120rpx;
			opacity: 0.6;
			margin-bottom: 24rpx;
		}

		.empty-title {
			font-size: 36rpx;
			color: #333333;
			font-weight: 500;
		}

		.empty-desc {
			font-size: 28rpx;
			color: #666666;
		}
	}

	.history-items {
		padding: 32rpx 0;

		.history-item {
			background-color: white;
			border-radius: 16rpx;
			padding: 32rpx;
			margin-bottom: 24rpx;
			box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
			transition: all 0.3s ease;

			&:active {
				transform: translateY(2rpx);
				box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.12);
			}

			.item-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: 16rpx;

				.item-time {
					font-size: 26rpx;
					color: #666666;
				}

				.item-count {
					font-size: 24rpx;
					color: #999999;
					background-color: #F5F5F5;
					padding: 4rpx 12rpx;
					border-radius: 12rpx;
				}
			}

			.item-preview {
				margin-bottom: 16rpx;

				.preview-text {
					font-size: 30rpx;
					color: #333333;
					line-height: 1.4;
				}
			}

			.item-actions {
				display: flex;
				justify-content: flex-end;

				.action-btn {
					width: 60rpx;
					height: 60rpx;
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: 50%;
					transition: all 0.3s ease;

					&.delete-btn:active {
						background-color: #FFE5E5;
						transform: scale(0.9);
					}

					.action-icon {
						font-size: 24rpx;
					}
				}
			}
		}
	}
}

// 动画
@keyframes spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}

// 响应式设计
@media screen and (max-width: 750px) {
	.header {
		.nav-bar {
			padding: 24rpx 24rpx 12rpx;
			height: 100rpx;

			.nav-title {
				font-size: 32rpx;
			}
		}
	}

	.history-list {
		padding: 0 24rpx;

		.history-items {
			padding: 24rpx 0;

			.history-item {
				padding: 24rpx;
				margin-bottom: 16rpx;

				.item-header {
					margin-bottom: 12rpx;

					.item-time {
						font-size: 24rpx;
					}

					.item-count {
						font-size: 22rpx;
						padding: 2rpx 8rpx;
					}
				}

				.item-preview {
					margin-bottom: 12rpx;

					.preview-text {
						font-size: 28rpx;
					}
				}
			}
		}
	}
}
</style>