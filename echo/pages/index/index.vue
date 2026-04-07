<template>
	<view class="home-page">
		<!-- 背景氛围层 -->
		<view class="ambient-bg">
			<view class="blob blob-1"></view>
			<view class="blob blob-2"></view>
			<view class="blob blob-3"></view>
			<view class="noise-overlay"></view>
		</view>

		<view class="content-wrapper">
			<!-- 顶部导航区 -->
			<view class="nav-header">
				<view class="brand-tag">
					<text class="tag-dot"></text>
					<text class="tag-text">AI LEARNING</text>
				</view>
				<view class="history-btn glass-btn" @tap="goToHistory" hover-class="btn-hover">
					<text class="icon">📜</text>
				</view>
			</view>
 
			<!-- 核心欢迎区 -->
			<view class="hero-section">
				<view class="logo-container animate-fade-in-up" style="animation-delay: 0.1s;">
					<view class="logo-glow"></view>
					<image class="logo-image" src="/static/logo.png" mode="aspectFit"></image>
				</view>
				<view class="text-container animate-fade-in-up" style="animation-delay: 0.2s;">
					<text class="app-title">Echo</text>
					<text class="app-slogan">Speak with Intelligence</text>
				</view>
				
				<!-- 特性标签 -->
				<view class="tags-row animate-fade-in-up" style="animation-delay: 0.3s;">
					<view class="tag-item">
						<text class="tag-icon">✨</text>
						<text>实时互动</text>
					</view>
					<view class="tag-item">
						<text class="tag-icon">🎯</text>
						<text>智能纠错</text>
					</view>
					<view class="tag-item">
						<text class="tag-icon">📊</text>
						<text>成长追踪</text>
					</view>
				</view>
			</view>

			<!-- 底部操作区 -->
			<view class="bottom-panel animate-slide-up" style="animation-delay: 0.4s;">
				<!-- 主按钮 -->
				<view class="primary-action" @tap="startNewConversation" hover-class="scale-down">
					<view class="action-content">
						<text class="action-title">Start Conversation</text>
						<text class="action-sub">开启新的对话旅程</text>
					</view>
					<view class="action-icon-box">
						<text class="action-arrow">⚡️</text>
					</view>
				</view>

				<!-- 模式切换网格 -->
				<view class="mode-grid">
					<view class="mode-item glass-card" @tap="switchToNormalMode" hover-class="card-hover">
						<view class="card-icon-bg normal-bg">
							<text class="card-icon">💬</text>
						</view>
						<view class="card-info">
							<text class="card-title">对话模式</text>
							<text class="card-desc">文本与语音</text>
						</view>
					</view>

					<view class="mode-item glass-card" @tap="switchToPhoneMode" hover-class="card-hover">
						<view class="card-icon-bg phone-bg">
							<text class="card-icon">📞</text>
						</view>
						<view class="card-info">
							<text class="card-title">通话模式</text>
							<text class="card-desc">沉浸式体验</text>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
// 保持原有逻辑不变
const startNewConversation = () => {
	uni.navigateTo({
		url: '/pages/chat/chat?mode=normal&new=true'
	})
}

const switchToNormalMode = () => {
	uni.navigateTo({
		url: '/pages/chat/chat?mode=normal'
	})
}

const switchToPhoneMode = () => {
	uni.navigateTo({
		url: '/pages/chat/chat?mode=phone'
	})
}

const goToHistory = () => {
	uni.navigateTo({
		url: '/pages/history/history'
	})
}
</script>

<style lang="scss" scoped>
/* 核心变量 */
$primary-color: #6C5DD3;
$accent-color: #00E0FF;
$bg-dark: #0B0E14;
$glass-border: rgba(255, 255, 255, 0.08);
$glass-bg: rgba(255, 255, 255, 0.03);

.home-page {
	min-height: 100vh;
	background-color: $bg-dark;
	position: relative;
	overflow: hidden;
	color: #ffffff;
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

/* 背景氛围 */
.ambient-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	overflow: hidden;

	.blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.6;
		animation: float-blob 10s infinite ease-in-out alternate;
	}

	.blob-1 {
		top: -10%;
		left: -10%;
		width: 500rpx;
		height: 500rpx;
		background: radial-gradient(circle, $primary-color, transparent);
	}

	.blob-2 {
		bottom: 10%;
		right: -10%;
		width: 600rpx;
		height: 600rpx;
		background: radial-gradient(circle, darken($primary-color, 20%), transparent);
		animation-delay: -2s;
	}

	.blob-3 {
		top: 40%;
		left: 30%;
		width: 300rpx;
		height: 300rpx;
		background: radial-gradient(circle, rgba($accent-color, 0.4), transparent);
		animation-delay: -5s;
	}

	.noise-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		opacity: 0.05;
		background-image: url('data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
		pointer-events: none;
	}
}

.content-wrapper {
	position: relative;
	z-index: 1;
	height: 100vh;
	display: flex;
	flex-direction: column;
	padding: var(--status-bar-height) 40rpx 40rpx;
	box-sizing: border-box;
}

