<template>
  <view class="full-duplex-screen"
        :wsurl="wsUrl"       :change:wsurl="engine.onWsUrlChange"
        :mutecmd="muteCmd"   :change:mutecmd="engine.onMuteChange"
        :stopcmd="stopCmd"   :change:stopcmd="engine.onStop"
        :chunk="ttsChunk"    :change:chunk="engine.onTtsChunk"
        :intcmd="intCmd"     :change:intcmd="engine.onInterrupt">

    <!-- 流光渐变背景 -->
    <view class="premium-gradient-bg">
      <view class="gradient-orb orb-1"></view>
      <view class="gradient-orb orb-2"></view>
      <view class="noise-overlay"></view>
    </view>

    <!-- 顶部状态栏 -->
    <view class="header">
      <view class="glass-badge">
        <view class="status-dot" :class="dotClass"></view>
        <text class="status-text">{{ statusText }}</text>
      </view>
    </view>

    <!-- 滚动字幕 -->
    <scroll-view
      class="scroll-transcript"
      scroll-y
      :scroll-top="scrollTop"
      :scroll-into-view="scrollIntoView"
      scroll-with-animation
    >
      <view class="transcript-container">
        <view class="subtitle-stack">
          <view v-for="(msg, i) in transcriptMessages" :key="msg.id"
            class="subtitle-item"
            :class="[msg.isUser ? 'user-subtitle' : 'ai-subtitle',
                     msg.status==='streaming' ? 'streaming-text' : '',
                     i === transcriptMessages.length-1 ? 'is-latest' : 'is-history']">
            <text class="role-name">{{ msg.isUser ? '我' : '英语陪练' }}</text>
            <text class="content">{{ msg.content }}<text v-if="msg.interrupted" class="interrupted-mark">⋯</text></text>
          </view>
        </view>

        <!-- 音量可视化（仅在 VAD 检测到人声时跳动） -->
        <view v-if="isSpeaking" class="volume-vis">
          <view class="bar" v-for="i in 5" :key="i"
                :style="{ height: barH[i-1] + 'rpx' }"></view>
        </view>

        <view class="listening-indicator" v-if="!isSpeaking">
          <text class="listening-hint">{{ hintText }}</text>
        </view>
      </view>
        <view class="bottom-spacer"></view>
        <view id="duplex-bottom-anchor" class="bottom-anchor"></view>
    </scroll-view>

    <!-- 底部控制面板 -->
    <view class="control-panel glass-panel">
      <view class="buttons-row">
        <!-- 麦克风静音 -->
        <view class="action-btn" :class="{ 'is-muted': isMuted }" @tap="toggleMute">
          <text class="icon">{{ isMuted ? '🙊' : '🎙️' }}</text>
        </view>
        <!-- 挂断 -->
        <view class="action-btn hangup-btn" @tap="endCall">
          <view class="icon-close"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
// ============================================================
// Options API 块：定义 renderjs callMethod 能调到的方法
// uni-app Android 的 renderjs callMethod 只认 Options API methods，
// defineExpose 暴露的函数不会被 callMethod 找到。
// ============================================================
import { ref } from 'vue'

// 模块级 ref —— 在 <script> 和 <script setup> 之间共享
const _localMessages = ref([])
const _connStatus = ref('connecting')
const _isSpeaking = ref(false)
const _isThinking = ref(false)
const _volumeLevel = ref(0)
const _ttsChunk = ref('')
const _intCmd = ref(0)
const _duplexSessionKey = ref('')

