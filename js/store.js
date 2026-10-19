import {
  addDays, clamp, isoOf, minToTime, parseISO, timeToMin, todayISO, uid,
} from './lib.js'

export const STORAGE_KEY = 'mianyu.sleep.v1'
export const APP_VERSION = '0.2.0'
export const APP_NAME = '眠屿'

export const TAGS = [
  { id: 'screen', label: '刷手机', hint: '屏幕蓝光' },
  { id: 'caffeine', label: '咖啡因', hint: '咖啡 / 茶' },
  { id: 'alcohol', label: '酒精', hint: '小酌' },
  { id: 'lateMeal', label: '夜宵', hint: '睡前加餐' },
  { id: 'exercise', label: '运动', hint: '白天活动' },
  { id: 'stress', label: '压力', hint: '思绪很多' },
  { id: 'reading', label: '阅读', hint: '纸质书' },
  { id: 'meditation', label: '冥想', hint: '呼吸练习' },
  { id: 'shower', label: '热水澡', hint: '睡前放松' },
  { id: 'nap', label: '白天小睡', hint: '午觉' },
]

export const TAG_MAP = Object.fromEntries(TAGS.map(t => [t.id, t]))

export const FEELINGS = [
  { v: 1, label: '很差', phrase: '像没睡过' },
  { v: 2, label: '疲惫', phrase: '还是好累' },
  { v: 3, label: '一般', phrase: '勉强够用' },
  { v: 4, label: '不错', phrase: '精神回来了' },
  { v: 5, label: '清爽', phrase: '元气满满' },
]

export const SKINS = [
  { id: 'moon', name: '月白', desc: '暖纸与墨', bg: '#F3F0EA', surface: '#FBF9F5', ink: '#24232B', accentHint: '#6558E8' },
  { id: 'mist', name: '雾青', desc: '安静微凉', bg: '#EDF3F0', surface: '#F9FBF9', ink: '#19231F', accentHint: '#2F8B74' },
  { id: 'sand', name: '沙丘', desc: '陶土落日', bg: '#F4ECE2', surface: '#FCF7F0', ink: '#282019', accentHint: '#B4753F' },
  { id: 'night', name: '夜航', desc: '深色护眼', bg: '#10131A', surface: '#181C24', ink: '#F0F1F5', accentHint: '#9AA6FF' },
  { id: 'custom', name: '自定', desc: '由你调色', bg: '#F2EFE8', surface: '#FCFAF6', ink: '#212127', accentHint: '#6558E8' },
]

export const ACCENTS = [
  { value: '#6558E8', name: '暮紫' },
  { value: '#2F8B74', name: '松绿' },
  { value: '#B4753F', name: '陶棕' },
  { value: '#BC5B70', name: '豆沙' },
  { value: '#397F9D', name: '海蓝' },
  { value: '#7A6A58', name: '岩灰' },
]

export const DEFAULT_AI = {
  enabled: false,
  url: '',
  model: '',
  apiKey: '',
}

export const DEFAULT_SETTINGS = {
  nickname: '小眠',
  goalMin: 450,
  skin: 'moon',
  accent: '#6558E8',
  customBg: '#F1EEE8',
  density: 'comfortable',
  corners: 'soft',
  homeOrder: 'score',
  motion: true,
  ai: { ...DEFAULT_AI },
}

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

function mergeSettings(raw = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    ai: { ...DEFAULT_AI, ...(raw.ai || {}) },
    goalMin: clamp(Math.round(Number(raw.goalMin) || DEFAULT_SETTINGS.goalMin), 240, 720),
    nickname: String(raw.nickname || DEFAULT_SETTINGS.nickname).slice(0, 20),
    customBg: /^#[0-9a-f]{6}$/i.test(raw.customBg || '') ? raw.customBg : DEFAULT_SETTINGS.customBg,
    accent: /^#[0-9a-f]{6}$/i.test(raw.accent || '') ? raw.accent : DEFAULT_SETTINGS.accent,
    skin: SKINS.some(s => s.id === raw.skin) ? raw.skin : DEFAULT_SETTINGS.skin,
    density: ['comfortable', 'compact'].includes(raw.density) ? raw.density : 'comfortable',
    corners: ['soft', 'sharp'].includes(raw.corners) ? raw.corners : 'soft',
    homeOrder: ['score', 'advice'].includes(raw.homeOrder) ? raw.homeOrder : 'score',
    motion: raw.motion !== false,
  }
}

