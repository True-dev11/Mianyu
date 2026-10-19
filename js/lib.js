/* Tiny shared utilities — no dependencies, no network. */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const pad2 = n => String(n).padStart(2, '0')

export function isoOf(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
}

export function todayISO() {
  return isoOf(new Date())
}

export function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return isoOf(d)
}

export function diffDays(a, b) {
  return Math.round((parseISO(a) - parseISO(b)) / 86400000)
}

export function daysBetween(startISO, endISO) {
  const out = []
  for (let d = startISO; d <= endISO; d = addDays(d, 1)) out.push(d)
  return out
}

export function timeToMin(value) {
  if (!value || typeof value !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function minToTime(total) {
  const m = ((Math.round(total) % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

// Time in bed for one night. A wake clock that is not after the bed clock is the next morning.
export function durationBetween(bed, wake) {
  const b = timeToMin(bed)
  const w = timeToMin(wake)
  if (b == null || w == null) return null
  let d = w - b
  if (d <= 0) d += 1440
  return d
}

export function sleepStartMin(bed, latency) {
  const b = timeToMin(bed)
  if (b == null) return null
  return (b + Math.max(0, Number(latency) || 0)) % 1440
}

export function formatDuration(min, style = 'compact') {
  const m = Math.max(0, Math.round(Number(min) || 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (style === 'long') {
    if (!h) return `${r} 分钟`
    return r ? `${h} 小时 ${r} 分` : `${h} 小时`
  }
  if (!h) return `${r}m`
  return r ? `${h}h ${pad2(r)}m` : `${h}h`
}

export function formatDurationParts(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  return { h: Math.floor(m / 60), m: m % 60 }
}

export function formatClock(value) {
  const m = timeToMin(value)
  return m == null ? '—' : minToTime(m)
}

export function formatMinutesAsClock(total) {
  if (total == null || !Number.isFinite(total)) return '—'
  return minToTime(total)
}

export function formatCompactMinutes(min) {
  const m = Math.max(0, Math.round(Math.abs(Number(min) || 0)))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} 小时 ${r} 分` : `${h} 小时`
}

const WEEK_SHORT = ['日', '一', '二', '三', '四', '五', '六']

export function weekdayCN(iso, short = true) {
  const d = parseISO(iso)
  return (short ? '周' : '星期') + WEEK_SHORT[d.getDay()]
}

export function formatDateCN(iso, opts = {}) {
  const d = parseISO(iso)
  const today = todayISO()
  if (opts.relative) {
    if (iso === today) return '今天'
    if (iso === addDays(today, -1)) return '昨天'
    if (iso === addDays(today, -2)) return '前天'
  }
  const base = `${d.getMonth() + 1}月${d.getDate()}日`
  return opts.weekday === false ? base : `${base} ${weekdayCN(iso)}`
}

export function formatMonthCN(iso) {
  const d = parseISO(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

export function formatMonthShort(iso) {
  const d = parseISO(iso)
  return `${d.getMonth() + 1}月`
}

export function formatDateRange(startISO, endISO) {
  const a = parseISO(startISO)
  const b = parseISO(endISO)
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getFullYear()}.${a.getMonth() + 1}.${a.getDate()} – ${b.getFullYear()}.${b.getMonth() + 1}.${b.getDate()}`
  }
  if (a.getMonth() === b.getMonth()) {
    return `${a.getMonth() + 1}月${a.getDate()}日 – ${b.getDate()}日`
  }
  return `${a.getMonth() + 1}.${a.getDate()} – ${b.getMonth() + 1}.${b.getDate()}`
}

export function nightLabel(wakeISO) {
  const bedISO = addDays(wakeISO, -1)
  const a = parseISO(bedISO)
  const b = parseISO(wakeISO)
  if (a.getMonth() === b.getMonth()) {
    return `${a.getMonth() + 1}月${a.getDate()}–${b.getDate()}日`
  }
  return `${a.getMonth() + 1}月${a.getDate()}日 – ${b.getMonth() + 1}月${b.getDate()}日`
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function average(values) {
  const nums = values.filter(v => Number.isFinite(v))
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

export function median(values) {
  const nums = values.filter(v => Number.isFinite(v)).slice().sort((a, b) => a - b)
  if (!nums.length) return null
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
}

export function stdDev(values) {
  const nums = values.filter(v => Number.isFinite(v))
  if (nums.length < 2) return null
  const mean = average(nums)
  const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (nums.length - 1)
  return Math.sqrt(variance)
}

// Bedtimes are anchored around 02:00 so 23:40 and 00:10 are neighbours, not 23 hours apart.
export function bedtimeAnchor(time) {
  const m = timeToMin(time)
  if (m == null) return null
  return m > 12 * 60 ? m - 1440 : m
}

export function wakeAnchor(time) {
  const m = timeToMin(time)
  if (m == null) return null
  return m > 16 * 60 ? m - 1440 : m
}

export function averageBedtime(logs) {
  return average(logs.map(l => bedtimeAnchor(l.bed)))
}

export function averageWake(logs) {
  return average(logs.map(l => wakeAnchor(l.wake)))
}

export function uid(prefix = 'log') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
}

export function mixHex(a, b, amount = 0.5) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return a
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * amount,
    g: ca.g + (cb.g - ca.g) * amount,
    b: ca.b + (cb.b - ca.b) * amount,
  })
}

export function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const values = [rgb.r, rgb.g, rgb.b].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
}

export function contrastOn(hex, dark = '#171820', light = '#FFFFFF') {
  return luminance(hex) > 0.46 ? dark : light
}

export function clampRange(range, max) {
  const start = Math.max(0, Math.round(range.start))
  return { start, end: Math.min(max, Math.round(range.end)) }
}