export default {
  methods: {
    onConnStatus(s) {
      _connStatus.value = s
    },
    onVadState(speaking) {
      _isSpeaking.value = speaking
      if (speaking) _isThinking.value = false
    },
    onVolume(v) {
      _volumeLevel.value = v
    },
    onSubtitle(eventStr) {
      const { event, payload } = JSON.parse(eventStr)

      // 纯控制事件，不产生气泡
      if (['session_ready', 'turn_end'].includes(event)) return

      if (event === 'ai_text') _isThinking.value = false

      // interrupt 处理
      if (event === 'interrupt') {
        const last = _localMessages.value.slice().reverse().find(m => !m.isUser && m.status === 'streaming')
        if (last) { last.interrupted = true; last.status = 'sent' }
        return
      }

      const isUser = event.includes('user')
      const rawId = payload.message_id || (payload.turn_id ? `${payload.turn_id}_${isUser ? 'user' : 'ai'}` : Date.now().toString())
      const msgId = `${_duplexSessionKey.value || 'duplex'}_${rawId}`
      let existing = _localMessages.value.find(m => m.id === msgId)

      if (!existing) {
        existing = {
          id: msgId, isUser,
          content: payload.text || '',
          status: payload.is_final ? 'sent' : 'streaming',
          interrupted: false
        }
        _localMessages.value.push(existing)
      } else {
        if (payload.text) existing.content = payload.text
        existing.status = payload.is_final ? 'sent' : 'streaming'
      }
    },
    onSpeechEnd() {
      _isThinking.value = true
    },
    onTtsPlay(b64) {
      _ttsChunk.value = b64 + '||' + Date.now()
    },
    onInterruptAudio() {
      _intCmd.value += 1
    }
  }
}
</script>