export function normalizeLog(raw) {
  if (!raw || typeof raw !== 'object') return null
  const date = String(raw.date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const bed = String(raw.bed || '')
  const wake = String(raw.wake || '')
  if (timeToMin(bed) == null || timeToMin(wake) == null) return null
  const feel = clamp(Math.round(Number(raw.feel) || 3), 1, 5)
  const latency = clamp(Math.round(Number(raw.latency) || 0), 0, 720)
  const hasWakeups = raw.wakeups != null && raw.wakeups !== ''
  const wakeups = hasWakeups
    ? clamp(Math.round(Number(raw.wakeups) || 0), 0, 20)
    : (raw.demo ? demoWakeupFallback(date) : 0)
  const pre = Array.isArray(raw.pre)
    ? [...new Set(raw.pre.filter(id => TAG_MAP[id]))]
    : []
  const duration = Number(raw.durationMin)
  const durationMin = Number.isFinite(duration) && duration > 0
    ? clamp(Math.round(duration), 1, 960)
    : null
  return {
    id: String(raw.id || uid()),
    date,
    bed,
    wake,
    latency,
    durationMin,
    wakeups,
    feel,
    pre,
    note: String(raw.note || '').slice(0, 200),
    demo: Boolean(raw.demo),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  }
}

function normalizeLogs(logs) {
  if (!Array.isArray(logs)) return []
  const byDate = new Map()
  for (const raw of logs.slice(0, 3000)) {
    const log = normalizeLog(raw)
    if (log) byDate.set(log.date, log)
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}

function normalizeState(raw) {
  const now = Date.now()
  return {
    version: 1,
    seeded: raw.seeded !== false,
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || now,
    settings: mergeSettings(raw.settings),
    logs: normalizeLogs(raw.logs),
  }
}

export function createEmptyState(settingsPatch = {}) {
  const now = Date.now()
  return {
    version: 1,
    seeded: true,
    createdAt: now,
    updatedAt: now,
    settings: mergeSettings(settingsPatch),
    logs: [],
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeState(JSON.parse(raw))
  } catch (error) {
    console.error('Could not read local sleep data', error)
  }
  const state = createSeedState()
  saveState(state)
  return state
}

export function saveState(state) {
  state.updatedAt = Date.now()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch (error) {
    console.error('Could not save local sleep data', error)
    return false
  }
}

export function upsertLog(state, log) {
  const next = normalizeLog({ ...log, demo: false })
  if (!next) return null
  const idx = state.logs.findIndex(l => l.date === next.date || l.id === log.id)
  if (idx >= 0) {
    next.id = state.logs[idx].id
    next.createdAt = state.logs[idx].createdAt
    state.logs[idx] = next
  } else {
    state.logs.push(next)
  }
  state.logs.sort((a, b) => (a.date < b.date ? 1 : -1))
  saveState(state)
  return next
}

export function removeLog(state, id) {
  const before = state.logs.length
  state.logs = state.logs.filter(l => l.id !== id)
  if (state.logs.length !== before) saveState(state)
  return state.logs.length !== before
}

export function clearDemoLogs(state) {
  state.logs = state.logs.filter(l => !l.demo)
  saveState(state)
}

export function clearAllLogs(state) {
  state.logs = []
  saveState(state)
}

export function countDemoLogs(state) {
  return state.logs.filter(l => l.demo).length
}

export function hasSettings(state) {
  return Boolean(state?.settings)
}

/* ------------------------------------------------------------------ */
/* Backup                                                             */
/* ------------------------------------------------------------------ */

export function makeBackup(state) {
  const settings = { ...state.settings, ai: { ...state.settings.ai, apiKey: '' } }
  return {
    app: 'mianyu',
    kind: 'sleep-diary-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    logs: state.logs,
  }
}

export function parseBackup(text) {
  let data
  try { data = JSON.parse(text) } catch {
    throw new Error('文件不是有效的 JSON。')
  }
  if (!data || !Array.isArray(data.logs)) throw new Error('备份里没有找到睡眠记录。')
  if (data.logs.length > 3000) throw new Error('记录数量超出限制。')
  const logs = normalizeLogs(data.logs)
  if (!logs.length) throw new Error('备份里的睡眠记录为空或格式不正确。')
  return {
    logs,
    settings: data.settings && typeof data.settings === 'object' ? data.settings : null,
    exportedAt: data.exportedAt || null,
  }
}

export function applyBackup(state, backup) {
  const previousKey = state.settings.ai.apiKey
  const incoming = backup.settings ? mergeSettings(backup.settings) : state.settings
  state.settings = {
    ...incoming,
    ai: { ...incoming.ai, apiKey: previousKey },
  }
  state.logs = normalizeLogs(backup.logs.map(l => ({ ...l, demo: false })))
  state.seeded = true
  saveState(state)
}

/* ------------------------------------------------------------------ */
/* Demo data                                                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a += 0x6D2B79F5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function demoWakeupFallback(date) {
  const seed = Number(date.slice(5, 7)) + Number(date.slice(8, 10)) * 3
  return [0, 1, 0, 2, 1, 0, 1, 0, 2][seed % 9]
}

function makeSeedLog({ date, bed, wake, latency, feel, pre, wakeups = 0, note = '', durationMin = null }) {
  return {
    id: `demo_${date}`,
    date,
    bed,
    wake,
    latency,
    durationMin,
    wakeups,
    feel,
    pre,
    note,
    demo: true,
    createdAt: parseISO(date).getTime(),
    updatedAt: parseISO(date).getTime(),
  }
}

export function createDemoLogs(today = todayISO()) {
  const rand = mulberry32(20261019)
  const gauss = () => {
    const u = Math.max(1e-9, rand())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  const logs = []

  for (let i = 419; i >= 0; i--) {
    const date = addDays(today, -i)
    const wakeDow = parseISO(date).getDay()
    const weekend = wakeDow === 0 || wakeDow === 6
    const holidayish = rand() < 0.045

    let bedRaw = 1398 + Math.sin(i / 9.4) * 16 + gauss() * 24
    if (weekend) bedRaw += 34 + rand() * 28
    if (holidayish) bedRaw += 55 + rand() * 80
    bedRaw = clamp(bedRaw, 1275, 1595)

    const pre = []
    if (rand() < 0.49) pre.push('screen')
    if (rand() < 0.27) pre.push('caffeine')
    if (rand() < 0.09) pre.push('alcohol')
    if (rand() < 0.15) pre.push('lateMeal')
    if (rand() < 0.26) pre.push('exercise')
    if (rand() < 0.13) pre.push('stress')
    if (rand() < 0.28) pre.push('reading')
    if (rand() < 0.12) pre.push('meditation')
    if (rand() < 0.17) pre.push('shower')
    if (rand() < 0.05) pre.push('nap')
    if (!pre.length && rand() < 0.58) pre.push('reading')

    let latency = 12 + gauss() * 9
    if (pre.includes('screen')) latency += 8 + rand() * 14
    if (pre.includes('caffeine')) latency += 9 + rand() * 16
    if (pre.includes('stress')) latency += 14 + rand() * 18
    if (pre.includes('alcohol')) latency += 5 + rand() * 10
    if (pre.includes('lateMeal')) latency += 4 + rand() * 8
    if (pre.includes('exercise')) latency -= 3 + rand() * 3
    if (pre.includes('reading')) latency -= 2 + rand() * 3
    if (pre.includes('meditation')) latency -= 4 + rand() * 4
    if (pre.includes('shower')) latency -= 2 + rand() * 3
    latency = Math.round(clamp(latency, 4, 92))

    let actual = 452 + gauss() * 30
    if (pre.includes('screen')) actual -= 10 + rand() * 15
    if (pre.includes('caffeine')) actual -= 8 + rand() * 12
    if (pre.includes('alcohol')) actual -= 22 + rand() * 20
    if (pre.includes('exercise')) actual += 8 + rand() * 8
    if (pre.includes('meditation')) actual += 3 + rand() * 6
    if (pre.includes('lateMeal')) actual -= 4 + rand() * 8
    if (pre.includes('stress')) actual -= 12 + rand() * 14
    actual = Math.round(clamp(actual, 348, 530))

    const wakeRaw = bedRaw + latency + actual
    const feelRaw = 3.6 + (actual - 452) / 90
      - (pre.includes('screen') ? 0.4 : 0)
      - (pre.includes('caffeine') ? 0.22 : 0)
      - (pre.includes('alcohol') ? 0.72 : 0)
      - (pre.includes('stress') ? 0.55 : 0)
      + (pre.includes('exercise') ? 0.22 : 0)
      + (pre.includes('meditation') ? 0.3 : 0)
      + gauss() * 0.38
    const feel = clamp(Math.round(feelRaw), 1, 5)

    let wakeupRaw = 0.35 + gauss() * 0.7
    if (pre.includes('screen')) wakeupRaw += 0.25
    if (pre.includes('caffeine')) wakeupRaw += 0.35
    if (pre.includes('alcohol')) wakeupRaw += 0.9
    if (pre.includes('stress')) wakeupRaw += 0.65
    if (pre.includes('lateMeal')) wakeupRaw += 0.25
    if (pre.includes('exercise')) wakeupRaw -= 0.12
    if (pre.includes('meditation')) wakeupRaw -= 0.12
    const wakeups = Math.round(clamp(wakeupRaw, 0, 4))

    const manual = rand() < 0.065
    const durationMin = manual ? Math.round(clamp(actual + gauss() * 28, 300, 540)) : null

    logs.push(makeSeedLog({
      date,
      bed: minToTime(bedRaw),
      wake: minToTime(wakeRaw),
      latency,
      feel,
      pre,
      wakeups,
      durationMin,
    }))
  }

  // The most recent week tells a clear, friendly story for the demo charts.
  const week = [
    { ago: 6, bed: '23:38', wake: '07:12', latency: 19, feel: 4, pre: ['screen', 'reading'], wakeups: 1, note: '' },
    { ago: 5, bed: '23:16', wake: '07:08', latency: 9, feel: 4, pre: ['shower', 'reading'], wakeups: 0, note: '' },
    { ago: 4, bed: '00:03', wake: '07:01', latency: 28, feel: 3, pre: ['lateMeal', 'stress', 'screen'], wakeups: 2, note: '下午那杯咖啡太晚了，脑子一直很热闹。' },
    { ago: 3, bed: '23:08', wake: '07:22', latency: 12, feel: 4, pre: ['exercise', 'meditation'], wakeups: 0, note: '' },
    { ago: 2, bed: '23:27', wake: '07:05', latency: 21, feel: 4, pre: ['screen', 'caffeine'], wakeups: 1, note: '' },
    { ago: 1, bed: '23:12', wake: '07:11', latency: 14, feel: 4, pre: ['reading', 'shower'], wakeups: 0, note: '睡前读了会儿书，入睡很快。' },
    { ago: 0, bed: '23:06', wake: '07:02', latency: 11, feel: 4, pre: ['reading', 'meditation'], wakeups: 0, note: '把手机留在客厅，值得再来一次。' },
  ]
  const recent = new Map(week.map(item => {
    const date = addDays(today, -item.ago)
    return [date, makeSeedLog({ ...item, date })]
  }))
  return logs.map(log => recent.get(log.date) || log).sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function createSeedState() {
  const base = createEmptyState()
  base.logs = createDemoLogs()
  return base
}

export function restoreDemoData(state) {
  const existing = new Set(state.logs.filter(l => !l.demo).map(l => l.date))
  const demo = createDemoLogs().filter(l => !existing.has(l.date))
  state.logs = [...state.logs, ...demo].sort((a, b) => (a.date < b.date ? 1 : -1))
  state.seeded = true
  saveState(state)
}
