import { formatDuration, formatMinutesAsClock } from './lib.js'

export class AIError extends Error {
  constructor(message, detail = '') {
    super(message)
    this.name = 'AIError'
    this.detail = detail
  }
}

export function aiReady(config) {
  return Boolean(config?.url?.trim() && config?.model?.trim())
}

export function aiStatus(config) {
  if (!config?.url || !config?.model) return { ready: false, label: '未配置' }
  return { ready: true, label: config.enabled ? '已启用' : '已配置 · 未启用' }
}

export function endpointFor(rawUrl) {
  const value = String(rawUrl || '').trim().replace(/\/+$/, '')
  if (!value) throw new AIError('还没有填写 API 地址。')
  let url
  try {
    url = new URL(value)
  } catch {
    throw new AIError('API 地址格式不正确，请填写完整的 http(s) 地址。')
  }
  if (!/^https?:$/.test(url.protocol)) throw new AIError('API 地址需要以 http:// 或 https:// 开头。')
  if (/\/chat\/completions$/i.test(url.pathname)) return url.toString()
  if (/\/v1$/i.test(url.pathname)) return `${url.toString().replace(/\/+$/, '')}/chat/completions`
  return `${url.toString().replace(/\/+$/, '')}/v1/chat/completions`
}

async function postChat(config, messages, opts = {}) {
  const endpoint = endpointFor(config.url)
  const timeoutMs = opts.timeout ?? 45000
  const headers = { 'Content-Type': 'application/json' }
  if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`
  const body = JSON.stringify({
    model: config.model.trim(),
    messages,
    temperature: opts.temperature ?? 0.55,
    max_tokens: opts.maxTokens ?? 700,
    stream: false,
  })

  let response
  if (nativeHttpAvailable()) {
    try {
      response = await nativePost(endpoint, headers, body, timeoutMs)
    } catch (error) {
      if (error instanceof AIError) throw error
      throw new AIError('无法连接到 API。请检查地址与网络。', String(error?.message || error))
    }
  } else {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const fetched = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body,
      })
      response = {
        ok: fetched.ok,
        status: fetched.status,
        text: await fetched.text(),
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new AIError('请求超时了，请检查网络或稍后再试。')
      }
      throw new AIError(
        '无法连接到 API。请检查地址与网络，并确认接口允许浏览器跨域访问（CORS）。',
        String(error?.message || error),
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  const raw = response.text
  let data = null
  try { data = raw ? JSON.parse(raw) : null } catch { /* not JSON */ }

  if (!response.ok) {
    const detail = data?.error?.message || data?.message || raw.slice(0, 220)
    if (response.status === 401 || response.status === 403) {
      throw new AIError('API Key 无效，或这个 Key 没有调用该模型的权限。', detail)
    }
    if (response.status === 404) {
      throw new AIError('接口地址不存在。请检查 API 地址和模型名称。', detail)
    }
    if (response.status === 429) {
      throw new AIError('请求太频繁或额度不足，请稍后再试。', detail)
    }
    throw new AIError(`API 返回了 ${response.status}。`, detail)
  }

  const content = extractContent(data)
  if (!content) {
    throw new AIError('API 返回成功，但没有找到文本内容。请确认是 OpenAI 兼容的 Chat Completions 接口。', raw.slice(0, 220))
  }
  return { content, data }
}

function extractContent(data) {
  if (!data) return ''
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part
      if (part?.type === 'text') return part.text || ''
      return ''
    }).join('').trim()
  }
  if (typeof data.output_text === 'string') return data.output_text.trim()
  if (typeof data.response === 'string') return data.response.trim()
  return ''
}

const nativeHttpRequests = new Map()
let nativeHttpSeq = 0

function nativeHttpAvailable() {
  return typeof window !== 'undefined'
    && window.MianyuNative
    && typeof window.MianyuNative.postJson === 'function'
}

function nativePost(endpoint, headers, body, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const id = `http_${Date.now()}_${++nativeHttpSeq}`
    const timer = setTimeout(() => {
      if (!nativeHttpRequests.has(id)) return
      nativeHttpRequests.delete(id)
      reject(new AIError('请求超时了，请检查网络或稍后再试。'))
    }, Math.max(5000, Number(timeoutMs) || 45000) + 5000)
    nativeHttpRequests.set(id, { resolve, reject, timer })
    try {
      window.MianyuNative.postJson(id, endpoint, JSON.stringify(headers), body)
    } catch (error) {
      clearTimeout(timer)
      nativeHttpRequests.delete(id)
      reject(new AIError('无法启动系统网络请求。', String(error?.message || error)))
    }
  })
}

if (typeof window !== 'undefined') {
  window.__mianyuHttpResult = (id, networkOk, statusCode, responseBody, errorMessage) => {
    const request = nativeHttpRequests.get(id)
    if (!request) return
    nativeHttpRequests.delete(id)
    clearTimeout(request.timer)
    if (!networkOk) {
      request.reject(new AIError('无法连接到 API。请检查地址与网络。', errorMessage || ''))
      return
    }
    const status = Number(statusCode) || 0
    request.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: String(responseBody || ''),
    })
  }
}

export async function testAIConnection(config) {
  if (!aiReady(config)) throw new AIError('请先填写 API 地址和模型名称。')
  const started = performance.now()
  const { content, data } = await postChat(config, [
    { role: 'system', content: '你是连接测试助手。只回复：OK' },
    { role: 'user', content: '连接测试' },
  ], { maxTokens: 16, temperature: 0, timeout: 30000 })
  return {
    ms: Math.round(performance.now() - started),
    preview: content.replace(/\s+/g, ' ').slice(0, 60),
    model: data?.model || config.model,
  }
}

const SYSTEM_PROMPT = `你是一位温和、循证的睡眠教练，正在帮一位普通用户阅读自己的睡眠日记。
请遵守：
- 用简体中文，语气平静、具体、不说教。
- 只基于提供的记录作描述性分析，不把相关性说成因果，不做疾病诊断，不提供药物建议。
- 如果数据太少，要直接说明，不要编造规律。
- 输出 3 段左右、总字数约 220–320 字，可用简单的短段落，不要使用 Markdown 标题或表格。
- 至少给 2 条今晚就能执行的具体行动，并解释它与哪一条数据有关。
- 如果夜醒次数较多，可以温和地讨论夜间连续性；但不要做睡眠呼吸暂停等医学诊断。
- 结尾用一句轻松、不施压的话收束。`

function fmtDelta(value, unit = '') {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`
}