<script setup>
import { computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { getWsUrl } from '@/utils/duplexSocket.js'

const props = defineProps({ messages: { type: Array, default: () => [] } })
const emit = defineEmits(['end-call', 'sync-messages'])

// 复用模块级 ref（和 Options API methods 共享同一实例）
const localMessages = _localMessages
const transcriptMessages = computed(() => localMessages.value.slice(-30))
const latestMessageSignature = computed(() => {
  const last = localMessages.value[localMessages.value.length - 1]
  return last ? `${localMessages.value.length}|${last.id}|${last.status}|${last.content}` : '0'
})
const connStatus = _connStatus
const isMuted = ref(false)
const isSpeaking = _isSpeaking
const isThinking = _isThinking
const volumeLevel = _volumeLevel
const scrollTop = ref(0)
const scrollIntoView = ref('')

// 传给 renderjs 的驱动 prop
const wsUrl = ref('')
const muteCmd = ref('')
const stopCmd = ref('')
const ttsChunk = _ttsChunk
const intCmd = _intCmd

const scrollToBottom = async () => {
  await nextTick()
  scrollIntoView.value = ''
  await nextTick()
  scrollIntoView.value = 'duplex-bottom-anchor'
}

watch(latestMessageSignature, () => {
  scrollToBottom()
})

const dotClass = computed(() => ({
  'is-connected': connStatus.value === 'connected',
  'is-speaking': isSpeaking.value
}))

const statusText = computed(() => {
  if (connStatus.value === 'connecting') return '连接中...'
  if (connStatus.value !== 'connected') return '未连接'
  if (isSpeaking.value) return '🗣️ 检测到人声'
  if (isThinking.value) return '🤔 AI 思考中...'
  return isMuted.value ? '已静音' : '正在听'
})

const hintText = computed(() => {
  if (connStatus.value !== 'connected') return ''
  if (isThinking.value) return 'AI 正在回复...'
  return isMuted.value ? '麦克风已静音' : ''
})

const barH = computed(() => {
  const v = volumeLevel.value
  return [0.5, 0.75, 1.0, 0.75, 0.5].map(p => 16 + 64 * p * v)
})

const toggleMute = () => {
  isMuted.value = !isMuted.value
  muteCmd.value = (isMuted.value ? 'mute_' : 'unmute_') + Date.now()
}

// 把通话期间产生的新消息同步回父组件
const syncMessages = () => {
  // 只同步通话期间新产生的消息（排除 props.messages 带进来的）
  const propsIds = new Set(props.messages.map(m => m.id))
  const newMsgs = localMessages.value.filter(m => !propsIds.has(m.id) && m.status === 'sent')
  if (newMsgs.length > 0) {
    // 转换为 chat.vue 的消息格式
    const formatted = newMsgs.map(m => ({
      id: m.id,
      content: m.content,
      isUser: m.isUser,
      timestamp: Date.now(),
      status: 'sent',
      type: 'text'
    }))
    emit('sync-messages', formatted)
  }
}

const endCall = () => {
  syncMessages()
  stopCmd.value = 'stop_' + Date.now()
  emit('end-call')
}

onMounted(() => {
  _duplexSessionKey.value = `duplex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  // 重置模块级 ref（上次组件实例的残留状态）
  _connStatus.value = 'connecting'
  _isSpeaking.value = false
  _isThinking.value = false
  _volumeLevel.value = 0
  
  localMessages.value = [...props.messages]
  wsUrl.value = getWsUrl()
  setTimeout(scrollToBottom, 100)
})

onUnmounted(() => {
  syncMessages()
  stopCmd.value = 'stop_' + Date.now()
})
</script>

<!-- =====================================================================
     renderjs - 运行在 WebView 视图层
     负责：getUserMedia / Silero VAD / 原生 WebSocket / TTS AudioContext
     ===================================================================== -->
<script module="engine" lang="renderjs">
// === Polyfill for Android WebView (避免 vad-web bundle 报错 `e.at is not a function`) ===
if (!Array.prototype.at) {
  Array.prototype.at = function(n) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    if (n < 0 || n >= this.length) return undefined;
    return this[n];
  };
}
const TypedArrays = [
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array
];
for (const TA of TypedArrays) {
  if (typeof TA !== 'undefined' && !TA.prototype.at) {
    TA.prototype.at = Array.prototype.at;
  }
}

let ws = null;
let vadInstance = null;
let audioCtx = null;
let isMuted = false;
let isSpeaking = false;

// === TTS 播放队列 ===
let playCtx = null;
let audioQueue = [];
let playing = false;
let nextTime = 0;
let activeSrc = [];

// === 能量 VAD 兜底用 ===
let recCtx = null;
let mediaStream = null;
let processor = null;
let speechFrames = [];
let silenceStart = null;
let hasSpeech = false;
let lastVolTick = 0;
const SPEECH_THRESH = 0.018;
const SILENCE_MS = 500;  // 500ms 尾音冗余
let cachedOwner = null;  // 缓存最新的 $ownerInstance（v-if 重建后 this.$ownerInstance 可能过期）

export default {
  methods: {
    // ---- 生命周期驱动 ----
    safeCall(method, ...args) {
      const owner = cachedOwner || this.$ownerInstance;
      if (!owner) return;
      try {
        owner.callMethod(method, ...args);
      } catch (e) {
        console.warn(`[engine] 页面已销毁，拦截对 ${method} 的调用`);
      }
    },
    
    onWsUrlChange(url) {
      if (!url) return;
      // 刷新 owner 引用（v-if 重建后 $ownerInstance 指向新实例）
      cachedOwner = this.$ownerInstance;
      // 先清理旧资源
      this.cleanup();
      console.log('[engine] 启动, wsUrl:', url);
      this.connectWs(url);
      this.initAudioEngine();
    },
    onMuteChange(val) {
      if (!val) return;
      isMuted = val.startsWith('mute');
      console.log('[engine] 静音:', isMuted);
      // VAD 模式下静音 = 暂停麦克风流
      if (mediaStream) {
        mediaStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
      }
    },
    onStop() {
      console.log('[engine] 收到停止指令');
      this.cleanup();
    },

    // ---- WebSocket ----
    connectWs(url) {
      if (ws) return;
      this.safeCall('onConnStatus', 'connecting');
      ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[engine] WS 已连接');
        ws.send(JSON.stringify({ event: 'session_start' }));
        this.safeCall('onConnStatus', 'connected');
      };

      ws.binaryType = 'arraybuffer';

      ws.onmessage = (e) => {
        // 二进制帧 → 直接当 TTS PCM 音频播放
        if (e.data instanceof ArrayBuffer) {
          const bytes = new Uint8Array(e.data);
          let bin = '';
          const C = 8192;
          for (let i = 0; i < bytes.length; i += C) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + C));
          }
          this.enqueueTts(btoa(bin));
          return;
        }
        // 文本帧 → JSON 解析
        try {
          const data = JSON.parse(e.data);
          this.handleServerMsg(data);
        } catch (err) {
          console.warn('[engine] 非JSON消息:', typeof e.data, e.data && e.data.substring ? e.data.substring(0, 100) : e.data);
        }
      };

      ws.onerror = (e) => {
        console.error('[engine] WS 错误:', e);
        this.safeCall('onConnStatus', 'disconnected');
      };

      ws.onclose = () => {
        console.log('[engine] WS 已关闭');
        ws = null;
        this.safeCall('onConnStatus', 'disconnected');
      };
    },

    handleServerMsg(data) {
      const { event, payload } = data;
      // 兜底：能收到消息就说明已连接（ws.onopen 的回调可能因桥接时序丢失）
      this.safeCall('onConnStatus', 'connected');
      
      if (event === 'tts_audio_chunk') {
        this.enqueueTts(payload.audio);
      } else if (event === 'interrupt') {
        this.clearTts();
        this.safeCall('onSubtitle', JSON.stringify(data));
      } else if (['user_text_partial', 'user_text', 'ai_text', 'session_ready', 'turn_end'].includes(event)) {
        this.safeCall('onSubtitle', JSON.stringify(data));
      }
    },

    interruptPlayback(reason = 'user_speaking') {
      const hadAudio = playing || audioQueue.length > 0 || activeSrc.length > 0;
      this.clearTts();
      if (hadAudio) console.log('[engine] 用户开始说话，已停止上一段 TTS 播放');
      this.safeCall('onSubtitle', JSON.stringify({
        event: 'interrupt',
        payload: { reason, stop_audio_playback: true }
      }));
      this.wsSend({ event: 'interrupt', payload: { reason } });
    },

    wsSend(obj) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
      } else {
        console.warn('[engine] ⚠️ wsSend 失败, ws状态:', ws ? ws.readyState : 'null', '事件:', obj.event);
      }
    },

    // ---- 音频引擎 ----
    async initAudioEngine() {
      console.log('[engine] getUserMedia:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
      console.log('[engine] AudioContext:', !!(window.AudioContext || window.webkitAudioContext));

      // 先尝试加载 Silero VAD
      const sileroOk = await this.tryLoadSileroVAD();

      if (!sileroOk) {
        console.log('[engine] Silero VAD 不可用，使用能量 VAD 兜底');
        await this.startEnergyVAD();
      }
    },

    // ---- 方案 A: Silero VAD (vad-web) ----
    async tryLoadSileroVAD() {
      try {
        const base = this.getWwwBase();
        console.log('[engine] www base:', base);

        await this.loadScript(base + 'static/vad/ort.min.js');
        console.log('[engine] ort.js 加载成功');
        await this.loadScript(base + 'static/vad/bundle.min.js');
        console.log('[engine] vad bundle 加载成功');

        if (typeof vad === 'undefined' || !vad.MicVAD) {
          console.warn('[engine] vad.MicVAD 不存在');
          return false;
        }

        // Android WebView 的限制：
        //   1. fetch() 不支持 file:// → patch fetch
        //   2. import() 不支持 file:// → 把 .mjs 转成 blob URL
        //   3. WASM binary → 直接传 ArrayBuffer，不走 locateFile
        this.patchFetchForFileUrl();

        // 1. 把 ort-wasm-simd-threaded.mjs 转为 blob URL，让 import() 能用
        console.log('[engine] 预加载 .mjs...');
        let mjsText = await this.loadFileAsText(base + 'static/vad/ort-wasm-simd-threaded.mjs');
        // 【关键热修复】mjs 内部 fallback 逻辑有一句 `new URL("ort-wasm-simd-threaded.wasm",import.meta.url)`
        // 当 mjs 本身被转成 blob URL (blob:file://...) 时，import.meta.url 也就是这个 blob URL，
        // 拿它作为 new URL() 的 relative base 会在 WebKit/Chromium 抛出 Invalid URL 异常。
        // 因为我们直接用 wasmBinary 给 ort 配置，根本不需要它解析 wasm 路径，直接把这句死代码干掉：
        mjsText = mjsText.replace(
          'new URL("ort-wasm-simd-threaded.wasm",import.meta.url)', 
          '"ort-wasm-simd-threaded.wasm"'
        );
        const mjsBlob = new Blob([mjsText], { type: 'application/javascript' });
        const mjsBlobUrl = URL.createObjectURL(mjsBlob);
        console.log('[engine] .mjs → blob URL OK');

        console.log('[engine] 预加载 .wasm...');
        const wasmBuf = await this.loadFileAsBuffer(base + 'static/vad/ort-wasm-simd-threaded.wasm');
        console.log('[engine] .wasm OK,', wasmBuf.byteLength, 'bytes');

        vadInstance = await vad.MicVAD.new({
          model: 'v5',
          baseAssetPath: base + 'static/vad/',
          onnxWASMBasePath: base + 'static/vad/',
          // 强制使用 ScriptProcessor，因为 Android WebView 下 
          // AudioWorklet.addModule() 读取 file:// 协议会导致 DOMException
          processorType: 'ScriptProcessor',
          // ortConfig 在 vad-web 设置完 wasmPaths 之后执行，所以这里的覆盖才有效
          ortConfig: (o) => {
            console.log('[engine] ortConfig 回调执行 - 覆盖 wasmPaths');
            o.env.wasm.numThreads = 1;
            o.env.wasm.simd = true;
            o.env.wasm.wasmPaths = { mjs: mjsBlobUrl };
            o.env.wasm.wasmBinary = wasmBuf;
          },
          positiveSpeechThreshold: 0.6,
          negativeSpeechThreshold: 0.35,
          minSpeechFrames: 3,
          redemptionFrames: 8,
          preSpeechPadFrames: 3,
          startOnLoad: false,

          onSpeechStart: () => {
            if (isMuted) return;
            this.interruptPlayback('user_speaking');
            console.log('[VAD] 🗣️ Speech Start');
            isSpeaking = true;
            this.safeCall('onVadState', true);
          },

          onSpeechEnd: (audio) => {
            if (isMuted) return;
            console.log('[VAD] 🤫 Speech End, samples:', audio.length);
            isSpeaking = false;
            this.safeCall('onVadState', false);

            const int16 = new Int16Array(audio.length);
            for (let i = 0; i < audio.length; i++) {
              int16[i] = Math.max(-32768, Math.min(32767, audio[i] * 32768));
            }
            const bytes = new Uint8Array(int16.buffer);
            let bin = '';
            const C = 8192;
            for (let i = 0; i < bytes.length; i += C) {
              bin += String.fromCharCode.apply(null, bytes.subarray(i, i + C));
            }
            const b64 = btoa(bin);

            this.wsSend({
              event: 'audio_stream',
              payload: { audio_chunk: b64, sample_rate: 16000, format: 'pcm', is_complete: true }
            });
            this.wsSend({ event: 'speech_end' });
            this.safeCall('onSpeechEnd');
          },

          onVADMisfire: () => {
            console.log('[VAD] ⚡ Misfire (语音太短，忽略)');
            isSpeaking = false;
            this.safeCall('onVadState', false);
          },

          onFrameProcessed: (probs) => {
            const now = Date.now();
            if (now - lastVolTick > 100) {
              this.safeCall('onVolume', probs.isSpeech);
              lastVolTick = now;
            }
          }
        });

        await vadInstance.start();
        console.log('[engine] ✅ Silero VAD 启动成功');
        return true;
      } catch (e) {
        console.error('[engine] Silero VAD 初始化失败:', e);
        return false;
      }
    },

    // Monkey-patch window.fetch 拦截 file:// 请求改用 XHR
    // vad-web 内部 defaultModelFetcher 调 fetch()，Android WebView 不支持 file://
    patchFetchForFileUrl() {
      if (window.__fetchPatched) return;
      window.__fetchPatched = true;
      const _orig = window.fetch.bind(window);
      window.fetch = function(url, opts) {
        const u = typeof url === 'string' ? url : (url instanceof Request ? url.url : String(url));
        if (u.startsWith('file://')) {
          console.log('[fetch-patch] 拦截 file:// 请求:', u);
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', u, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => {
              // status=0 是 file:// 的正常响应
              if (xhr.status === 0 || xhr.status === 200) {
                const blob = new Blob([xhr.response]);
                // 构造与 fetch Response 兼容的对象
                resolve(new Response(blob, { status: 200, statusText: 'OK' }));
              } else {
                reject(new Error('XHR failed: ' + xhr.status + ' ' + u));
              }
            };
            xhr.onerror = () => reject(new Error('XHR network error: ' + u));
            xhr.send();
          });
        }
        return _orig(url, opts);
      };
    },

    // XHR 加载文件为 ArrayBuffer（支持 file:// 协议）
    loadFileAsBuffer(url) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.status === 0 || xhr.status === 200) {
            console.log('[engine] XHR(bin) loaded:', url, xhr.response.byteLength, 'bytes');
            resolve(xhr.response);
          } else {
            reject(new Error('XHR status: ' + xhr.status));
          }
        };
        xhr.onerror = () => reject(new Error('XHR error: ' + url));
        xhr.send();
      });
    },

    // XHR 加载文件为文本字符串（用于把 .mjs 转成 blob URL）
    loadFileAsText(url) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'text';
        xhr.onload = () => {
          if (xhr.status === 0 || xhr.status === 200) {
            console.log('[engine] XHR(text) loaded:', url, xhr.responseText.length, 'chars');
            resolve(xhr.responseText);
          } else {
            reject(new Error('XHR status: ' + xhr.status));
          }
        };
        xhr.onerror = () => reject(new Error('XHR error: ' + url));
        xhr.send();
      });
    },

    getWwwBase() {
      // location.href 形如:
      //   file:///android_asset/apps/__UNI__xxx/www/pages/chat/chat.html
      //   http://localhost:xxx/pages/chat/chat.html (H5)
      // 取到最后一个 'www/' 之前的部分，或者直接找到页面路径截断
      const href = location.href;
      const wwwIdx = href.lastIndexOf('/www/');
      if (wwwIdx !== -1) {
        return href.substring(0, wwwIdx + 5); // 包含 'www/'
      }
      // H5 或其他环境：用 origin + '/'
      return location.origin + '/';
    },

    loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => { console.log('[engine] Script loaded:', src); resolve(); };
        s.onerror = (e) => { console.error('[engine] Script failed:', src, e); reject(e); };
        document.head.appendChild(s);
      });
    },

    // ---- 方案 B: 能量 VAD 兜底 ----
    async startEnergyVAD() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
        });
        console.log('[energy] getUserMedia 成功');

        recCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (recCtx.state === 'suspended') await recCtx.resume();
        console.log('[energy] AudioContext 采样率:', recCtx.sampleRate);

        const src = recCtx.createMediaStreamSource(mediaStream);
        processor = recCtx.createScriptProcessor(4096, 1, 1);
        speechFrames = [];
        silenceStart = null;
        hasSpeech = false;

        processor.onaudioprocess = (e) => {
          if (isMuted) return;
          const ch = e.inputBuffer.getChannelData(0);

          // RMS
          let sum = 0;
          for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
          const rms = Math.sqrt(sum / ch.length);

          // 音量回传
          const now = Date.now();
          if (now - lastVolTick > 100) {
            this.safeCall('onVolume', Math.min(1, rms / 0.06));
            lastVolTick = now;
          }

          if (rms >= SPEECH_THRESH) {
            if (!hasSpeech) {
              console.log('[energy] 🗣️ Speech Start, RMS:', rms.toFixed(4));
              this.interruptPlayback('user_speaking');
              hasSpeech = true;
              isSpeaking = true;
              this.safeCall('onVadState', true);
            }
            silenceStart = null;
            speechFrames.push(new Float32Array(ch));
          } else {
            if (hasSpeech) {
              speechFrames.push(new Float32Array(ch)); // 保留尾音
              if (!silenceStart) silenceStart = now;
              else if (now - silenceStart >= SILENCE_MS) {
                console.log('[energy] 🤫 Speech End');
                this.sendEnergyAudio();
              }
            }
          }
        };

        src.connect(processor);
        processor.connect(recCtx.destination);
        console.log('[energy] ✅ 能量 VAD 启动成功');
      } catch (err) {
        console.error('[energy] 启动失败:', err.name, err.message);
      }
    },

    sendEnergyAudio() {
      isSpeaking = false;
      hasSpeech = false;
      this.safeCall('onVadState', false);

      if (speechFrames.length === 0) return;
      const total = speechFrames.reduce((s, b) => s + b.length, 0);
      let merged = new Float32Array(total);
      let off = 0;
      for (const b of speechFrames) { merged.set(b, off); off += b.length; }
      speechFrames = [];

      // 重采样到 16kHz
      const actualRate = recCtx ? recCtx.sampleRate : 16000;
      if (actualRate !== 16000) merged = this.resample(merged, actualRate, 16000);

      // Float32 → Int16
      const int16 = new Int16Array(merged.length);
      for (let i = 0; i < merged.length; i++) int16[i] = Math.max(-32768, Math.min(32767, merged[i] * 32768));

      // Base64
      const bytes = new Uint8Array(int16.buffer);
      let bin = '';
      const C = 8192;
      for (let i = 0; i < bytes.length; i += C) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + C));
      const b64 = btoa(bin);

      console.log('[energy] 发送录音, base64 长度:', b64.length);
      this.wsSend({ event: 'audio_stream', payload: { audio_chunk: b64, sample_rate: 16000, format: 'pcm', is_complete: true } });
      this.wsSend({ event: 'speech_end' });
      this.safeCall('onSpeechEnd');
    },

    resample(data, from, to) {
      const r = from / to;
      const len = Math.round(data.length / r);
      const res = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const idx = i * r;
        const lo = Math.floor(idx);
        const hi = Math.min(lo + 1, data.length - 1);
        const f = idx - lo;
        res[i] = data[lo] * (1 - f) + data[hi] * f;
      }
      return res;
    },

    // ---- TTS 播放 ----
    initPlay() {
      if (!playCtx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) playCtx = new C({ sampleRate: 16000 });
      }
    },
    enqueueTts(b64) {
      if (isSpeaking) {
        console.log('[engine] 用户说话中，丢弃 TTS chunk');
        return;
      }
      this.initPlay();
      if (!playCtx) return;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const pcm = new Int16Array(bytes.buffer);
      const buf = playCtx.createBuffer(1, pcm.length, 16000);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768.0;
      audioQueue.push(buf);
      if (!playing) this.playNext();
    },
    playNext() {
      if (audioQueue.length === 0) { playing = false; return; }
      playing = true;
      const buf = audioQueue.shift();
      const s = playCtx.createBufferSource();
      s.buffer = buf;
      s.connect(playCtx.destination);
      const ct = playCtx.currentTime;
      if (ct > nextTime || nextTime === 0) nextTime = ct + 0.05;
      s.start(nextTime);
      nextTime += buf.duration;
      activeSrc.push(s);
      s.onended = () => {
        activeSrc = activeSrc.filter(x => x !== s);
        if (audioQueue.length > 0) this.playNext();
        else if (activeSrc.length === 0) { playing = false; nextTime = 0; }
      };
    },
    onTtsChunk() { /* handled by enqueueTts via handleServerMsg */ },
    clearTts() {
      audioQueue = [];
      activeSrc.forEach(s => { try { s.stop(); } catch(e){} });
      activeSrc = [];
      playing = false;
      nextTime = 0;
    },
    onInterrupt(val) {
      if (val > 0) this.clearTts();
    },

    // ---- 清理 ----
    cleanup() {
      if (vadInstance) { try { vadInstance.pause(); } catch(e){} vadInstance = null; }
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
      if (processor) { processor.disconnect(); processor = null; }
      if (recCtx) { recCtx.close(); recCtx = null; }
      this.clearTts();
      if (ws) {
        // 先摘掉回调再 close，防止旧 ws.onclose 异步把新 ws 引用清空
        const oldWs = ws;
        oldWs.onopen = null;
        oldWs.onmessage = null;
        oldWs.onerror = null;
        oldWs.onclose = null;
        ws = null;
        try { oldWs.close(); } catch(e) {}
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.full-duplex-screen {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 999; display: flex; flex-direction: column; overflow: hidden;
  background-color: #FAFAFC;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
}

.premium-gradient-bg {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(140deg, #FDF0F6 0%, #FAFAFC 40%, #E3FDF5 100%);
  z-index: -1; overflow: hidden;
  .gradient-orb {
    position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.6;
    animation: float 20s infinite alternate ease-in-out;
  }
  .orb-1 { width: 600rpx; height: 600rpx; background: #FFDFE9; top: -100rpx; left: -100rpx; }
  .orb-2 { width: 500rpx; height: 500rpx; background: #D4F1F4; bottom: 20%; right: -50rpx; animation-delay: -5s; }
  .noise-overlay {
    position: absolute; inset: 0; opacity: 0.04; mix-blend-mode: multiply;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
}
@keyframes float {
  0% { transform: translate(0,0) scale(1); }
  100% { transform: translate(60rpx,80rpx) scale(1.1); }
}

.header {
  padding-top: calc(env(safe-area-inset-top) + 20rpx);
  display: flex; justify-content: center; align-items: center;
  .glass-badge {
    background: rgba(255,255,255,0.45); backdrop-filter: blur(12px);
    border: 1rpx solid rgba(255,255,255,0.6); padding: 12rpx 32rpx;
    border-radius: 60rpx; display: flex; align-items: center; gap: 16rpx;
    box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.04);
    .status-dot {
      width: 14rpx; height: 14rpx; border-radius: 50%; background: #D1D1D6;
      transition: all 0.3s;
      &.is-connected { background: #34C759; box-shadow: 0 0 12rpx rgba(52,199,89,0.6); }
      &.is-speaking { background: #FF9500; box-shadow: 0 0 12rpx rgba(255,149,0,0.6); animation: breathe 0.8s ease-in-out infinite alternate; }
    }
    .status-text { font-size: 24rpx; color: #555; letter-spacing: 2rpx; font-weight: 500; }
  }
}
@keyframes breathe { 0% { transform: scale(1); } 100% { transform: scale(1.3); } }

.scroll-transcript {
  flex: 1; width: 100%; height: 0;
  mask-image: linear-gradient(to bottom, transparent 2%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
}
.transcript-container { padding: 80rpx 50rpx; display: flex; flex-direction: column; }
.subtitle-stack { display: flex; flex-direction: column; gap: 64rpx; }
.subtitle-item {
  display: flex; flex-direction: column; align-items: center;
  transition: all 0.5s cubic-bezier(0.16,1,0.3,1);
  .role-name { font-size: 22rpx; color: #8E8E93; margin-bottom: 16rpx; letter-spacing: 4rpx; text-transform: uppercase; }
  .content { font-size: 42rpx; line-height: 1.45; color: #1C1C1E; text-align: center; font-weight: 400; }
  &.user-subtitle .content { color: #007AFF; }
  &.is-history { opacity: 0.4; transform: scale(0.92); filter: blur(0.5px); }
  &.is-latest { opacity: 1; transform: scale(1); animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1); }
  .interrupted-mark { color: #FF3B30; opacity: 0.8; }
}
@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(30rpx) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* 音量柱 */
.volume-vis {
  display: flex; align-items: center; justify-content: center; gap: 10rpx;
  margin-top: 60rpx; height: 100rpx;
  .bar {
    width: 12rpx; min-height: 16rpx; border-radius: 6rpx;
    background: linear-gradient(to top, #FF9500, #FF3B30);
    transition: height 0.08s ease-out;
  }
}

.listening-indicator {
  display: flex; flex-direction: column; align-items: center; margin-top: 80rpx; opacity: 0.6;
  .listening-hint { font-size: 22rpx; color: #8E8E93; letter-spacing: 2rpx; }
}

.bottom-spacer { height: 280rpx; }
.bottom-anchor { height: 1rpx; }

.glass-panel {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(to top, rgba(250,250,252,0.95) 40%, rgba(250,250,252,0) 100%);
  padding-bottom: env(safe-area-inset-bottom);
  display: flex; flex-direction: column; align-items: center;
}
.buttons-row { display: flex; align-items: center; gap: 56rpx; margin-bottom: 60rpx; }

.action-btn {
  width: 110rpx; height: 110rpx; border-radius: 50%;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  border: 1rpx solid rgba(0,0,0,0.05);
  display: flex; justify-content: center; align-items: center;
  box-shadow: 0 16rpx 40rpx rgba(0,0,0,0.06);
  transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
  .icon { font-size: 44rpx; }
  &:active { transform: scale(0.92); background: rgba(255,255,255,0.9); }
  &.is-muted { background: #E5E5EA; .icon { opacity: 0.6; filter: grayscale(1); } }
}
.hangup-btn {
  background: #FF3B30; border: none;
  box-shadow: 0 16rpx 32rpx rgba(255,59,48,0.25);
  .icon-close {
    width: 48rpx; height: 6rpx; background: white; border-radius: 6rpx;
    position: relative; transform: rotate(45deg);
    &::after { content: ''; position: absolute; width: 100%; height: 100%; background: inherit; border-radius: inherit; transform: rotate(-90deg); }
  }
  &:active { background: #D70015; transform: scale(0.9); }
}
</style>
