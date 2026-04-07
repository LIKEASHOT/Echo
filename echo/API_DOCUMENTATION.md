# EchoSage 英语对话练习应用 - API接口文档

## 📋 概述

EchoSage是一款智能英语语音对话学习应用，支持普通对话和电话模式两种学习场景。应用前端使用uni-app框架开发，后端需要提供以下核心API接口以支持完整功能。

## 🔗 核心功能模块

### 1. 文本对话功能
- 支持用户发送文本消息
- AI根据对话历史生成智能回复
- 支持普通对话和电话模式的不同回复策略

### 2. 语音识别功能
- 将用户语音转换为文字
- 支持中英文自动识别
- 处理录音文件的上传和转换

### 3. 语音合成功能
- 将AI回复文本转换为语音
- 支持不同语速和音色
- 生成可播放的音频文件

### 4. 对话历史管理
- 本地存储对话记录
- 支持历史记录的查看和恢复
- 不同模式的历史分别管理

## 🌐 API接口清单

### 基础信息
- **基础URL**: `http://localhost:8000` (开发环境)
- **认证方式**: 无需认证 (可根据需要添加)
- **数据格式**: JSON
- **字符编码**: UTF-8
- **超时时间**: 30秒

---

## 📡 核心API接口

### 1. 文本对话接口

**接口地址**: `POST /api/chat`

**功能描述**: 处理用户发送的文本消息，返回AI的智能回复

**请求参数**:
```json
{
  "message": "string (必填) - 用户发送的消息内容",
  "history": [
    {
      "role": "user|assistant",
      "content": "string",
      "timestamp": "number (可选)"
    }
  ],
  "mode": "string (必填) - 对话模式: 'normal'|'phone'",
}
```

**响应参数**:
```json
{
  "success": true,
  "data": {
    "text": "string - AI回复的文本内容",
    "audio_url": "string (可选) - 语音合成后的音频URL",
    "metadata": {
      "tokens_used": "number - 消耗的tokens数量",
      "processing_time": "number - 处理耗时(毫秒)",
      "language_detected": "string - 检测到的语言"
    }
  },
  "message": "处理成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "string - 错误码",
    "message": "string - 错误描述"
  }
}
```

---

### 2. 语音转文字接口

**接口地址**: `POST /api/speech-to-text`

**功能描述**: 将音频文件转换为文字，支持中英文识别

**请求参数**:
```json
{
  "audio": "string (必填) - base64编码的音频数据",
  "format": "string (必填) - 音频格式: 'wav'",
  "language": "string (可选) - 语言设置: 'auto'|'zh'|'en'",
  "sample_rate": "number (可选) - 采样率",
  "model": "string (可选) - 识别模型"
}
```

**响应参数**:
```json
{
  "success": true,
  "data": {
    "text": "string - 识别出的文字内容",
    "confidence": "number - 识别置信度 0.0-1.0",
    "language": "string - 检测到的语言",
    "duration": "number - 音频时长(秒)",
    "metadata": {
      "processing_time": "number - 处理耗时(毫秒)",
      "model_used": "string - 使用的模型"
    }
  },
  "message": "语音识别成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_AUDIO_FORMAT",
    "message": "不支持的音频格式"
  }
}
```

---

### 3. 文字转语音接口

**接口地址**: `POST /api/text-to-speech`

**功能描述**: 将文本转换为语音文件

**请求参数**:
```json
{
  "text": "string (必填) - 要合成的文本内容",
  "language": "string (必填) - 语言: 'en'|'zh'",
  "format": "string (可选) - 输出格式: 'wav'"
}
```

**响应参数**:
```json
{
  "success": true,
  "data": {
    "audio_url": "string - 生成的音频文件URL",
    "duration": "number - 音频时长(秒)",
    "size": "number - 文件大小(字节)",
    "metadata": {
      "processing_time": "number - 处理耗时(毫秒)",
      "voice_used": "string - 使用的语音"
    }
  },
  "message": "语音合成成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "TTS_FAILED",
    "message": "语音合成失败"
  }
}
```




---

## 📊 数据结构定义

### 消息对象
```typescript
interface Message {
  id: string;           // 消息唯一ID
  content: string;      // 消息内容
  isUser: boolean;      // 是否用户消息
  timestamp: number;    // 时间戳
  status: 'sending' | 'sent' | 'failed';  // 发送状态
  type: 'text' | 'voice';  // 消息类型
  duration?: number;    // 语音时长(秒)
  audioUrl?: string;    // 语音文件URL
  filePath?: string;    // 本地文件路径
}
```

### 对话历史
```typescript
interface ChatHistory {
  id: string;           // 对话ID
  mode: 'normal' | 'phone';  // 对话模式
  messages: Message[];  // 消息列表
  timestamp: number;    // 创建时间
  lastMessage?: string; // 最后一条消息预览
}
```

---

## ⚠️ 错误码说明

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `INVALID_PARAMS` | 参数格式错误 | 检查请求参数格式 |
| `AUDIO_TOO_LONG` | 音频文件过长 | 限制录音时长 |
| `UNSUPPORTED_FORMAT` | 不支持的文件格式 | 转换为支持的格式 |
| `PROCESSING_FAILED` | 处理失败 | 重试或联系客服 |
| `RATE_LIMIT_EXCEEDED` | 请求过于频繁 | 增加请求间隔 |
| `SERVICE_UNAVAILABLE` | 服务不可用 | 显示维护提示 |

---

## 🔧 技术要求


### 安全要求
- 音频文件大小限制 (最大10MB)
- 请求频率限制


---

## 📝 开发环境配置

### 后端技术栈建议
- **框架**: Flask + Python
- **存储**: 前端本地存储

---

*文档版本: v1.0.0 | 更新日期: 2025-01-09 | 作者: EchoSage团队*