/* 导航头 */
.nav-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding-top: 20rpx;
	margin-bottom: 40rpx;

	.brand-tag {
		display: flex;
		align-items: center;
		padding: 8rpx 20rpx;
		background: $glass-bg;
		border: 1px solid $glass-border;
		border-radius: 100rpx;
		backdrop-filter: blur(10px);

		.tag-dot {
			width: 12rpx;
			height: 12rpx;
			background-color: $accent-color;
			border-radius: 50%;
			margin-right: 12rpx;
			box-shadow: 0 0 10rpx $accent-color;
		}

		.tag-text {
			font-size: 20rpx;
			letter-spacing: 2rpx;
			font-weight: 600;
			color: rgba(255, 255, 255, 0.7);
		}
	}

	.history-btn {
		width: 80rpx;
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		font-size: 36rpx;
		background: $glass-bg;
		border: 1px solid $glass-border;
		backdrop-filter: blur(10px);
	}
}

/* 主展示区 */
.hero-section {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	text-align: center;
	margin-bottom: 60rpx;

	.logo-container {
		position: relative;
		margin-bottom: 40rpx;
		
		.logo-image {
			width: 300rpx;
			height: 300rpx;
			position: relative;
			z-index: 2;
			// 透明背景处理完毕，去除混合模式
		} 
 
		.logo-glow {
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 180rpx;
			height: 180rpx;
			background: radial-gradient(circle, rgba($primary-color, 0.6), transparent 70%);
			filter: blur(20px); 
			z-index: 1;
		}
	}

	.text-container {
		margin-bottom: 60rpx;

		.app-title {
			display: block;
			font-size: 72rpx;
			font-weight: 800;
			letter-spacing: -2rpx;
			background: linear-gradient(to right, #fff, #a5a5a5);
			-webkit-background-clip: text;
			color: transparent;
			margin-bottom: 16rpx;
		}

		.app-slogan {
			font-size: 32rpx;
			color: rgba(255, 255, 255, 0.5);
			font-weight: 300;
			letter-spacing: 1rpx;
		}
	}

	.tags-row {
		display: flex;
		gap: 20rpx;

		.tag-item {
			background: rgba(255, 255, 255, 0.05);
			padding: 12rpx 24rpx;
			border-radius: 12rpx;
			display: flex;
			align-items: center;
			gap: 10rpx;
			font-size: 24rpx;
			color: rgba(255, 255, 255, 0.8);
			border: 1px solid transparent; /* 预留边框 */
			
			.tag-icon {
				font-size: 24rpx;
			}
		}
	}
}

/* 底部面板 */
.bottom-panel {
	width: 100%;
}

.primary-action {
	background: linear-gradient(92deg, $primary-color 0%, darken($primary-color, 10%) 100%);
	padding: 30rpx 40rpx;
	border-radius: 32rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 30rpx;
	box-shadow: 0 20rpx 40rpx -10rpx rgba($primary-color, 0.4);
	position: relative;
	overflow: hidden;

	&::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(rgba(255,255,255,0.1), transparent);
		pointer-events: none;
	}

	.action-content {
		display: flex;
		flex-direction: column;
		gap: 8rpx;

		.action-title {
			font-size: 36rpx;
			font-weight: 700;
			color: white;
		}

		.action-sub {
			font-size: 24rpx;
			color: rgba(255, 255, 255, 0.7);
		}
	}

	.action-icon-box {
		width: 80rpx;
		height: 80rpx;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		
		.action-arrow {
			font-size: 40rpx;
		}
	}
}

.mode-grid {
	display: flex;
	gap: 20rpx;

	.mode-item {
		flex: 1;
		background: $glass-bg;
		border: 1px solid $glass-border;
		padding: 30rpx;
		border-radius: 28rpx;
		display: flex;
		flex-direction: column;
		gap: 24rpx;
		backdrop-filter: blur(12px);

		.card-icon-bg {
			width: 80rpx;
			height: 80rpx;
			border-radius: 24rpx;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 36rpx;
			transition: all 0.3s ease;

			&.normal-bg {
				background: linear-gradient(135deg, rgba(33, 150, 243, 0.3), rgba(33, 150, 243, 0.1));
				border: 1px solid rgba(33, 150, 243, 0.3);
				box-shadow: 0 0 20rpx rgba(33, 150, 243, 0.2);
				color: #64B5F6; // 更亮的文字颜色
			}

			&.phone-bg {
				background: linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.1));
				border: 1px solid rgba(76, 175, 80, 0.3);
				box-shadow: 0 0 20rpx rgba(76, 175, 80, 0.2);
				color: #81C784; // 更亮的文字颜色
			}
			
			.card-icon {
				// 针对暗色 Emoji 进行提亮和增加饱和度，使其在深色背景下更清晰
				filter: brightness(1.3) saturate(1.2) drop-shadow(0 0 2px rgba(255,255,255,0.3));
			}
		}

		.card-info {
			display: flex;
			flex-direction: column;
			gap: 4rpx;

			.card-title {
				font-size: 30rpx;
				font-weight: 600;
				color: rgba(255, 255, 255, 0.9);
			}

			.card-desc {
				font-size: 22rpx;
				color: rgba(255, 255, 255, 0.4);
			}
		}
	}
}

/* 交互态 & 动画 */
.glass-btn:active, .glass-card:active {
	background: rgba(255, 255, 255, 0.08);
}

.scale-down:active {
	transform: scale(0.98);
	transition: transform 0.1s;
}

.card-hover {
	border-color: rgba(255, 255, 255, 0.2);
	transform: translateY(-2rpx);
}

@keyframes float-blob {
	0% { transform: translate(0, 0) scale(1); }
	100% { transform: translate(20px, -20px) scale(1.1); }
}

.animate-fade-in-up {
	animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.animate-slide-up {
	animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(40rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes slideUp {
	from {
		opacity: 0;
		transform: translateY(100rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>