export function buildAnalysisMessages(analysis) {
  const { stats, behaviors, enriched, bounds, goalMin } = analysis
  const recent = enriched.slice(0, 10).map(e => {
    const tags = e.pre.length ? e.pre.map(id => TAG_LABELS[id] || id).join('、') : '无'
    return `${e.date}｜上床 ${e.bed}，醒来 ${e.wake}｜实际睡眠 ${Math.round(e.sleepMin)} 分｜入睡耗时 ${e.latency} 分｜夜醒 ${e.wakeups || 0} 次｜评分 ${e.score}｜醒来感受 ${e.feel}/5｜睡前行为 ${tags}`
  }).join('\n')
  const impact = behaviors.slice(0, 6).map(b => (
    `- ${b.label}：出现 ${b.n} 晚，平均评分 ${Math.round(b.avgWith)}；未出现时 ${Math.round(b.avgWithout)}；评分差 ${fmtDelta(b.scoreDelta)}，时长差 ${fmtDelta(b.durationDelta)} 分钟`
  )).join('\n') || '- 样本不足，暂无行为关联。'

  const user = `请阅读以下睡眠摘要，并给出个性化解读与建议。

【区间】${bounds.start} 至 ${bounds.end}，共 ${stats.nights} 晚记录
【目标】每晚 ${formatDuration(goalMin, 'long')}
【平均】睡眠 ${formatDuration(stats.avgDuration, 'long')}；评分 ${stats.avgScore == null ? '—' : Math.round(stats.avgScore)}/100；入睡耗时 ${stats.avgLatency == null ? '—' : Math.round(stats.avgLatency)} 分钟；夜醒 ${stats.avgWakeups == null ? '—' : (Math.round(stats.avgWakeups * 10) / 10)} 次；睡眠效率 ${stats.avgEfficiency == null ? '—' : Math.round(stats.avgEfficiency)}%；醒来感受 ${stats.avgFeel == null ? '—' : (Math.round(stats.avgFeel * 10) / 10)}/5
【节律】平均上床 ${formatMinutesAsClock(stats.avgBed)}；平均醒来 ${formatMinutesAsClock(stats.avgWake)}；上床时间波动 ${stats.bedSd == null ? '—' : Math.round(stats.bedSd)} 分钟；规律度 ${stats.regularity == null ? '—' : stats.regularity}/100；达标率 ${Math.round(stats.hitPct * 100)}%（${stats.hitGoal}/${stats.nights} 晚）
【最近记录（不含备注）】
${recent || '暂无'}
【行为关联（描述性，不代表因果）】
${impact}

请先概括这段时间最值得关注的一件事，再给 2–3 条具体建议。不要重复原始数字太多。`

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ]
}

const TAG_LABELS = {
  screen: '刷手机', caffeine: '咖啡因', alcohol: '酒精', lateMeal: '夜宵',
  exercise: '运动', stress: '压力', reading: '阅读', meditation: '冥想',
  shower: '热水澡', nap: '白天小睡',
}

export async function requestAIAnalysis(config, analysis) {
  if (!aiReady(config)) throw new AIError('请先配置 API 地址和模型。')
  if (!config.enabled) throw new AIError('AI 分析还没有启用，请先在 AI 设置里打开。')
  const messages = buildAnalysisMessages(analysis)
  const { content } = await postChat(config, messages, { maxTokens: 700, temperature: 0.55 })
  return content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '· ')
    .trim()
}
