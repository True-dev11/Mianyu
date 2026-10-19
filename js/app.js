import {
  addDays, average, clamp, contrastOn, diffDays, esc, formatDateCN, formatDateRange,
  formatDuration, formatMinutesAsClock, greetingForHour, isoOf, luminance, minToTime,
  mixHex, nightLabel, parseISO, timeToMin, todayISO, weekdayCN,
} from './lib.js'
import {
  ACCENTS, APP_NAME, APP_VERSION, DEFAULT_SETTINGS, FEELINGS, SKINS, TAGS, TAG_MAP,
  applyBackup, clearAllLogs, clearDemoLogs, countDemoLogs, createDemoLogs, loadState,
  makeBackup, parseBackup, removeLog, restoreDemoData, saveState, upsertLog,
} from './store.js'
import {
  RANGES, buildAnalytics, chartBuckets, enrichLog, enrichLogs, scoreBand, summarizePeriod,
} from './sleep.js'
import {
  aiReady, aiStatus, requestAIAnalysis, testAIConnection,
} from './ai.js'
import { emptyArt, faceSVG, icon, logoMark, tagIcon } from './icons.js'

const app = document.getElementById('app')
const main = document.getElementById('main')
const sheetRoot = document.getElementById('sheet-root')
const toastHost = document.getElementById('toast-host')
const nav = document.querySelector('.tabbar')
const importFile = document.getElementById('import-file')

const VIEWS = ['home', 'trends', 'diary', 'settings']
const VIEW_HASH = /^#\/(home|trends|diary|settings)\b/

let state = loadState()
let pageAnimate = true
let sheetTimer = null
let toastTimer = null
let scrollBeforeSheet = 0
let lastFocused = null
let themeTimer = null
let aiSequence = 0
let aiGeneration = 0

const ui = {
  view: 'home',
  trendRange: '7d',
  diaryRange: '1m',
  diaryLimit: 14,
  trendMetric: 'duration',
  calendarMonth: todayISO().slice(0, 7),
  form: null,
  aiLoading: {},
  aiInsights: {},
  aiErrors: {},
  confirm: null,
  pendingImport: null,
  peek: null,
}

const CUSTOM_VARS = [
  '--custom-bg', '--custom-surface', '--custom-surface-2', '--custom-surface-3',
  '--custom-ink', '--custom-ink-2', '--custom-muted', '--custom-line',
  '--custom-line-strong', '--custom-hero', '--custom-hero-ink',
  '--custom-hero-muted', '--custom-outside',
]

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const motionReduced = () => !state.settings.motion
  || window.matchMedia('(prefers-reduced-motion: reduce)').matches

const nativeFileRequests = new Map()
let nativeFileSeq = 0

function isNativeApp() {
  return Boolean(typeof window !== 'undefined' && window.MianyuNative)
}

function nativeHas(method) {
  return isNativeApp() && typeof window.MianyuNative[method] === 'function'
}

function nextNativeFileId() {
  return `file_${Date.now()}_${++nativeFileSeq}`
}

window.__mianyuFileResult = (id, ok, data, message) => {
  const request = nativeFileRequests.get(id)
  if (!request) return
  nativeFileRequests.delete(id)
  if (request.kind === 'save') {
    if (ok) showToast('备份已保存')
    else if (message && message !== 'cancelled') showToast(message, 'error')
    return
  }
  if (request.kind === 'import') {
    if (!ok) {
      if (message && message !== 'cancelled') showToast(message || '没有读取到备份', 'error')
      request.reject(new Error('cancelled'))
      return
    }
    request.resolve(String(data || ''))
  }
}

function syncNativeSystemBars(background) {
  if (!nativeHas('setSystemBars') || !background) return
  try {
    window.MianyuNative.setSystemBars(background, document.documentElement.style.colorScheme === 'dark')
  } catch { /* native bridge optional */ }
}

/* ------------------------------------------------------------------ */
/* Appearance                                                         */
/* ------------------------------------------------------------------ */

function customSurfaceColors(bg) {
  const dark = luminance(bg) < 0.33
  if (dark) {
    return {
      '--custom-bg': bg,
      '--custom-surface': mixHex(bg, '#FFFFFF', .075),
      '--custom-surface-2': mixHex(bg, '#FFFFFF', .12),
      '--custom-surface-3': mixHex(bg, '#FFFFFF', .17),
      '--custom-ink': '#F0F2F6',
      '--custom-ink-2': mixHex('#F0F2F6', bg, .25),
      '--custom-muted': mixHex('#F0F2F6', bg, .52),
      '--custom-line': 'rgba(255, 255, 255, .085)',
      '--custom-line-strong': 'rgba(255, 255, 255, .16)',
      '--custom-hero': mixHex(mixHex(bg, state.settings.accent, .15), '#05060A', .22),
      '--custom-hero-ink': '#F6F4EE',
      '--custom-hero-muted': 'rgba(246, 244, 238, .56)',
      '--custom-outside': mixHex(bg, '#000000', .55),
    }
  }
  return {
    '--custom-bg': bg,
    '--custom-surface': mixHex(bg, '#FFFFFF', .76),
    '--custom-surface-2': mixHex(bg, '#000000', .045),
    '--custom-surface-3': mixHex(bg, '#000000', .085),
    '--custom-ink': '#222128',
    '--custom-ink-2': mixHex('#222128', bg, .38),
    '--custom-muted': mixHex('#222128', bg, .53),
    '--custom-line': 'rgba(34, 33, 40, .085)',
    '--custom-line-strong': 'rgba(34, 33, 40, .17)',
    '--custom-hero': mixHex('#23222C', state.settings.accent, .13),
    '--custom-hero-ink': '#F8F4EC',
    '--custom-hero-muted': 'rgba(248, 244, 236, .58)',
    '--custom-outside': mixHex(bg, '#000000', .13),
  }
}

function applyAppearance(withTransition = false) {
  const settings = state.settings
  const root = document.documentElement
  root.dataset.skin = settings.skin
  root.dataset.density = settings.density
  root.dataset.corners = settings.corners
  root.dataset.motion = settings.motion ? 'on' : 'off'
  root.style.setProperty('--accent', settings.accent)
  root.style.setProperty('--on-accent', contrastOn(settings.accent))
  for (const key of CUSTOM_VARS) root.style.removeProperty(key)

  if (settings.skin === 'custom') {
    const vars = customSurfaceColors(settings.customBg)
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
    root.style.colorScheme = luminance(settings.customBg) < 0.33 ? 'dark' : 'light'
  } else {
    root.style.colorScheme = settings.skin === 'night' ? 'dark' : 'light'
  }

  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta && bg) meta.content = bg
  syncNativeSystemBars(bg)

  if (withTransition && !motionReduced()) {
    root.classList.add('theme-transitioning')
    clearTimeout(themeTimer)
    themeTimer = setTimeout(() => root.classList.remove('theme-transitioning'), 360)
  }
}

/* ------------------------------------------------------------------ */
/* Routing & page rendering                                           */
/* ------------------------------------------------------------------ */

function viewFromHash() {
  const match = VIEW_HASH.exec(window.location.hash)
  return match?.[1] || 'home'
}

function revealAttr(index, baseClass = '') {
  if (!pageAnimate) return baseClass ? `class="${baseClass}"` : ''
  return `class="${baseClass ? baseClass + ' ' : ''}reveal" style="--i:${index}"`
}

function updateNav() {
  $$('.tabbar [data-nav]').forEach(button => {
    const current = button.dataset.nav === ui.view
    if (current) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
  $$('.nav-icon').forEach(el => {
    if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon)
  })
}

function navigate(view) {
  if (!VIEWS.includes(view) || ui.view === view) {
    if (ui.view === view) main.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' })
    return
  }
  closeSheet(true)
  ui.view = view
  const hash = `#/${view}`
  if (window.location.hash !== hash) history.pushState(null, '', hash)
  render()
  main.scrollTop = 0
}

function render({ animate = true, preserveScroll = false } = {}) {
  pageAnimate = animate
  applyAppearance(false)
  const previousScroll = main.scrollTop
  const content = ui.view === 'trends' ? renderTrends()
    : ui.view === 'diary' ? renderDiary()
      : ui.view === 'settings' ? renderSettings()
        : renderHome()

  main.innerHTML = `<div class="page${animate ? '' : ' no-anim'}">${content}</div>`
  updateNav()
  main.scrollTop = preserveScroll ? previousScroll : 0
  if (animate) animatePageBits()
}

function bootstrap() {
  $$('.nav-icon').forEach(el => { el.innerHTML = icon(el.dataset.icon) })
  $$('.record-fab-circle').forEach(el => { el.innerHTML = icon('plus') })
  ui.view = viewFromHash()
  if (!window.location.hash) history.replaceState(null, '', '#/home')
  applyAppearance(false)
  bindGlobalEvents()
  render({ animate: true })
}

window.addEventListener('popstate', () => {
  closeSheet(true)
  ui.view = viewFromHash()
  render()
  main.scrollTop = 0
})

window.addEventListener('beforeunload', () => saveState(state))

/* ------------------------------------------------------------------ */
/* Motion                                                             */
/* ------------------------------------------------------------------ */

function animatePageBits() {
  if (!pageAnimate) return
  const reduce = motionReduced()

  for (const el of $$('[data-count]', main)) {
    const target = Number(el.dataset.count)
    if (!Number.isFinite(target)) continue
    if (reduce) {
      el.textContent = String(target)
      continue
    }
    const duration = 720
    const start = performance.now()
    el.textContent = '0'
    const tick = now => {
      const p = clamp((now - start) / duration, 0, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      el.textContent = String(Math.round(target * eased))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  for (const path of $$('[data-ring-offset]', main)) {
    const target = Number(path.dataset.ringOffset)
    if (!Number.isFinite(target)) continue
    if (reduce) {
      path.style.strokeDashoffset = String(target)
      continue
    }
    const circumference = Number(path.dataset.circumference) || 301.59
    path.style.strokeDashoffset = String(circumference)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { path.style.strokeDashoffset = String(target) })
    })
  }
}

function haptic(pattern = 8) {
  if (!motionReduced() && navigator.vibrate) {
    try { navigator.vibrate(pattern) } catch { /* optional */ }
  }
}

/* ------------------------------------------------------------------ */
/* Sheets, dialogs, toast, focus                                      */
/* ------------------------------------------------------------------ */

function isSheetOpen() {
  return sheetRoot.classList.contains('is-open')
}

function mountSheet(html, focusSelector = '.sheet') {
  const wasOpen = isSheetOpen()
  clearTimeout(sheetTimer)
  if (!wasOpen) {
    scrollBeforeSheet = main.scrollTop
    lastFocused = document.activeElement
  }
  sheetRoot.innerHTML = html
  main.classList.add('sheet-open')
  if (!wasOpen) {
    // Force a paint at the starting position so the spring-in is visible.
    void sheetRoot.offsetWidth
    requestAnimationFrame(() => sheetRoot.classList.add('is-open'))
  } else {
    sheetRoot.classList.add('is-open')
  }
  requestAnimationFrame(() => {
    const focusTarget = sheetRoot.querySelector(focusSelector)
    focusTarget?.focus({ preventScroll: true })
  })
}

function closeSheet(immediate = false) {
  const wasOpen = isSheetOpen()
  clearTimeout(sheetTimer)
  sheetRoot.classList.remove('is-open')
  main.classList.remove('sheet-open')
  if (wasOpen) main.scrollTop = scrollBeforeSheet
  sheetRoot.setAttribute('aria-hidden', 'false')

  const cleanup = () => {
    if (!isSheetOpen()) {
      sheetRoot.innerHTML = ''
      ui.confirm = null
      ui.form = null
    }
  }
  if (immediate) {
    cleanup()
  } else {
    sheetTimer = setTimeout(cleanup, 460)
  }
  if (wasOpen && lastFocused && lastFocused.isConnected) {
    setTimeout(() => lastFocused.focus({ preventScroll: true }), immediate ? 0 : 320)
  }
}

function showToast(message, type = 'success') {
  clearTimeout(toastTimer)
  const old = toastHost.querySelector('.toast')
  if (old) old.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check')}<span>${esc(message)}</span>`
  toastHost.appendChild(el)
  void el.offsetWidth
  requestAnimationFrame(() => el.classList.add('is-visible'))
  toastTimer = setTimeout(() => {
    el.classList.remove('is-visible')
    setTimeout(() => el.remove(), 320)
  }, 2800)
}

function openConfirm({ title, message, confirmLabel = '确认', cancelLabel = '取消', danger = false, action }) {
  ui.confirm = { title, message, confirmLabel, cancelLabel, danger, action }
  const html = `
    <div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="dialog-wrap">
      <div class="dialog" tabindex="-1" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">${esc(title)}</h2>
        <p>${esc(message)}</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-action="close-sheet">${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-yes">${esc(confirmLabel)}</button>
        </div>
      </div>
    </div>`
  mountSheet(html, '.dialog')
}

function focusTrap(event) {
  if (event.key === 'Escape' && isSheetOpen()) {
    event.preventDefault()
    closeSheet()
    return
  }
  if (event.key !== 'Tab' || !isSheetOpen()) return
  const focusables = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', sheetRoot)
    .filter(el => !el.disabled && !el.classList.contains('visually-hidden') && el.offsetParent !== null)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

/* ------------------------------------------------------------------ */
/* Small render helpers                                               */
/* ------------------------------------------------------------------ */

function nickname() {
  return (state.settings.nickname || '').trim() || '小眠'
}

function initial(name = nickname()) {
  return Array.from(name.trim())[0] || '眠'
}

function goalLabel() {
  return formatDuration(state.settings.goalMin, 'long')
}

function displayEfficiency(value) {
  return value == null ? '—' : `${Math.round(value)}%`
}

function signed(value, unit = '') {
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded)) return '—'
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`
}

function toneClass(tone) {
  if (tone === 'mid') return 'tone-mid'
  if (tone === 'warn' || tone === 'bad') return 'tone-bad'
  return ''
}

function scoreChip(score, extra = '') {
  const band = scoreBand(score)
  return `<span class="score-chip ${toneClass(band.tone)} ${extra}">${Math.round(score)}<small>分</small></span>`
}

function scoreRing(score, { animatable = true, detail = false } = {}) {
  const safeScore = clamp(Number(score) || 0, 0, 100)
  const radius = detail ? 38 : 48
  const center = detail ? 46 : 58
  const view = detail ? 92 : 116
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - safeScore / 100)
  const initial = animatable && pageAnimate && !motionReduced() ? circumference : offset
  const dataAttrs = animatable && pageAnimate
    ? `data-ring-offset="${offset}" data-circumference="${circumference}"`
    : ''
  return `<div class="${detail ? 'detail-ring' : 'score-ring-wrap'}">
    <svg class="score-ring" viewBox="0 0 ${view} ${view}" aria-hidden="true">
      <circle class="score-ring__track" cx="${center}" cy="${center}" r="${radius}"></circle>
      <circle class="score-ring__value" cx="${center}" cy="${center}" r="${radius}"
        style="stroke-dasharray:${circumference};stroke-dashoffset:${initial}" ${dataAttrs}></circle>
    </svg>
    <div class="score-ring__center">
      <span class="score-ring__number" ${animatable ? `data-count="${Math.round(safeScore)}"` : ''}>${Math.round(safeScore)}</span>
      <span class="score-ring__unit">分</span>
    </div>
  </div>`
}

function previewRing(score) {
  const circumference = 2 * Math.PI * 23
  const offset = circumference * (1 - clamp(score, 0, 100) / 100)
  return `<div class="preview-ring">
    <svg viewBox="0 0 56 56" aria-hidden="true">
      <circle class="track" cx="28" cy="28" r="23"></circle>
      <circle class="value" id="preview-ring-value" cx="28" cy="28" r="23" style="stroke-dashoffset:${offset}"></circle>
    </svg>
    <span class="preview-score" id="preview-score">${Math.round(score)}</span>
  </div>`
}

function rangeTabs(scope, active) {
  return `<div class="range-tabs" role="tablist" aria-label="时间范围">
    ${RANGES.map(r => `<button type="button" role="tab" aria-selected="${active === r.key}"
      class="range-tab${active === r.key ? ' is-active' : ''}"
      data-range="${r.key}" data-range-scope="${scope}">${r.label}</button>`).join('')}
  </div>`
}

function sectionHead(title, subtitle = '', action = '') {
  return `<div class="section-head">
    <div><h2>${esc(title)}</h2>${subtitle ? `<div class="section-sub">${esc(subtitle)}</div>` : ''}</div>
    ${action}
  </div>`
}

function pageHead(title, subtitle, action = '') {
  return `<header class="page-head">
    <div><h1>${esc(title)}</h1>${subtitle ? `<p class="page-sub">${esc(subtitle)}</p>` : ''}</div>
    ${action ? `<div class="page-head-actions">${action}</div>` : ''}
  </header>`
}

function miniFace(feel, className = '') {
  return `<span class="recent-feel ${className}">${faceSVG(feel)}</span>`
}

function emptyState({ title, body, actionLabel, action, art = 'moon' }) {
  return `<div class="empty-state">
    ${emptyArt(art)}
    <h2>${esc(title)}</h2>
    <p>${esc(body)}</p>
    ${actionLabel ? `<button type="button" class="btn btn-primary" data-action="${action || 'open-record'}">${icon('plus')}${esc(actionLabel)}</button>` : ''}
  </div>`
}

/* ------------------------------------------------------------------ */
/* Home                                                               */
/* ------------------------------------------------------------------ */

function renderHome() {
  const today = todayISO()
  const weekly = buildAnalytics(state.logs, state.settings, '7d', today)
  const monthly = buildAnalytics(state.logs, state.settings, '1m', today)
  const latest = [...state.logs]
    .filter(log => log.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null
  const demoCount = countDemoLogs(state)
  const hero = renderHomeHero(latest, weekly, today)
  const tip = renderHomeTip(monthly)
  const mini = renderMiniChart(weekly)
  const recent = renderRecentNights(latest)
  const order = state.settings.homeOrder === 'advice'
    ? [tip, hero, mini, recent]
    : [hero, tip, mini, recent]
  const quote = `
    <div class="page-quote ${pageAnimate ? 'reveal' : ''}" style="--i:5">
      <span class="quote-mark">${icon('moon')}</span>
      睡眠不是一项待办。<br>只是每天回到自己身边的一小段路。
    </div>`

  return `
    <header class="home-head">
      <div class="brand-lockup">
        ${logoMark()}
        <div><div class="brand-name">眠屿</div><div class="brand-sub">SLEEP DIARY</div></div>
      </div>
      <button type="button" class="avatar-btn" data-nav="settings" aria-label="打开设置">${esc(initial())}</button>
    </header>

    <div class="greeting-block">
      <div class="eyebrow">A QUIET PLACE FOR NIGHT</div>
      <h1>${greetingForHour()}，${esc(nickname())}</h1>
      <div class="greeting-meta">
        <span>${formatDateCN(today)}</span>
        <span class="sep"></span>
        <span>${state.logs.length ? `已记录 ${state.logs.length} 晚` : '从今晚开始'}</span>
      </div>
    </div>

    ${demoCount ? `<div class="demo-banner">${icon('info')}<span>这些是示例数据，方便你预览趋势。正式记录前可以一键清空。</span><button type="button" data-action="clear-demo">清空示例</button></div>` : ''}

    ${order.join('')}

    ${quote}
  `
}

function renderHomeHero(log, weekly, today) {
  if (!log) {
    return `<section ${revealAttr(1, 'sleep-hero')}>
      <div class="hero-empty">
        ${emptyArt('moon')}
        <h2>夜晚还没有被记下</h2>
        <p>记下昨晚的上床、入睡和醒来。第一页不需要完美，只要真实。</p>
        <button type="button" class="btn" data-action="open-record">${icon('plus')}记录第一晚</button>
      </div>
    </section>`
  }

  const enriched = enrichLog(log, state.logs, state.settings.goalMin)
  const band = enriched.band
  const recordedToday = log.date === today
  const label = recordedToday ? '昨夜睡眠' : '最近一晚'
  const weekAverage = weekly.stats.avgScore
  let comparison = `按 ${goalLabel()} 目标、入睡速度与作息节律综合计算`
  if (weekly.stats.nights >= 3 && weekAverage != null) {
    const delta = enriched.score - weekAverage
    if (Math.abs(delta) < 1.5) comparison = '和近 7 天的平均状态差不多'
    else comparison = `比近 7 天平均${delta > 0 ? '高' : '低'} ${Math.abs(Math.round(delta))} 分`
  }

  const windowMin = Math.max(1, enriched.windowMin)
  const latencyPct = clamp((enriched.latency / windowMin) * 100, 0, 96)
  const sleepPct = clamp((enriched.sleepMin / windowMin) * 100, 0, 100 - latencyPct)
  const recordDate = nightLabel(log.date)
  const prompt = !recordedToday
    ? `<div class="hero-prompt">${icon('moon')}<span>昨晚的睡眠还空着</span><button type="button" data-action="open-record">现在补记</button></div>`
    : ''

  return `<section ${revealAttr(1, 'sleep-hero')}>
    <div class="hero-topline">
      <span class="hero-eyebrow">${icon('moon')}${label}</span>
      <div class="hero-top-actions">
        <span class="hero-date">${recordDate}</span>
        <button type="button" class="hero-edit" data-action="edit-log" data-id="${esc(log.id)}" aria-label="编辑这一晚">${icon('edit')}</button>
      </div>
    </div>

    <div class="hero-score-row">
      ${scoreRing(enriched.score)}
      <div class="hero-score-copy">
        <div class="eyebrow">SLEEP SCORE</div>
        <div class="score-state">${band.label}</div>
        <p>${esc(comparison)}</p>
        <button type="button" class="hero-link" data-action="view-log" data-id="${esc(log.id)}">看看这一晚${icon('chevron')}</button>
      </div>
    </div>

    <div class="hero-night">
      <div class="night-times">
        <div class="night-time">
          <span class="nt-label">${icon('moon')}上床</span>
          <strong>${log.bed}</strong>
        </div>
        <div class="night-time">
          <span class="nt-label">醒来${icon('sunrise')}</span>
          <strong>${log.wake}</strong>
        </div>
      </div>
      <div class="hero-track" aria-hidden="true">
        <span class="hero-track-latency" style="width:${latencyPct}%"></span>
        <span class="hero-track-sleep" style="left:${latencyPct}%;width:${sleepPct}%"></span>
      </div>
      <div class="hero-metrics">
        <div class="hero-metric"><span>实际睡眠</span><strong>${formatDuration(enriched.sleepMin)}</strong></div>
        <div class="hero-metric"><span>睡眠效率</span><strong>${displayEfficiency(enriched.efficiency)}</strong></div>
        <div class="hero-metric"><span>入睡用时</span><strong>${enriched.latency} 分</strong></div>
        <div class="hero-metric"><span>夜醒</span><strong>${enriched.wakeups} 次</strong></div>
      </div>
    </div>
    ${prompt}
  </section>`
}

function renderHomeTip(monthly) {
  const suggestion = monthly.suggestions[0] || {
    title: '慢一点，也算前进',
    body: '今晚先做一件让身体放松的小事，不需要把睡眠变成任务。',
  }
  const kicker = monthly.stats.nights ? '今晚的建议 · 根据近 30 天' : '开始的地方'
  return `<section ${revealAttr(2, 'tip-card')}>
    <div class="tip-orb">${icon('sparkle')}</div>
    <div class="tip-copy">
      <div class="tip-kicker">${kicker}</div>
      <h3>${esc(suggestion.title)}</h3>
      <p>${esc(suggestion.body)}</p>
      <button type="button" class="text-btn tip-more" data-nav="trends">看看更多发现${icon('chevron')}</button>
    </div>
  </section>`
}

function renderMiniChart(analysis) {
  const stats = analysis.stats
  const buckets = analysis.buckets
  const values = buckets.map(b => b.count ? average(b.entries.map(e => e.sleepMin)) : null)
  const numbers = values.filter(Number.isFinite)
  const goal = analysis.goalMin
  const yMax = Math.max(480, goal + 50, ...numbers.map(v => v + 45))
  const goalPos = 16 + (goal / yMax) * 68
  const bars = buckets.map((bucket, i) => {
    const value = values[i]
    const pct = value == null ? 0 : clamp((value / yMax) * 100, 4, 100)
    const short = value != null && value < goal * 0.8
    return `<div class="mini-col${bucket.date === todayISO() ? ' is-today' : ''}">
      <div class="mini-slot">
        <span class="mini-bar${value == null ? ' is-empty' : short ? ' tone-warn' : value < goal * 0.92 ? ' tone-mid' : ''}"
          style="height:${value == null ? 3 : pct}%;--i:${i}" aria-hidden="true"></span>
      </div>
      <span class="mini-day">${esc(bucket.label)}</span>
    </div>`
  }).join('')

  const summary = stats.nights
    ? `平均 <strong>${formatDuration(stats.avgDuration)}</strong> · 达标 <strong>${stats.hitGoal}/${stats.nights}</strong> 晚`
    : '这一周还没有记录，第一根小柱子会从今晚开始。'

  return `<section ${revealAttr(3, 'mini-card')}>
    ${sectionHead('近 7 天', '目标线穿过的地方，是身体在慢慢靠近。',
      `<button type="button" class="text-btn" data-nav="trends">查看趋势${icon('chevron')}</button>`)}
    <div class="mini-chart" role="img" aria-label="近 7 天睡眠时长小图">
      ${bars}
      <div class="mini-goal" style="bottom:${goalPos}px"><span>目标 ${formatDuration(goal)}</span></div>
    </div>
    <div class="mini-summary">${stats.nights ? summary : summary}</div>
  </section>`
}

function renderRecentNights(latest) {
  const logs = [...state.logs]
    .filter(log => log.date <= todayISO())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 2)
  if (!logs.length) return ''
  const rows = logs.map(log => {
    const enriched = enrichLog(log, state.logs, state.settings.goalMin)
    const d = parseISO(log.date)
    const tag = log.pre.length ? TAG_MAP[log.pre[0]]?.label : '没有记录习惯'
    const band = enriched.band
    return `<button type="button" class="recent-row" data-action="view-log" data-id="${esc(log.id)}">
      <span class="recent-day"><strong>${d.getDate()}</strong>${d.getMonth() + 1}月 · ${weekdayCN(log.date).replace('周', '')}</span>
      <span class="recent-main">
        <span class="recent-title">${formatDuration(enriched.sleepMin)}<span class="recent-tag">${esc(tag || '无行为')}</span></span>
        <span class="recent-sub">${log.bed} – ${log.wake} · 入睡 ${enriched.latency} 分 · 夜醒 ${enriched.wakeups} 次</span>
      </span>
      ${miniFace(log.feel)}
      <span class="recent-score ${band.tone === 'warn' || band.tone === 'bad' ? 'is-low' : ''}">${enriched.score}<small>分</small></span>
    </button>`
  }).join('')

  return `<section ${revealAttr(4, 'recent-card')}>
    ${sectionHead('最近日记', '', `<button type="button" class="text-btn" data-nav="diary">全部日记${icon('chevron')}</button>`).replace('section-head', 'section-head recent-head')}
    ${rows}
  </section>`
}

/* ------------------------------------------------------------------ */
/* Trends                                                             */
/* ------------------------------------------------------------------ */

function renderTrends() {
  const analysis = buildAnalytics(state.logs, state.settings, ui.trendRange)
  const action = `<button type="button" class="icon-btn" data-action="open-record" aria-label="记录睡眠">${icon('plus')}</button>`
  const header = pageHead('睡眠趋势', '看见变化，不急着改变。', action)
  const tabs = rangeTabs('trend', ui.trendRange)

  if (!analysis.stats.nights) {
    return `${header}${tabs}
      ${emptyState({
        title: '这个区间还没有记录',
        body: '睡眠趋势会在几晚之后慢慢浮现。先记下昨晚，时间的纹理就会出现。',
        actionLabel: '记录一晚',
        art: 'chart',
      })}
      <div class="page-quote"><span class="quote-mark">${icon('chart')}</span>数字不是成绩，只是你照顾自己的线索。</div>`
  }

  return `${header}${tabs}
    ${renderTrendOverview(analysis)}
    ${renderChartCard(analysis)}
    ${renderStatGrid(analysis)}
    ${renderBehaviorCard(analysis)}
    <div ${revealAttr(5, 'ai-slot')}>${renderAICard(analysis)}</div>
    ${renderAdviceCard(analysis)}
    <div class="page-quote"><span class="quote-mark">${icon('chart')}</span>数字不是成绩，只是你照顾自己的线索。</div>`
}

function renderTrendOverview(analysis) {
  const stats = analysis.stats
  const band = scoreBand(stats.avgScore)
  const change = analysis.change
  let deltaHtml = `<div class="overview-blue">共 ${stats.nights} 晚 · ${formatDateRange(analysis.bounds.start, analysis.bounds.end)}</div>`
  if (analysis.previous?.nights && change) {
    const scoreDelta = Math.round(change.score)
    const neutral = Math.abs(scoreDelta) < 1
    const down = scoreDelta < 0
    const iconName = neutral ? 'activity' : down ? 'arrowDown' : 'arrowUp'
    deltaHtml = `<div class="overview-delta ${neutral ? 'is-neutral' : down ? 'is-down' : ''}">
      ${icon(iconName)}较上期 ${neutral ? '持平' : `${down ? '' : '+'}${scoreDelta} 分`}
    </div>`
  }
  return `<section ${revealAttr(1, 'trend-overview')}>
    <div class="overview-top">
      <div>
        <div class="eyebrow">平均睡眠评分</div>
        <div class="overview-scoreline">
          <span class="overview-score" data-count="${Math.round(stats.avgScore)}">${Math.round(stats.avgScore)}</span>
          <span class="overview-unit">/ 100</span>
        </div>
        ${deltaHtml}
      </div>
      <span class="overview-band"><span class="dot"></span>${band.label}</span>
    </div>
    <div class="overview-grid">
      <div class="overview-stat">
        <span>平均睡眠</span>
        <strong>${formatDuration(stats.avgDuration)}</strong>
        <small>目标 ${formatDuration(analysis.goalMin)}</small>
      </div>
      <div class="overview-stat">
        <span>睡眠效率</span>
        <strong>${displayEfficiency(stats.avgEfficiency)}</strong>
        <small>实际睡眠 / 在床</small>
      </div>
      <div class="overview-stat">
        <span>睡眠达标率</span>
        <strong>${Math.round(stats.hitPct * 100)}<span class="overview-percent">%</span></strong>
        <small>${stats.hitGoal} / ${stats.nights} 晚 · ±5 分钟</small>
      </div>
    </div>
  </section>`
}

function renderChartCard(analysis) {
  const metric = ui.trendMetric
  const scoreMode = metric === 'score'
  const buckets = chartBuckets(analysis, metric)
  const values = buckets.map(b => b.value).filter(Number.isFinite)
  const targetLine = scoreMode ? 80 : analysis.goalMin
  const yMax = scoreMode ? 100 : Math.max(480, targetLine + 45, ...values.map(v => v + 30))
  const targetPct = clamp((targetLine / yMax) * 100, 0, 100)
  const total = buckets.length

  const bars = buckets.map((bucket, i) => {
    const value = bucket.value
    const pct = value == null ? 0 : clamp((value / yMax) * 100, 3, 100)
    const band = scoreMode && value != null ? scoreBand(value) : null
    const tone = band ? toneClass(band.tone) : ''
    const edge = total > 2 && i <= 1 ? ' tip-left' : total > 2 && i >= total - 2 ? ' tip-right' : ''
    const tipLabel = bucket.count
      ? `${bucket.fullLabel}${bucket.count > 1 ? ` · ${bucket.count} 晚` : ''}`
      : `${bucket.fullLabel} · 暂无记录`
    const label = value == null ? '暂无记录'
      : scoreMode ? `${Math.round(value)} 分` : formatDuration(value, 'long')
    let axisLabel = bucket.label
    if ((analysis.rangeKey === '1y' || analysis.rangeKey === 'all') && total > 14 && i % 2 === 1 && i !== total - 1) axisLabel = ''
    return `<button type="button" class="chart-col${edge}" style="--h:${pct}%;--i:${i}"
      data-chart-bar="${i}" aria-label="${esc(`${bucket.fullLabel}，${label}`)}">
      <span class="chart-tip"><b>${esc(value == null ? '—' : label)}</b><small>${esc(tipLabel)}</small></span>
      <span class="chart-bar ${value == null ? 'is-empty' : tone}" style="height:${value == null ? 3 : pct}%"></span>
    </button>`
  }).join('')

  const axis = buckets.map((bucket, i) => {
    let label = bucket.label
    if (analysis.rangeKey === '1m') {
      const d = parseISO(bucket.date)
      label = (i === 0 || i % 5 === 0 || i === total - 1) ? `${d.getMonth() + 1}/${d.getDate()}` : ''
    }
    if ((analysis.rangeKey === '1y' || analysis.rangeKey === 'all') && total > 14 && i % 2 === 1 && i !== total - 1) label = ''
    const today = bucket.date === todayISO() || bucket.end === todayISO()
    return `<span class="${today ? 'is-today' : ''}">${esc(label)}</span>`
  }).join('')

  return `<section ${revealAttr(2, 'chart-card')}>
    <div class="card-topline">
      <div class="card-title">
        <h2>${scoreMode ? '睡眠评分' : '睡眠时长'}</h2>
        <span>${formatDateRange(analysis.bounds.start, analysis.bounds.end)}</span>
      </div>
      <div class="metric-switch" aria-label="图表指标">
        <button type="button" class="${!scoreMode ? 'is-active' : ''}" data-trend-metric="duration" aria-pressed="${!scoreMode}">时长</button>
        <button type="button" class="${scoreMode ? 'is-active' : ''}" data-trend-metric="score" aria-pressed="${scoreMode}">评分</button>
      </div>
    </div>
    <div class="chart-area">
      <div class="chart-plot">
        <div class="chart-goal" style="bottom:${targetPct}%"><span>${scoreMode ? '80 分参考' : `目标 ${formatDuration(analysis.goalMin)}`}</span></div>
        ${bars}
        ${!analysis.stats.nights ? '<div class="chart-empty">这一段时间还没有睡眠记录</div>' : ''}
      </div>
      <div class="chart-axis">${axis}</div>
    </div>
    <div class="chart-legend">
      <span class="legend-item"><i class="legend-dot" style="background:${scoreMode ? 'var(--accent)' : 'var(--accent)'}"></i>${scoreMode ? '平均评分' : '平均睡眠'}</span>
      <span class="legend-item"><i class="legend-line"></i>${scoreMode ? '80 分参考线' : '目标时长'}</span>
      <span style="margin-left:auto">${analysis.stats.nights} 晚</span>
    </div>
  </section>`
}

function renderStatGrid(analysis) {
  const stats = analysis.stats
  const latency = stats.avgLatency == null ? '—' : `${Math.round(stats.avgLatency)}<em>分钟</em>`
  const bed = stats.avgBed == null ? '—' : formatMinutesAsClock(stats.avgBed)
  const wake = stats.avgWake == null ? '—' : formatMinutesAsClock(stats.avgWake)
  const rhythm = stats.regularity == null ? '—' : `${stats.regularity}<em>/100</em>`
  return `<div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">${icon('clock')}平均入睡耗时</div>
      <div class="stat-value">${latency}</div>
      <div class="stat-sub">理想范围 15–20 分钟</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${icon('moon')}平均上床</div>
      <div class="stat-value">${bed}</div>
      <div class="stat-sub">入睡时间的起点</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${icon('sunrise')}平均醒来</div>
      <div class="stat-value">${wake}</div>
      <div class="stat-sub">固定起床更容易坚持</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${icon('activity')}作息规律度</div>
      <div class="stat-value">${rhythm}</div>
      <div class="stat-sub">${stats.rhythmSd == null ? '记录 3 晚后显示' : `上下床波动约 ±${Math.round(stats.rhythmSd)} 分钟`}</div>
    </div>
  </div>`
}

function renderBehaviorCard(analysis) {
  const behaviors = analysis.behaviors.slice(0, 4)
  const maxAbs = Math.max(1, ...behaviors.map(b => Math.abs(b.scoreDelta)))
  const rows = behaviors.map(b => {
    const positive = b.scoreDelta >= 0
    const width = clamp((Math.abs(b.scoreDelta) / maxAbs) * 42, 4, 42)
    return `<div class="behavior-row">
      <div class="behavior-line">
        <span class="behavior-label">${esc(b.label)}<small>${b.n} 晚</small></span>
        <span class="behavior-delta ${positive ? '' : 'negative'}">${positive ? '+' : ''}${(Math.round(b.scoreDelta * 10) / 10).toFixed(1)}<span style="font-size:8px;font-weight:500;margin-left:2px;opacity:.7">分</span></span>
      </div>
      <div class="behavior-track" aria-hidden="true">
        <span class="behavior-axis"></span>
        <span class="behavior-fill ${positive ? 'pos' : 'neg'}" style="width:${width}%"></span>
      </div>
    </div>`
  }).join('')

  const empty = `<div class="behavior-empty">再记录几晚，眠屿才能把你不同的睡前习惯和评分放在一起比较。现在下结论还太早。</div>`
  return `<section ${revealAttr(4, 'behavior-card')}>
    ${sectionHead('习惯与睡眠', '描述性关联，不代表因果。')}
    <div class="behavior-list">${behaviors.length ? rows : empty}</div>
    ${behaviors.length ? `<div class="behavior-note">柱子向右代表该习惯出现的夜晚评分更高，向左则更低。样本较少时请轻松看待。</div>` : ''}
  </section>`
}

function renderAICard(analysis) {
  const config = state.settings.ai
  const configured = aiReady(config)
  const status = configured ? (config.enabled ? '已启用' : '未启用') : '未配置'
  const loading = Boolean(ui.aiLoading[analysis.rangeKey])
  const insight = ui.aiInsights[analysis.rangeKey]
  const error = ui.aiErrors[analysis.rangeKey]
  let provider = ''
  if (configured) {
    let host = ''
    try { host = new URL(config.url).hostname } catch { host = config.url }
    provider = `${host}${config.model ? ` · ${config.model}` : ''}`
  }

  let body = ''
  let actions = ''
  if (loading) {
    body = `<div class="ai-skeleton" aria-label="正在生成解读"><span></span><span></span><span></span></div>`
    actions = `<button type="button" class="btn btn-small btn-primary" disabled><span class="spinner"></span>正在解读</button>`
  } else if (insight) {
    body = `<div class="ai-body">${esc(insight.text)}</div>
      <div class="ai-meta">${icon('clock')}${insight.at ? new Date(insight.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''} 生成 · 仅发送统计与最近记录，不含备注</div>`
    actions = `<button type="button" class="btn btn-small btn-ghost" data-action="ai-analyze">${icon('rotate')}重新解读</button>`
  } else {
    const placeholder = !configured
      ? '接入你自己的 AI 接口，让这段趋势被译成更贴近生活的建议。支持 OpenAI 兼容的自定义 API，Key 只保存在本机。'
      : config.enabled
        ? '把这段时间的睡眠摘要交给你的 AI，它会从作息、行为与感受里找出值得留意的一两条线索。'
        : 'API 已经保存，但 AI 深度解读还未启用。轻触下面的按钮去打开它。'
    body = `<div class="ai-body is-placeholder">${placeholder}</div>`
    actions = `<button type="button" class="btn btn-small btn-primary" data-action="${configured && config.enabled ? 'ai-analyze' : 'open-ai'}">
      ${icon(configured && config.enabled ? 'sparkle' : 'key')}${configured && config.enabled ? '开始解读' : configured ? '去启用' : '配置 API'}
    </button>`
  }
  if (error && !loading) {
    body += `<div class="ai-error">${esc(error.message || error)}${error.detail ? `<br><span style="opacity:.75">${esc(error.detail).slice(0, 160)}</span>` : ''}</div>`
  }
  if (!actions) {
    actions = `<button type="button" class="btn btn-small btn-ghost" data-action="ai-analyze">${icon('rotate')}重新解读</button>`
  }

  return `<section class="ai-card" data-ai-card>
    <div class="ai-heading">
      <span class="ai-orb">${icon('sparkle')}</span>
      <h2>AI 睡眠解读</h2>
      <span class="ai-status">${status}</span>
    </div>
    ${loading ? `<div class="ai-body" style="margin-top:12px">${body}</div>` : body}
    <div class="ai-actions">
      ${actions}
      ${provider ? `<span class="ai-provider">${esc(provider)}</span>` : `<span class="ai-provider">自定义 API · OpenAI 兼容</span>`}
    </div>
  </section>`
}

function renderAdviceCard(analysis) {
  const suggestions = analysis.suggestions.slice(0, 3)
  const items = suggestions.map((tip, i) => `<div class="advice-item">
    <span class="advice-index">${i + 1}</span>
    <div class="advice-copy"><h3>${esc(tip.title)}</h3><p>${esc(tip.body)}</p></div>
  </div>`).join('')
  return `<section ${revealAttr(6, 'advice-card')}>
    ${sectionHead('今晚的建议', '从数据出发，不追求完美。')}
    ${items}
  </section>`
}

/* ------------------------------------------------------------------ */
/* Diary                                                              */
/* ------------------------------------------------------------------ */

function renderDiary() {
  const analysis = buildAnalytics(state.logs, state.settings, ui.diaryRange)
  const action = `<button type="button" class="icon-btn" data-action="open-record" aria-label="记录睡眠">${icon('plus')}</button>`
  const header = pageHead('睡眠日记', '一页一夜，慢慢读懂自己。', action)
  const calendar = renderDiaryCalendar()
  const tabs = rangeTabs('diary', ui.diaryRange)
  const enriched = analysis.enriched
  const visible = enriched.slice(0, ui.diaryLimit)
  const listHead = `<div class="section-head diary-list-head">
    <div><h2>睡眠记录</h2><div class="section-sub">${formatDateRange(analysis.bounds.start, analysis.bounds.end)}</div></div>
    <span class="diary-count"><strong>${enriched.length}</strong> 晚</span>
  </div>`

  if (!enriched.length) {
    return `${header}${calendar}${listHead}${tabs}
      ${emptyState({
        title: '这里还空着一页',
        body: '记下昨晚的睡眠，或切换到更长的时间范围看看。属于你的夜晚会慢慢积累起来。',
        actionLabel: '写下第一晚',
        art: 'moon',
      })}`
  }

  const groups = []
  const groupMap = new Map()
  const monthTotals = new Map()
  for (const log of enriched) {
    const key = log.date.slice(0, 7)
    monthTotals.set(key, (monthTotals.get(key) || 0) + 1)
  }
  for (const log of visible) {
    const key = log.date.slice(0, 7)
    if (!groupMap.has(key)) {
      const group = { key, logs: [] }
      groupMap.set(key, group)
      groups.push(group)
    }
    groupMap.get(key).logs.push(log)
  }

  const groupsHtml = groups.map(group => {
    const d = parseISO(`${group.key}-01`)
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    const cards = group.logs.map(log => renderDiaryCard(log)).join('')
    return `<section class="month-group">
      <div class="month-head"><span>${label}</span><i></i><small>${monthTotals.get(group.key) || group.logs.length} 晚</small></div>
      ${cards}
    </section>`
  }).join('')

  const more = enriched.length > visible.length
    ? `<button type="button" class="btn btn-ghost btn-block diary-load" data-action="load-more">加载更多 · 还有 ${enriched.length - visible.length} 晚</button>`
    : ''

  return `${header}${calendar}${listHead}${tabs}
    ${groupsHtml}
    ${more}`
}

function shiftMonthKey(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function renderDiaryCalendar() {
  const today = todayISO()
  const currentMonth = today.slice(0, 7)
  const monthKey = /^\d{4}-\d{2}$/.test(ui.calendarMonth) ? ui.calendarMonth : currentMonth
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0, 12).getDate()
  const firstDay = new Date(year, month - 1, 1, 12)
  const leading = (firstDay.getDay() + 6) % 7
  const trailing = (7 - ((leading + daysInMonth) % 7)) % 7
  const monthLogs = state.logs.filter(log => log.date.startsWith(monthKey))
  const { enriched, stats } = summarizePeriod(monthLogs, state.settings.goalMin, state.logs)
  const byDate = new Map(enriched.map(log => [log.date, log]))
  const atCurrent = monthKey >= currentMonth
  const recordCount = stats.nights
  const hitRate = recordCount ? Math.round(stats.hitPct * 100) : null
  const regularity = stats.regularity
  const monthName = `${year}年${month}月`

  const cells = []
  for (let i = 0; i < leading; i++) cells.push('<span class="cal-day is-blank" aria-hidden="true"></span>')
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${monthKey}-${String(day).padStart(2, '0')}`
    const log = byDate.get(date)
    const future = date > today
    const isToday = date === today
    if (log) {
      const band = scoreBand(log.score)
      const calTone = band.tone === 'good' ? 'cal-good' : band.tone === 'mid' ? 'cal-mid' : 'cal-low'
      cells.push(`<button type="button" class="cal-day ${calTone}${isToday ? ' is-today' : ''}"
        data-action="view-log" data-id="${esc(log.id)}"
        title="${esc(`${month}月${day}日 · ${log.score} 分 · 睡眠 ${formatDuration(log.sleepMin)}`)}"
        aria-label="${esc(`${month}月${day}日，睡眠评分 ${log.score} 分，睡眠 ${formatDuration(log.sleepMin)}`)}">
        <span class="cal-num">${day}</span>
        <span class="cal-score">${log.score}</span>
      </button>`)
    } else if (future) {
      cells.push(`<span class="cal-day is-future${isToday ? ' is-today' : ''}" aria-hidden="true"><span class="cal-num">${day}</span></span>`)
    } else {
      cells.push(`<button type="button" class="cal-day is-empty${isToday ? ' is-today' : ''}"
        data-action="open-record" data-date="${date}"
        title="${esc(`${month}月${day}日 · 没有记录，点按补记`)}"
        aria-label="${esc(`${month}月${day}日，没有记录，点按补记`)}">
        <span class="cal-num">${day}</span>
      </button>`)
    }
  }
  for (let i = 0; i < trailing; i++) cells.push('<span class="cal-day is-blank" aria-hidden="true"></span>')

  return `<section ${revealAttr(1, 'calendar-card')}>
    <div class="calendar-head">
      <div>
        <div class="eyebrow">MONTHLY RHYTHM</div>
        <h2>睡眠月历</h2>
      </div>
      <div class="calendar-nav">
        <button type="button" class="calendar-arrow" data-action="calendar-prev" aria-label="上个月">${icon('chevronLeft')}</button>
        <span class="calendar-month">${monthName}</span>
        <button type="button" class="calendar-arrow" data-action="calendar-next" aria-label="下个月" ${atCurrent ? 'disabled' : ''}>${icon('chevron')}</button>
      </div>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">
      <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
    </div>
    <div class="calendar-grid" role="group" aria-label="${monthName}睡眠日历">${cells.join('')}</div>
    <div class="calendar-legend">
      <span><i class="cal-swatch cal-good"></i>不错</span>
      <span><i class="cal-swatch cal-mid"></i>一般</span>
      <span><i class="cal-swatch cal-low"></i>偏低</span>
      <span><i class="cal-swatch is-empty"></i>未记录</span>
      <span class="calendar-legend-note">颜色来自当晚评分</span>
    </div>
    ${monthKey !== currentMonth ? `<button type="button" class="text-btn calendar-today-btn" data-action="calendar-today">${icon('calendar')}回到本月</button>` : ''}
    <div class="calendar-stats">
      <div class="calendar-stat">
        <span>规律度</span>
        <strong>${regularity == null ? '—' : regularity}<small>${regularity == null ? '' : '/100'}</small></strong>
        <em>${regularity == null ? '满 3 晚后显示' : `波动约 ±${Math.round(stats.rhythmSd)} 分钟`}</em>
      </div>
      <div class="calendar-stat">
        <span>睡眠达标率</span>
        <strong>${hitRate == null ? '—' : hitRate}<small>${hitRate == null ? '' : '%'}</small></strong>
        <em>${recordCount ? `${stats.hitGoal}/${recordCount} 晚 · 目标 ${formatDuration(state.settings.goalMin)}` : '本月暂无记录'}</em>
      </div>
      <div class="calendar-stat">
        <span>平均评分</span>
        <strong>${stats.avgScore == null ? '—' : Math.round(stats.avgScore)}<small>${stats.avgScore == null ? '' : '/100'}</small></strong>
        <em>${recordCount ? `${recordCount} 晚记录` : '本月暂无记录'}</em>
      </div>
    </div>
  </section>`
}

function renderDiaryCard(log) {
  const d = parseISO(log.date)
  const band = scoreBand(log.score)
  const tags = log.pre.slice(0, 2).map(id => {
    const tag = TAG_MAP[id]
    return `<span class="log-tag">${tagIcon(id)}${esc(tag?.label || id)}</span>`
  }).join('')
  const moreTags = log.pre.length > 2 ? `<span class="log-tag muted-tag">+${log.pre.length - 2}</span>` : ''
  const custom = log.customDuration ? '<span class="log-tag">自定义时长</span>' : ''
  return `<button type="button" class="log-card" data-action="view-log" data-id="${esc(log.id)}"
    aria-label="${esc(`${formatDateCN(log.date)}，睡眠 ${formatDuration(log.sleepMin)}，评分 ${log.score}`)}">
    <span class="log-day">
      <strong>${d.getDate()}</strong>
      <span>${d.getMonth() + 1}月 · ${weekdayCN(log.date).replace('周', '周')}</span>
    </span>
    <span class="log-main">
      <span class="log-topline">
        <span class="log-duration">${formatDuration(log.sleepMin)}</span>
        <span class="log-range">${log.bed} – ${log.wake}</span>
      </span>
      <span class="log-tags">${tags || '<span class="log-tag muted-tag">没有记录习惯</span>'}${moreTags}${custom}</span>
      <span class="log-feel">${faceSVG(log.feel)}${FEELINGS.find(f => f.v === log.feel)?.label || ''} · 入睡 ${log.latency} 分 · ${log.wakeups ? `夜醒 ${log.wakeups} 次` : '未夜醒'}</span>
    </span>
    <span class="log-side">
      <span class="score-chip ${toneClass(band.tone)}">${log.score}<small>分</small></span>
      ${icon('chevron')}
    </span>
  </button>`
}

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

function skinPreview(skin) {
  if (skin.id === 'custom') {
    const vars = customSurfaceColors(state.settings.customBg)
    return { bg: state.settings.customBg, surface: vars['--custom-surface'], ink: vars['--custom-ink'] }
  }
  return { bg: skin.bg, surface: skin.surface, ink: skin.ink }
}

function renderSkinTile(skin) {
  const selected = state.settings.skin === skin.id
  const visual = skinPreview(skin)
  return `<button type="button" class="skin-tile${selected ? ' is-selected' : ''}" data-action="set-skin" data-skin-id="${skin.id}" aria-pressed="${selected}">
    <span class="skin-swatch" style="background:${visual.bg}">
      <span class="skin-mock" style="background:${visual.surface};color:${visual.ink}">
        <i style="background:${visual.ink}"></i><i style="background:${visual.ink}"></i><i style="background:${visual.ink}"></i>
        <span class="skin-mock-dot" style="background:${state.settings.accent}"></span>
      </span>
      <span class="skin-check">${icon('check')}</span>
    </span>
    <span class="skin-name">${skin.name}</span>
  </button>`
}

function renderSettings() {
  const logs = state.logs
  const demoCount = countDemoLogs(state)
  const oldest = logs.length ? logs.reduce((a, b) => a.date < b.date ? a : b).date : null
  const oldestDate = oldest ? parseISO(oldest) : null
  const oldestLabel = oldestDate
    ? `${oldestDate.getFullYear() !== new Date().getFullYear() ? `${oldestDate.getFullYear()}年` : ''}${oldestDate.getMonth() + 1}月${oldestDate.getDate()}日`
    : ''
  const ai = state.settings.ai
  const status = aiStatus(ai)
  let aiDetail = '使用你自己的 OpenAI 兼容接口'
  if (aiReady(ai)) {
    let host = ai.url
    try { host = new URL(ai.url).hostname } catch { /* keep */ }
    aiDetail = `${host}${ai.model ? ` · ${ai.model}` : ''}`
  }

  const skinTiles = SKINS.map(renderSkinTile).join('')
  const accents = ACCENTS.map(item => `<button type="button"
    class="accent-swatch${state.settings.accent.toLowerCase() === item.value.toLowerCase() ? ' is-selected' : ''}"
    style="background:${item.value}" data-action="set-accent" data-accent="${item.value}"
    aria-label="${item.name}" aria-pressed="${state.settings.accent.toLowerCase() === item.value.toLowerCase()}"></button>`).join('')
  const isCustomAccent = !ACCENTS.some(item => item.value.toLowerCase() === state.settings.accent.toLowerCase())

  const customBg = state.settings.skin === 'custom'
    ? `<div class="custom-bg-row">
        <span>自定义底色</span>
        <label class="mini-color" style="background:${state.settings.customBg}" aria-label="自定义底色">
          <input type="color" value="${state.settings.customBg}" data-custom-bg>
        </label>
      </div>`
    : ''

  return `${pageHead('设置', '让眠屿更像你，也更安静。')}
    <div class="settings-stack">
      <section ${revealAttr(1, 'settings-card profile-card')}>
        <div class="profile-avatar">${esc(initial())}</div>
        <div class="profile-main">
          <label class="profile-name-row">
            <input class="profile-name-input" id="nickname-input" maxlength="20" value="${esc(nickname())}" aria-label="昵称" autocomplete="off" spellcheck="false">
            <span class="profile-name-edit">${icon('edit')}</span>
          </label>
          <div class="profile-sub">${logs.length ? `已记录 ${logs.length} 晚 · 从 ${oldestLabel} 开始` : '还没有睡眠记录'}</div>
        </div>
        <span class="pill"><span class="dot" style="background:var(--accent)"></span>本机</span>
      </section>

      <section ${revealAttr(2, 'settings-card')}>
        <div class="card-heading"><div><h2>外观</h2><p>皮肤、色彩与排版，轻触即生效。</p></div></div>
        <div class="skin-scroller" aria-label="皮肤">${skinTiles}</div>
        <div class="accent-label">强调色</div>
        <div class="accent-row">
          ${accents}
          <label class="accent-custom${isCustomAccent ? ' is-selected' : ''}" style="background:${state.settings.accent};color:${contrastOn(state.settings.accent)}" aria-label="自定义强调色">
            <input type="color" value="${state.settings.accent}" data-accent-custom>
            <span>+</span>
          </label>
        </div>
        ${customBg}
        <div class="layout-options" style="margin-top:12px">
          <div class="layout-row">
            <span>疏密</span>
            <div class="segmented">
              <button type="button" class="${state.settings.density === 'comfortable' ? 'is-active' : ''}" data-action="set-density" data-value="comfortable">舒适</button>
              <button type="button" class="${state.settings.density === 'compact' ? 'is-active' : ''}" data-action="set-density" data-value="compact">紧凑</button>
            </div>
          </div>
          <div class="layout-row">
            <span>圆角</span>
            <div class="segmented">
              <button type="button" class="${state.settings.corners === 'soft' ? 'is-active' : ''}" data-action="set-corners" data-value="soft">柔和</button>
              <button type="button" class="${state.settings.corners === 'sharp' ? 'is-active' : ''}" data-action="set-corners" data-value="sharp">利落</button>
            </div>
          </div>
          <div class="layout-row">
            <span>首页顺序</span>
            <div class="segmented">
              <button type="button" class="${state.settings.homeOrder === 'score' ? 'is-active' : ''}" data-action="set-home-order" data-value="score">评分优先</button>
              <button type="button" class="${state.settings.homeOrder === 'advice' ? 'is-active' : ''}" data-action="set-home-order" data-value="advice">建议优先</button>
            </div>
          </div>
          <div class="layout-row">
            <span>流畅动效</span>
            <label class="switch">
              <input type="checkbox" data-setting="motion" ${state.settings.motion ? 'checked' : ''} aria-label="流畅动效">
              <span class="switch-track"></span>
            </label>
          </div>
        </div>
      </section>

      <section ${revealAttr(3, 'settings-card')}>
        <div class="card-heading"><div><h2>睡眠计划</h2><p>目标会参与每晚评分和达标判断。</p></div></div>
        <div class="goal-panel">
          <div>
            <div class="goal-number">${Math.floor(state.settings.goalMin / 60)}<small>h</small> ${String(state.settings.goalMin % 60).padStart(2, '0')}<small>m</small></div>
            <div class="goal-caption">每晚目标睡眠时长</div>
          </div>
          <div class="stepper">
            <button type="button" data-action="goal-dec" aria-label="减少 15 分钟">−</button>
            <span>每次 15 分</span>
            <button type="button" data-action="goal-inc" aria-label="增加 15 分钟">+</button>
          </div>
        </div>
      </section>

      <section ${revealAttr(4, 'settings-card')}>
        <div class="card-heading"><div><h2>AI 深度解读</h2><p>接入你自己的 API，让数据变成更具体的建议。</p></div></div>
        <button type="button" class="ai-summary-row" data-action="open-ai">
          <span class="ai-summary-icon">${icon('sparkle')}</span>
          <span class="ai-summary-main"><strong>${status.ready ? '自定义 AI 接口' : '连接你的 AI'}</strong><span>${esc(aiDetail)}</span></span>
          <span class="pill"><span class="dot" style="background:${status.ready && ai.enabled ? 'var(--ok)' : 'var(--muted)'}"></span>${status.label}</span>
          ${icon('chevron', 'chev')}
        </button>
      </section>

      <section ${revealAttr(5, 'settings-card')}>
        <div class="card-heading"><div><h2>数据</h2><p>所有内容只保存在这台设备的浏览器里。</p></div></div>
        <div class="data-actions">
          <button type="button" class="data-btn" data-action="export-data">${icon('download')}导出备份</button>
          <button type="button" class="data-btn" data-action="import-data">${icon('upload')}导入备份</button>
        </div>
        ${demoCount ? `<div class="setting-row">
          <div class="setting-row-label"><strong>示例数据</strong><span>${demoCount} 晚，用于预览图表</span></div>
          <button type="button" class="text-btn" data-action="clear-demo">清空示例</button>
        </div>` : ''}
        <div class="setting-row">
          <div class="setting-row-label"><strong>全部睡眠记录</strong><span>${logs.length} 晚 · 删除后无法恢复</span></div>
          <button type="button" class="text-btn danger" data-action="clear-all">清空</button>
        </div>
        ${!logs.length ? `<div class="setting-row">
          <div class="setting-row-label"><strong>暂无记录</strong><span>载入一组示例，先看看完整的样子</span></div>
          <button type="button" class="text-btn" data-action="restore-demo">载入示例</button>
        </div>` : ''}
        <div class="ai-hint" style="margin-top:9px">导出的备份不包含 API Key。换设备时，请在新设备重新填写 AI 配置。</div>
      </section>

      <section ${revealAttr(6, 'settings-card')}>
        <div class="card-heading"><div><h2>关于眠屿</h2><p>一个只属于自己的、安静的睡眠角落。</p></div></div>
        <div class="about-line"><span>版本</span><strong>${APP_VERSION} · ${isNativeApp() ? '安卓版' : '网页版'}</strong></div>
        <div class="about-line"><span>存储</span><strong>本机 localStorage</strong></div>
        <div class="about-line"><span>网络</span><strong>仅在你使用 AI 时连接自定义 API</strong></div>
      </section>

      <div class="settings-footer">
        <strong>眠屿 ${APP_NAME === '眠屿' ? '' : APP_NAME}</strong><br>
        睡不好不是你的错。先记录，再慢慢靠近。
      </div>
    </div>`
}


/* ------------------------------------------------------------------ */
/* Event wiring                                                       */
/* ------------------------------------------------------------------ */

function bindGlobalEvents() {
  document.addEventListener('click', handleGlobalClick)
  document.addEventListener('input', handleInput)
  document.addEventListener('change', handleChange)
  document.addEventListener('keydown', focusTrap)
  importFile.addEventListener('change', handleImportFile)
}

function handleGlobalClick(event) {
  const bar = event.target.closest('[data-chart-bar]')
  if (bar) {
    const wasActive = bar.classList.contains('is-peek')
    $$('.chart-col.is-peek').forEach(el => el.classList.remove('is-peek'))
    if (!wasActive) {
      bar.classList.add('is-peek')
      haptic(4)
    }
    return
  }
  $$('.chart-col.is-peek').forEach(el => el.classList.remove('is-peek'))

  const navEl = event.target.closest('[data-nav]')
  if (navEl) {
    event.preventDefault()
    navigate(navEl.dataset.nav)
    return
  }

  const rangeEl = event.target.closest('[data-range]')
  if (rangeEl) {
    event.preventDefault()
    const scope = rangeEl.dataset.rangeScope
    const value = rangeEl.dataset.range
    if (scope === 'diary') {
      ui.diaryRange = value
      ui.diaryLimit = 14
      render({ animate: true, preserveScroll: true })
    } else {
      ui.trendRange = value
      render({ animate: true, preserveScroll: true })
    }
    haptic(5)
    return
  }

  const metricEl = event.target.closest('[data-trend-metric]')
  if (metricEl) {
    event.preventDefault()
    ui.trendMetric = metricEl.dataset.trendMetric
    render({ animate: false, preserveScroll: true })
    return
  }

  const actionEl = event.target.closest('[data-action]')
  if (!actionEl) return
  event.preventDefault()
  handleAction(actionEl.dataset.action, actionEl, event)
}

function handleInput(event) {
  const target = event.target
  if (target.matches('[data-accent-custom]')) {
    state.settings.accent = target.value
    saveState(state)
    applyAppearance(false)
    syncAccentPicker(target.value)
    return
  }
  if (target.matches('[data-custom-bg]') && state.settings.skin === 'custom') {
    state.settings.customBg = target.value
    saveState(state)
    applyAppearance(false)
    syncCustomBackground(target.value)
    return
  }
  if (!ui.form) return
  const id = target.id
  if (!['record-date', 'record-bed', 'record-wake', 'record-latency', 'record-custom-h', 'record-custom-m', 'record-note'].includes(id)) return

  if (id === 'record-date') {
    ui.form.date = target.value || ui.form.date
    refreshDateHint()
  } else if (id === 'record-bed') {
    ui.form.bed = target.value
  } else if (id === 'record-wake') {
    ui.form.wake = target.value
  } else if (id === 'record-latency') {
    ui.form.latency = Number(target.value) || 0
  } else if (id === 'record-custom-h') {
    ui.form.customH = target.value
  } else if (id === 'record-custom-m') {
    ui.form.customM = target.value
  } else if (id === 'record-note') {
    ui.form.note = target.value
    const counter = $('#note-count')
    if (counter) counter.textContent = `${target.value.length}/160`
    return
  }
  updateRecordPreview()
}

function handleChange(event) {
  const target = event.target
  if (target.id === 'record-custom-toggle' && ui.form) {
    ui.form.useCustom = target.checked
    const row = $('#custom-duration')
    row?.classList.toggle('is-hidden', !target.checked)
    if (target.checked) {
      const preview = recordPreview(ui.form)
      const currentH = $('#record-custom-h')
      const currentM = $('#record-custom-m')
      if (currentH && currentM && (!Number(currentH.value) && !Number(currentM.value))) {
        currentH.value = String(Math.floor(preview.sleepMin / 60))
        currentM.value = String(preview.sleepMin % 60)
        ui.form.customH = currentH.value
        ui.form.customM = currentM.value
      }
    }
    updateRecordPreview()
    return
  }
  if (target.matches('[data-setting="motion"]')) {
    state.settings.motion = target.checked
    saveState(state)
    applyAppearance(false)
    return
  }
  if (target.id === 'nickname-input') {
    const value = target.value.trim().slice(0, 20) || '小眠'
    state.settings.nickname = value
    target.value = value
    saveState(state)
    const avatar = $('.profile-avatar')
    if (avatar) avatar.textContent = initial(value)
    showToast('昵称已更新')
    return
  }
  if (target.id === 'record-date' && ui.form) {
    ui.form.date = target.value || ui.form.date
    refreshDateHint()
    updateRecordPreview()
    return
  }
  if (target.closest('#ai-form')) {
    const result = $('#ai-test-result')
    if (result) {
      result.textContent = ''
      result.className = 'ai-test-result'
    }
  }
}

function syncAccentPicker(value) {
  const custom = $('.accent-custom')
  if (custom) {
    custom.style.background = value
    custom.style.color = contrastOn(value)
    custom.classList.add('is-selected')
  }
  $$('.accent-swatch').forEach(el => el.classList.remove('is-selected'))
}

function syncCustomBackground(value) {
  const vars = customSurfaceColors(value)
  const tile = $('.skin-tile[data-skin-id="custom"] .skin-swatch')
  if (tile) tile.style.background = value
  const mock = $('.skin-tile[data-skin-id="custom"] .skin-mock')
  if (mock) {
    mock.style.background = vars['--custom-surface']
    mock.style.color = vars['--custom-ink']
  }
  const input = $('.custom-bg-row .mini-color')
  if (input) input.style.background = value
}

/* ------------------------------------------------------------------ */
/* Actions                                                           */
/* ------------------------------------------------------------------ */

function handleAction(action, el) {
  switch (action) {
    case 'open-record':
      openRecordSheet({ date: el.dataset.date || null })
      break
    case 'edit-log':
      if (el.dataset.id) openRecordSheet({ id: el.dataset.id })
      break
    case 'view-log':
      if (el.dataset.id) openDetailSheet(el.dataset.id)
      break
    case 'close-sheet':
      closeSheet()
      break
    case 'confirm-yes': {
      const confirm = ui.confirm
      ui.confirm = null
      closeSheet()
      if (confirm?.action) {
        setTimeout(() => {
          try { confirm.action() } catch (error) {
            console.error(error)
            showToast('操作没有完成，请再试一次', 'error')
          }
        }, 28)
      }
      break
    }
    case 'save-log':
      saveRecordSheet()
      break
    case 'set-feel':
      setFeel(Number(el.dataset.feel))
      break
    case 'toggle-tag':
      toggleTag(el.dataset.tag)
      break
    case 'latency-preset':
      setLatencyPreset(Number(el.dataset.latency))
      break
    case 'request-delete':
      confirmDeleteLog(el.dataset.id)
      break
    case 'open-ai':
      openAISheet()
      break
    case 'save-ai':
      saveAISettings()
      break
    case 'test-ai':
      runAITest()
      break
    case 'toggle-secret':
      toggleAISecret(el)
      break
    case 'ai-analyze':
      runAIAnalysis()
      break
    case 'goal-dec':
      changeGoal(-15)
      break
    case 'goal-inc':
      changeGoal(15)
      break
    case 'set-skin':
      setSkin(el.dataset.skinId)
      break
    case 'set-accent':
      setAccent(el.dataset.accent)
      break
    case 'set-density':
      setLayout('density', el.dataset.value)
      break
    case 'set-corners':
      setLayout('corners', el.dataset.value)
      break
    case 'set-home-order':
      setLayout('homeOrder', el.dataset.value)
      break
    case 'load-more':
      ui.diaryLimit += 14
      render({ animate: false, preserveScroll: true })
      break
    case 'calendar-prev':
      ui.calendarMonth = shiftMonthKey(ui.calendarMonth, -1)
      render({ animate: false, preserveScroll: true })
      break
    case 'calendar-next': {
      const nextMonth = shiftMonthKey(ui.calendarMonth, 1)
      if (nextMonth <= todayISO().slice(0, 7)) {
        ui.calendarMonth = nextMonth
        render({ animate: false, preserveScroll: true })
      }
      break
    }
    case 'calendar-today':
      ui.calendarMonth = todayISO().slice(0, 7)
      render({ animate: false, preserveScroll: true })
      break
    case 'wakeups-dec':
      adjustWakeups(-1)
      break
    case 'wakeups-inc':
      adjustWakeups(1)
      break
    case 'form-goal-dec':
      adjustFormGoal(-15)
      break
    case 'form-goal-inc':
      adjustFormGoal(15)
      break
    case 'export-data':
      exportData()
      break
    case 'import-data':
      importData()
      break
    case 'clear-demo':
      confirmClearDemo()
      break
    case 'clear-all':
      confirmClearAll()
      break
    case 'restore-demo':
      restoreDemoData(state)
      invalidateAI()
      render({ animate: false, preserveScroll: true })
      showToast('示例数据已载入', 'info')
      break
    default:
      break
  }
}

function changeGoal(delta) {
  const next = clamp(state.settings.goalMin + delta, 240, 720)
  if (next === state.settings.goalMin) return
  state.settings.goalMin = next
  saveState(state)
  haptic(5)
  render({ animate: false, preserveScroll: true })
}

function setSkin(skinId) {
  const skin = SKINS.find(s => s.id === skinId)
  if (!skin || state.settings.skin === skinId) return
  state.settings.skin = skinId
  saveState(state)
  applyAppearance(true)
  render({ animate: false, preserveScroll: true })
  haptic(6)
}

function setAccent(value) {
  if (!/^#[0-9a-f]{6}$/i.test(value) || state.settings.accent === value) return
  state.settings.accent = value
  saveState(state)
  applyAppearance(true)
  render({ animate: false, preserveScroll: true })
  haptic(6)
}

function setLayout(key, value) {
  const allowed = {
    density: ['comfortable', 'compact'],
    corners: ['soft', 'sharp'],
    homeOrder: ['score', 'advice'],
  }
  if (!allowed[key]?.includes(value) || state.settings[key] === value) return
  state.settings[key] = value
  saveState(state)
  applyAppearance(false)
  render({ animate: false, preserveScroll: true })
  haptic(5)
}

/* ------------------------------------------------------------------ */
/* Record sheet                                                       */
/* ------------------------------------------------------------------ */

function recentRecordDefaults() {
  const today = todayISO()
  const recent = [...state.logs]
    .filter(log => log.date <= today && diffDays(today, log.date) <= 14)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return {
    bed: recent?.bed || '23:00',
    wake: recent?.wake || '07:00',
    latency: recent?.latency ?? 15,
  }
}

function openRecordSheet({ id = null, date = null } = {}) {
  const today = todayISO()
  let log = id ? state.logs.find(item => item.id === id) : null
  if (!log && date) log = state.logs.find(item => item.date === date)
  if (!log && !date) log = state.logs.find(item => item.date === today)
  const defaults = recentRecordDefaults()

  let form
  if (log) {
    const windowMin = durationBetweenSafe(log.bed, log.wake)
    const autoSleep = Math.max(0, windowMin - clamp(Number(log.latency) || 0, 0, Math.max(0, windowMin - 1)))
    const duration = Number(log.durationMin) > 0 ? Number(log.durationMin) : autoSleep
    form = {
      id: log.id,
      date: log.date,
      bed: log.bed,
      wake: log.wake,
      latency: log.latency,
      wakeups: clamp(Math.round(Number(log.wakeups) || 0), 0, 20),
      feel: log.feel,
      pre: [...log.pre],
      note: log.note || '',
      useCustom: Number(log.durationMin) > 0,
      customH: String(Math.floor(duration / 60)),
      customM: String(duration % 60),
      goalMin: state.settings.goalMin,
    }
  } else {
    const chosenDate = date || today
    const windowMin = durationBetweenSafe(defaults.bed, defaults.wake)
    const autoSleep = Math.max(0, windowMin - defaults.latency)
    form = {
      id: null,
      date: chosenDate,
      bed: defaults.bed,
      wake: defaults.wake,
      latency: defaults.latency,
      wakeups: 0,
      feel: 3,
      pre: [],
      note: '',
      useCustom: false,
      customH: String(Math.floor(autoSleep / 60)),
      customM: String(autoSleep % 60),
      goalMin: state.settings.goalMin,
    }
  }
  ui.form = form
  mountSheet(recordSheetHTML(), '.sheet')
  refreshDateHint()
  requestAnimationFrame(updateRecordPreview)
}

function durationBetweenSafe(bed, wake) {
  const b = timeToMin(bed)
  const w = timeToMin(wake)
  if (b == null || w == null) return 0
  let value = w - b
  if (value <= 0) value += 1440
  return value
}

function recordPreview(form) {
  const windowMin = durationBetweenSafe(form.bed, form.wake)
  const latency = clamp(Math.round(Number(form.latency) || 0), 0, Math.max(0, windowMin - 1))
  const customMin = form.useCustom
    ? Math.round((Number(form.customH) || 0) * 60 + (Number(form.customM) || 0))
    : null
  const goalMin = clamp(Math.round(Number(form.goalMin) || state.settings.goalMin), 240, 720)
  const log = {
    date: form.date,
    bed: form.bed,
    wake: form.wake,
    latency,
    durationMin: Number(customMin) > 0 ? customMin : null,
    wakeups: clamp(Math.round(Number(form.wakeups) || 0), 0, 20),
    feel: form.feel,
    pre: form.pre,
    note: form.note,
  }
  return { ...enrichLog(log, state.logs, goalMin), windowMin, customMin, goalMin }
}

function recordSheetHTML() {
  const form = ui.form
  const preview = recordPreview(form)
  const band = preview.band
  const editing = Boolean(form.id)
  const latency = clamp(Number(form.latency) || 0, 0, 120)
  const customMin = (Number(form.customH) || 0) * 60 + (Number(form.customM) || 0)
  const noteLength = String(form.note || '').length
  const quick = [0, 10, 20, 30, 45, 60]
  const goalMin = clamp(Math.round(Number(form.goalMin) || state.settings.goalMin), 240, 720)
  const wakeups = clamp(Math.round(Number(form.wakeups) || 0), 0, 15)

  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="record-title">
    <div class="sheet-grip"></div>
    <div class="sheet-head">
      <h2 id="record-title">${editing ? '编辑这一晚' : '记录睡眠'}</h2>
      <button type="button" class="sheet-close" data-action="close-sheet" aria-label="关闭">${icon('close')}</button>
    </div>

    <div class="record-preview">
      ${previewRing(preview.score)}
      <div class="preview-copy">
        <strong id="live-preview-copy">这一晚，${band.label}</strong>
        <span id="live-preview-sub">实际睡眠 ${formatDuration(preview.sleepMin)} · 效率 ${displayEfficiency(preview.efficiency)}</span>
      </div>
      <span class="preview-band" id="live-preview-band">${form.useCustom ? '自定义' : '自动计算'}</span>
    </div>

    <div class="record-date-row">
      <label class="date-field">${icon('calendar')}
        <input id="record-date" type="date" value="${esc(form.date)}" max="${todayISO()}" aria-label="记录日期">
      </label>
      <span class="record-existing" id="record-existing">${editing ? '正在编辑' : ''}</span>
    </div>

    <div class="sheet-scroll">
      <section class="form-section">
        <div class="form-section-head">
          <span class="form-section-title">${icon('moon')}睡眠时段</span>
          <span class="small">日期以醒来那天为准</span>
        </div>
        <div class="time-grid">
          <label class="time-box">
            <span class="time-box-label">${icon('moon')}上床时间</span>
            <input id="record-bed" type="time" value="${esc(form.bed)}" aria-label="上床时间">
          </label>
          <label class="time-box">
            <span class="time-box-label">${icon('sunrise')}醒来时间</span>
            <input id="record-wake" type="time" value="${esc(form.wake)}" aria-label="醒来时间">
          </label>
        </div>

        <div class="duration-strip">
          <div class="duration-strip-label">实际睡眠
            <strong id="live-duration">${formatDuration(preview.sleepMin)}</strong>
            <span id="live-window">在床 ${formatDuration(preview.windowMin)}</span>
          </div>
          <label class="inline-switch">
            <span>自定义时长</span>
            <span class="switch">
              <input type="checkbox" id="record-custom-toggle" ${form.useCustom ? 'checked' : ''} aria-label="自定义睡眠时长">
              <span class="switch-track"></span>
            </span>
          </label>
        </div>
        <div class="custom-duration${form.useCustom ? '' : ' is-hidden'}" id="custom-duration">
          <input class="duration-input" id="record-custom-h" type="number" min="0" max="16" inputmode="numeric" value="${esc(form.customH)}" aria-label="自定义小时">
          <span>小时</span>
          <input class="duration-input" id="record-custom-m" type="number" min="0" max="59" inputmode="numeric" value="${esc(form.customM)}" aria-label="自定义分钟">
          <span>分钟</span>
          <span style="margin-left:auto" id="custom-duration-label">${customMin > 0 ? `共 ${formatDuration(customMin)}` : '等待填写'}</span>
        </div>

        <div class="record-goal-row">
          <div class="record-goal-copy">
            ${icon('target')}
            <div><span>睡眠目标</span><small>保存后同步到全站评分</small></div>
          </div>
          <div class="goal-mini-stepper">
            <button type="button" data-action="form-goal-dec" aria-label="减少目标 15 分钟" ${goalMin <= 240 ? 'disabled' : ''}>−</button>
            <strong id="form-goal-value">${formatDuration(goalMin)}</strong>
            <button type="button" data-action="form-goal-inc" aria-label="增加目标 15 分钟" ${goalMin >= 720 ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </section>

      <section class="form-section">
        <div class="form-section-head">
          <span class="form-section-title">${icon('activity')}夜间醒来</span>
          <span class="small">醒来后再入睡也算一次</span>
        </div>
        <div class="wakeups-box">
          <div class="wakeups-copy">
            <strong><span id="wakeups-readout">${wakeups}</span><small>次</small></strong>
            <span id="wakeups-desc">${wakeups === 0 ? '一觉到天亮' : '夜间醒来的次数'}</span>
          </div>
          <div class="wakeups-stepper">
            <button type="button" data-action="wakeups-dec" id="wakeups-dec" aria-label="减少夜醒次数" ${wakeups <= 0 ? 'disabled' : ''}>−</button>
            <button type="button" data-action="wakeups-inc" id="wakeups-inc" aria-label="增加夜醒次数" ${wakeups >= 15 ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="ai-hint" style="margin-top:8px">夜醒次数会一起参与「连续睡眠」评分。</div>
      </section>

      <section class="form-section">
        <div class="form-section-head">
          <span class="form-section-title">${icon('clock')}入睡用时</span>
          <span class="latency-value"><span id="latency-readout">${form.latency}</span><small>分钟</small></span>
        </div>
        <input class="range-input" type="range" id="record-latency" min="0" max="120" step="1"
          value="${latency}" style="--pct:${(latency / 120) * 100}%" aria-label="入睡所需时间">
        <div class="range-ticks"><span>0</span><span>30</span><span>60</span><span>90</span><span>120 分钟</span></div>
        <div class="quick-chips">
          ${quick.map(value => `<button type="button" class="quick-chip${Number(form.latency) === value ? ' is-active' : ''}" data-action="latency-preset" data-latency="${value}">${value === 0 ? '沾枕就着' : value === 60 ? '60+' : `${value} 分`}</button>`).join('')}
        </div>
      </section>

      <section class="form-section">
        <div class="form-section-head">
          <span class="form-section-title">${icon('sun')}醒来感受</span>
          <span class="small">此刻的身体会说话</span>
        </div>
        <div class="feel-grid">
          ${FEELINGS.map(item => `<button type="button" class="feel-btn${form.feel === item.v ? ' is-selected' : ''}" data-action="set-feel" data-feel="${item.v}" aria-pressed="${form.feel === item.v}" aria-label="${item.label}">
            ${faceSVG(item.v)}<span>${item.label}</span>
          </button>`).join('')}
        </div>
        <div class="feel-phrase" id="feel-phrase">${FEELINGS.find(item => item.v === form.feel)?.label} · ${FEELINGS.find(item => item.v === form.feel)?.phrase}</div>
      </section>

      <section class="form-section">
        <div class="form-section-head">
          <span class="form-section-title">${icon('sparkle')}睡前行为</span>
          <span class="small">可以多选</span>
        </div>
        <div class="tag-grid">
          ${TAGS.map(tag => `<button type="button" class="tag-btn${form.pre.includes(tag.id) ? ' is-selected' : ''}" data-action="toggle-tag" data-tag="${tag.id}" aria-pressed="${form.pre.includes(tag.id)}" title="${esc(tag.hint)}">
            ${tagIcon(tag.id)}${tag.label}
          </button>`).join('')}
        </div>
      </section>

      <section class="form-section" style="padding-bottom:18px">
        <div class="form-section-head">
          <span class="form-section-title">${icon('edit')}留一句话</span>
          <span class="small">可选，只给自己看</span>
        </div>
        <textarea class="note-field" id="record-note" maxlength="160" placeholder="今晚有什么想记下的？">${esc(form.note)}</textarea>
        <div class="form-note-count" id="note-count">${noteLength}/160</div>
      </section>
    </div>

    <div class="sheet-footer">
      <div class="form-error" id="record-error"></div>
      <button type="button" class="btn btn-primary" data-action="save-log">${icon('check')}${editing ? '保存修改' : '保存这一晚'}</button>
    </div>
  </section>`
}

function refreshDateHint() {
  const hint = $('#record-existing')
  if (!hint || !ui.form) return
  const clash = state.logs.find(log => log.date === ui.form.date && log.id !== ui.form.id)
  if (clash) {
    hint.textContent = '该日已有记录'
    hint.classList.add('is-warning')
  } else if (ui.form.id && state.logs.some(log => log.id === ui.form.id)) {
    hint.textContent = '正在编辑'
    hint.classList.remove('is-warning')
  } else {
    hint.textContent = ''
    hint.classList.remove('is-warning')
  }
}

function updateRecordPreview() {
  if (!ui.form || !isSheetOpen()) return
  const form = ui.form
  const preview = recordPreview(form)
  const band = preview.band
  const valid = preview.windowMin > 0 && preview.windowMin <= 960

  const ring = $('#preview-ring-value')
  if (ring) {
    const circumference = 2 * Math.PI * 23
    ring.style.strokeDashoffset = String(circumference * (1 - clamp(preview.score, 0, 100) / 100))
  }
  const scoreEl = $('#preview-score')
  if (scoreEl) scoreEl.textContent = String(preview.score)
  const copy = $('#live-preview-copy')
  if (copy) copy.textContent = valid ? `这一晚，${band.label}` : '等一个完整的时间'
  const sub = $('#live-preview-sub')
  if (sub) sub.textContent = valid
    ? `实际睡眠 ${formatDuration(preview.sleepMin)} · 效率 ${displayEfficiency(preview.efficiency)}`
    : '上床与醒来之间，应该隔着一段夜晚'
  const badge = $('#live-preview-band')
  if (badge) badge.textContent = form.useCustom ? '自定义' : '自动计算'
  const customLabel = $('#custom-duration-label')
  if (customLabel) {
    const total = (Number(form.customH) || 0) * 60 + (Number(form.customM) || 0)
    customLabel.textContent = form.useCustom
      ? (total > 0 ? `共 ${formatDuration(total)}` : '等待填写')
      : ''
  }
  const duration = $('#live-duration')
  if (duration) duration.textContent = valid ? formatDuration(preview.sleepMin) : '—'
  const windowLabel = $('#live-window')
  if (windowLabel) windowLabel.textContent = valid ? `在床 ${formatDuration(preview.windowMin)}` : '在床 —'

  const wakeupReadout = $('#wakeups-readout')
  if (wakeupReadout) wakeupReadout.textContent = String(clamp(Math.round(Number(form.wakeups) || 0), 0, 15))
  const wakeupDesc = $('#wakeups-desc')
  if (wakeupDesc) wakeupDesc.textContent = Number(form.wakeups) === 0 ? '一觉到天亮' : '夜间醒来的次数'
  const wakeupDec = $('#wakeups-dec')
  if (wakeupDec) wakeupDec.disabled = Number(form.wakeups) <= 0
  const wakeupInc = $('#wakeups-inc')
  if (wakeupInc) wakeupInc.disabled = Number(form.wakeups) >= 15
  const goalValue = $('#form-goal-value')
  if (goalValue) goalValue.textContent = formatDuration(clamp(Math.round(Number(form.goalMin) || state.settings.goalMin), 240, 720))
  const goalDec = $('[data-action="form-goal-dec"]')
  if (goalDec) goalDec.disabled = Number(form.goalMin) <= 240
  const goalInc = $('[data-action="form-goal-inc"]')
  if (goalInc) goalInc.disabled = Number(form.goalMin) >= 720

  const readout = $('#latency-readout')
  if (readout) readout.textContent = String(form.latency)
  const range = $('#record-latency')
  if (range) {
    range.value = String(clamp(Number(form.latency) || 0, 0, 120))
    range.style.setProperty('--pct', `${(clamp(Number(form.latency) || 0, 0, 120) / 120) * 100}%`)
  }
  $$('.quick-chip').forEach(chip => {
    chip.classList.toggle('is-active', Number(chip.dataset.latency) === Number(form.latency))
  })
}

function setFeel(feel) {
  if (!ui.form) return
  ui.form.feel = clamp(feel, 1, 5)
  $$('.feel-btn').forEach(button => {
    const active = Number(button.dataset.feel) === ui.form.feel
    button.classList.toggle('is-selected', active)
    button.setAttribute('aria-pressed', String(active))
  })
  const phrase = FEELINGS.find(item => item.v === ui.form.feel)
  const el = $('#feel-phrase')
  if (el) el.textContent = `${phrase.label} · ${phrase.phrase}`
  updateRecordPreview()
  haptic(4)
}

function toggleTag(tagId) {
  if (!ui.form || !TAG_MAP[tagId]) return
  const set = new Set(ui.form.pre)
  if (set.has(tagId)) set.delete(tagId)
  else set.add(tagId)
  ui.form.pre = [...set]
  $$('.tag-btn').forEach(button => {
    const active = ui.form.pre.includes(button.dataset.tag)
    button.classList.toggle('is-selected', active)
    button.setAttribute('aria-pressed', String(active))
  })
  updateRecordPreview()
  haptic(4)
}

function setLatencyPreset(value) {
  if (!ui.form) return
  ui.form.latency = Number(value)
  updateRecordPreview()
  haptic(4)
}

function adjustWakeups(delta) {
  if (!ui.form) return
  ui.form.wakeups = clamp(Math.round(Number(ui.form.wakeups) || 0) + delta, 0, 15)
  updateRecordPreview()
  haptic(4)
}

function adjustFormGoal(delta) {
  if (!ui.form) return
  const next = clamp(Math.round(Number(ui.form.goalMin) || state.settings.goalMin) + delta, 240, 720)
  if (next === Number(ui.form.goalMin)) return
  ui.form.goalMin = next
  updateRecordPreview()
  haptic(4)
}

function showRecordError(message) {
  const el = $('#record-error')
  if (!el) return
  el.textContent = message
  el.classList.add('is-visible')
}

function saveRecordSheet() {
  if (!ui.form) return
  const form = ui.form
  const dateEl = $('#record-date')
  const date = dateEl?.value || form.date
  const bed = $('#record-bed')?.value || form.bed
  const wake = $('#record-wake')?.value || form.wake
  const latency = clamp(Math.round(Number($('#record-latency')?.value) || 0), 0, 720)
  const note = ($('#record-note')?.value || '').slice(0, 160)
  const useCustom = Boolean($('#record-custom-toggle')?.checked)
  const customH = Number($('#record-custom-h')?.value) || 0
  const customM = Number($('#record-custom-m')?.value) || 0
  const customMin = Math.round(customH * 60 + customM)
  const wakeups = clamp(Math.round(Number(form.wakeups) || 0), 0, 15)
  const goalMin = clamp(Math.round(Number(form.goalMin) || state.settings.goalMin), 240, 720)
  const windowMin = durationBetweenSafe(bed, wake)

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return showRecordError('请选择记录日期。')
  if (date > todayISO()) return showRecordError('记录日期不能晚于今天。')
  if (!timeToMin(bed) || !timeToMin(wake)) return showRecordError('请把上床和醒来的时间补充完整。')
  if (bed === wake) return showRecordError('上床和醒来的时间不能相同，请检查一下。')
  if (windowMin < 60) return showRecordError('在床时间似乎太短了，请检查上床与醒来时间。')
  if (windowMin > 960) return showRecordError('在床时间超过 16 小时，请检查时间是否跨错了日期。')
  if (latency >= windowMin - 5) return showRecordError('入睡用时不能超过在床时间。')
  if (useCustom && (customMin < 30 || customMin > windowMin)) {
    return showRecordError('自定义睡眠时长需要在 30 分钟到在床时间之间。')
  }
  const clash = state.logs.find(log => log.date === date && log.id !== form.id)
  if (clash) return showRecordError('这一天已经有记录了。请选择其他日期，或直接在日记里编辑那一条。')

  const previousGoal = state.settings.goalMin
  const goalChanged = goalMin !== previousGoal
  state.settings.goalMin = goalMin
  const saved = upsertLog(state, {
    id: form.id || undefined,
    date,
    bed,
    wake,
    latency,
    durationMin: useCustom ? customMin : null,
    wakeups,
    feel: form.feel,
    pre: form.pre,
    note,
  })
  if (!saved) {
    state.settings.goalMin = previousGoal
    return showRecordError('保存失败，请再试一次。')
  }
  const enriched = enrichLog(saved, state.logs, state.settings.goalMin)
  invalidateAI()
  render({ animate: false, preserveScroll: true })
  closeSheet()
  haptic([8, 35, 18])
  showToast(`已记下 · 睡眠评分 ${enriched.score}${goalChanged ? ' · 目标已同步' : ''}`)
}

function confirmDeleteLog(id) {
  const log = state.logs.find(item => item.id === id)
  if (!log) return
  openConfirm({
    title: '删除这一晚？',
    message: `${formatDateCN(log.date)}的记录会从本机移除，且无法恢复。`,
    confirmLabel: '删除',
    danger: true,
    action: () => {
      removeLog(state, id)
      invalidateAI()
      render({ animate: false, preserveScroll: true })
      showToast('这一晚已删除', 'info')
    },
  })
}

/* ------------------------------------------------------------------ */
/* Detail sheet                                                       */
/* ------------------------------------------------------------------ */

function openDetailSheet(id) {
  const log = state.logs.find(item => item.id === id)
  if (!log) {
    showToast('没有找到这条记录', 'error')
    return
  }
  const enriched = enrichLog(log, state.logs, state.settings.goalMin)
  const band = enriched.band
  const feel = FEELINGS.find(item => item.v === log.feel)
  const windowMin = Math.max(1, enriched.windowMin)
  const latencyPct = clamp((enriched.latency / windowMin) * 100, 0, 96)
  const sleepPct = clamp((enriched.sleepMin / windowMin) * 100, 0, 100 - latencyPct)
  const tags = log.pre.map(tagId => `<span class="detail-tag">${tagIcon(tagId)}${esc(TAG_MAP[tagId]?.label || tagId)}</span>`).join('')
  const goalMin = state.settings.goalMin
  const goalPct = clamp((enriched.sleepMin / Math.max(1, goalMin)) * 100, 0, 100)
  const goalDiff = enriched.sleepMin - goalMin
  const goalLine = Math.abs(goalDiff) <= 5
    ? '正好接近目标'
    : goalDiff > 0
      ? `比目标多 ${formatDuration(goalDiff)}`
      : `比目标少 ${formatDuration(Math.abs(goalDiff))}`
  const breakdown = [
    { label: '时长', value: enriched.durationScore, max: 40 },
    { label: '入睡', value: enriched.latencyScore, max: 20 },
    { label: '夜醒', value: enriched.continuityScore, max: 10 },
    { label: '感受', value: enriched.feelScore, max: 20 },
    { label: '节律', value: enriched.consistencyScore, max: 10 },
  ]
  const breakdownHtml = breakdown.map(item => {
    const pct = clamp((item.value / item.max) * 100, 0, 100)
    return `<div class="breakdown-seg">
      <div class="breakdown-label"><span>${item.label}</span><span>${Math.round(item.value)}/${item.max}</span></div>
      <div class="breakdown-track"><div class="breakdown-fill" style="width:${pct}%"></div></div>
    </div>`
  }).join('')

  mountSheet(`<div class="sheet-backdrop" data-action="close-sheet"></div>
    <section class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div class="sheet-grip"></div>
      <div class="sheet-head">
        <h2 id="detail-title">这一晚</h2>
        <button type="button" class="sheet-close" data-action="close-sheet" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="sheet-scroll">
        <div class="detail-hero">
          ${scoreRing(enriched.score, { animatable: false, detail: true })}
          <div class="detail-hero-copy">
            <div class="detail-date">${formatDateCN(log.date)} · ${nightLabel(log.date)}</div>
            <h3>${formatDuration(enriched.sleepMin)}</h3>
            <p>${band.label} · 睡眠效率 ${displayEfficiency(enriched.efficiency)}${log.demo ? ' · 示例记录' : ''}</p>
          </div>
        </div>

        <div class="detail-body">
          <div class="detail-timeline">
            <div class="detail-times">
              <div class="detail-time">上床<strong>${log.bed}</strong></div>
              <div class="detail-time">醒来<strong>${log.wake}</strong></div>
            </div>
            <div class="detail-track">
              <span class="detail-track-latency" style="width:${latencyPct}%"></span>
              <span class="detail-track-sleep" style="left:${latencyPct}%;width:${sleepPct}%"></span>
            </div>
            <div class="small">实际入睡 ${formatMinutesAsClock(enriched.startClock)} · 在床 ${formatDuration(enriched.windowMin)}</div>
          </div>

          <div class="detail-metrics">
            <div class="detail-metric"><span>入睡耗时</span><strong>${enriched.latency} 分钟</strong></div>
            <div class="detail-metric"><span>睡眠效率</span><strong>${displayEfficiency(enriched.efficiency)}</strong></div>
            <div class="detail-metric"><span>实际睡眠</span><strong>${formatDuration(enriched.sleepMin)}${enriched.customDuration ? ' · 自定义' : ''}</strong></div>
            <div class="detail-metric"><span>夜醒次数</span><strong>${enriched.wakeups} 次</strong></div>
          </div>

          <div class="detail-block detail-goal-block">
            <div class="detail-block-label"><span>睡眠目标</span><strong>${formatDuration(goalMin)}</strong></div>
            <div class="detail-goal-track" aria-hidden="true"><span style="width:${goalPct}%"></span></div>
            <div class="detail-goal-copy"><span>${goalLine}</span><span>${Math.round(goalPct)}%</span></div>
          </div>

          <div class="detail-block">
            <div class="detail-block-label"><span>醒来感受</span><strong>${log.feel}/5</strong></div>
            <div class="detail-feel">${faceSVG(log.feel)}<span>${feel?.label || ''}</span><small>${feel?.phrase || ''}</small></div>
          </div>

          <div class="detail-block">
            <div class="detail-block-label"><span>睡前行为</span><strong>${log.pre.length ? `${log.pre.length} 项` : '未记录'}</strong></div>
            <div class="detail-tags">${tags || '<span class="small">没有记录睡前行为。</span>'}</div>
          </div>

          ${log.note ? `<div class="detail-block">
            <div class="detail-block-label"><span>留给自己的话</span></div>
            <div class="detail-note">${esc(log.note)}</div>
          </div>` : ''}

          <div class="detail-block">
            <div class="detail-block-label"><span>评分构成</span><strong>${enriched.score} / 100</strong></div>
            <div class="detail-breakdown">${breakdownHtml}</div>
          </div>
        </div>
      </div>
      <div class="sheet-footer">
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" data-action="edit-log" data-id="${esc(log.id)}">${icon('edit')}编辑这一晚</button>
          <button type="button" class="btn btn-danger icon-only" data-action="request-delete" data-id="${esc(log.id)}" aria-label="删除这一晚">${icon('trash')}</button>
        </div>
      </div>
    </section>`, '.sheet')
}

/* ------------------------------------------------------------------ */
/* AI                                                                 */
/* ------------------------------------------------------------------ */

function openAISheet() {
  const config = state.settings.ai
  const html = `<div class="sheet-backdrop" data-action="close-sheet"></div>
    <section class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="ai-title">
      <div class="sheet-grip"></div>
      <div class="sheet-head">
        <h2 id="ai-title">AI 深度解读</h2>
        <button type="button" class="sheet-close" data-action="close-sheet" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="sheet-scroll">
        <div class="ai-form" id="ai-form">
          <div class="ai-form-section">
            <div class="ai-enable-row">
              <div class="ai-enable-copy">
                <strong>启用 AI 深度解读</strong>
                <span>关闭时不会向任何地址发送数据。</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="ai-enabled" ${config.enabled ? 'checked' : ''} aria-label="启用 AI 深度解读">
                <span class="switch-track"></span>
              </label>
            </div>
          </div>

          <div class="ai-form-section">
            <div class="field">
              <div class="field-label"><span>API 地址</span><small>OpenAI 兼容</small></div>
              <input class="input" id="ai-url" type="url" inputmode="url" autocomplete="off" spellcheck="false"
                placeholder="https://api.deepseek.com/v1" value="${esc(config.url)}">
              <div class="ai-hint">填到 <strong>/v1</strong> 即可，也可以直接填写完整的 <strong>/chat/completions</strong> 地址。</div>
            </div>
            <div class="field">
              <div class="field-label"><span>模型名称</span><small>由你的服务决定</small></div>
              <input class="input" id="ai-model" type="text" autocomplete="off" spellcheck="false"
                placeholder="deepseek-chat" value="${esc(config.model)}">
            </div>
            <div class="field">
              <div class="field-label"><span>API Key</span><small>仅保存在本机</small></div>
              <div class="input-wrap">
                <input class="input" id="ai-key" type="password" autocomplete="off" spellcheck="false"
                  placeholder="本地服务可留空" value="${esc(config.apiKey)}">
                <button type="button" class="reveal-key" data-action="toggle-secret" aria-label="显示或隐藏 API Key">${icon('eye')}</button>
              </div>
              <div class="ai-hint">${isNativeApp()
                ? '安卓版会通过系统网络请求访问你的 API，不受浏览器跨域（CORS）限制。'
                : '网页版会直接请求你的 API，服务端需允许浏览器跨域（CORS）。'}</div>
            </div>
          </div>

          <div class="ai-form-section">
            <div class="ai-tip-box">${icon('info')}<span>分析只会发送睡眠统计与最近记录（不含备注和昵称）。你的 API Key 不会出现在导出的备份中。</span></div>
            <div class="ai-test-row">
              <button type="button" class="btn btn-ghost btn-small" data-action="test-ai" id="ai-test-button">${icon('link')}测试连接</button>
              <span class="ai-test-result" id="ai-test-result"></span>
            </div>
          </div>
        </div>
      </div>
      <div class="sheet-footer">
        <div class="ai-settings-footer">
          <button type="button" class="btn btn-ghost" data-action="close-sheet">取消</button>
          <button type="button" class="btn btn-primary" data-action="save-ai">保存配置</button>
        </div>
      </div>
    </section>`
  mountSheet(html, '.sheet')
}

function readAIForm() {
  return {
    enabled: Boolean($('#ai-enabled')?.checked),
    url: ($('#ai-url')?.value || '').trim(),
    model: ($('#ai-model')?.value || '').trim(),
    apiKey: ($('#ai-key')?.value || '').trim(),
  }
}

function validHttpUrl(value) {
  try {
    const url = new URL(value)
    return /^https?:$/.test(url.protocol)
  } catch { return false }
}

function saveAISettings() {
  const config = readAIForm()
  if (config.url && !validHttpUrl(config.url)) {
    showToast('API 地址需要是完整的 http(s) 地址', 'error')
    $('#ai-url')?.focus()
    return
  }
  if (config.enabled && !config.url) {
    showToast('启用 AI 前，请先填写 API 地址', 'error')
    $('#ai-url')?.focus()
    return
  }
  if (config.enabled && !config.model) {
    showToast('启用 AI 前，请先填写模型名称', 'error')
    $('#ai-model')?.focus()
    return
  }
  state.settings.ai = config
  saveState(state)
  invalidateAI()
  closeSheet()
  render({ animate: false, preserveScroll: true })
  showToast('AI 配置已保存')
}

async function runAITest() {
  const button = $('#ai-test-button')
  const result = $('#ai-test-result')
  const config = readAIForm()
  if (!button || !result) return
  if (button.dataset.busy === '1') return
  if (!config.url || !config.model) {
    result.textContent = '先填写 API 地址和模型名称。'
    result.className = 'ai-test-result bad'
    return
  }
  if (!validHttpUrl(config.url)) {
    result.textContent = 'API 地址格式不正确。'
    result.className = 'ai-test-result bad'
    return
  }
  const seq = ++aiSequence
  button.dataset.busy = '1'
  button.disabled = true
  button.innerHTML = `<span class="spinner"></span>连接中`
  result.textContent = '正在请求模型…'
  result.className = 'ai-test-result'
  try {
    const info = await testAIConnection(config)
    if (seq !== aiSequence || !result.isConnected) return
    result.textContent = `连接成功 · ${info.model} · ${info.ms} ms`
    result.className = 'ai-test-result ok'
  } catch (error) {
    if (seq !== aiSequence || !result.isConnected) return
    result.textContent = error.message || '连接失败。'
    result.className = 'ai-test-result bad'
    if (error.detail) result.title = error.detail
  } finally {
    if (button.isConnected) {
      button.disabled = false
      button.dataset.busy = '0'
      button.innerHTML = `${icon('link')}测试连接`
    }
  }
}

function toggleAISecret(button) {
  const input = $('#ai-key')
  if (!input) return
  const show = input.type === 'password'
  input.type = show ? 'text' : 'password'
  button.innerHTML = icon(show ? 'eyeOff' : 'eye')
  button.setAttribute('aria-label', show ? '隐藏 API Key' : '显示 API Key')
}

function invalidateAI() {
  aiGeneration++
  ui.aiInsights = {}
  ui.aiErrors = {}
  ui.aiLoading = {}
}

function refreshAICard() {
  if (ui.view !== 'trends') return
  const card = $('.ai-card', main)
  if (!card) return
  const analysis = buildAnalytics(state.logs, state.settings, ui.trendRange)
  card.outerHTML = renderAICard(analysis)
}

async function runAIAnalysis() {
  const config = state.settings.ai
  if (!aiReady(config) || !config.enabled) {
    openAISheet()
    showToast(!aiReady(config) ? '先配置你的 AI 接口' : '先在设置里启用 AI 解读', 'info')
    return
  }
  const range = ui.trendRange
  if (ui.aiLoading[range]) return
  const analysis = buildAnalytics(state.logs, state.settings, range)
  if (!analysis.stats.nights) return
  const generation = aiGeneration
  ui.aiLoading[range] = true
  delete ui.aiErrors[range]
  refreshAICard()
  try {
    const text = await requestAIAnalysis(config, analysis)
    if (generation !== aiGeneration) return
    ui.aiInsights[range] = {
      text,
      at: Date.now(),
      nights: analysis.stats.nights,
      model: config.model,
    }
  } catch (error) {
    if (generation !== aiGeneration) return
    ui.aiErrors[range] = {
      message: error.message || 'AI 解读没有完成。',
      detail: error.detail || '',
    }
  } finally {
    if (generation === aiGeneration) {
      ui.aiLoading[range] = false
      refreshAICard()
    }
  }
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

function exportData() {
  const backup = makeBackup(state)
  const text = JSON.stringify(backup, null, 2)
  const stamp = todayISO().replaceAll('-', '')
  const fileName = `mianyu-backup-${stamp}.json`

  if (nativeHas('saveTextFile')) {
    const id = nextNativeFileId()
    nativeFileRequests.set(id, { kind: 'save' })
    try {
      window.MianyuNative.saveTextFile(id, fileName, 'application/json', text)
      showToast('请选择备份保存的位置', 'info')
      return
    } catch (error) {
      nativeFileRequests.delete(id)
      console.error('Native export failed', error)
    }
  }

  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  showToast('备份已导出 · 不含 API Key')
}

async function importData() {
  if (!nativeHas('pickTextFile')) {
    importFile.click()
    return
  }
  const id = nextNativeFileId()
  try {
    const text = await new Promise((resolve, reject) => {
      nativeFileRequests.set(id, { kind: 'import', resolve, reject })
      try {
        window.MianyuNative.pickTextFile(id)
      } catch (error) {
        nativeFileRequests.delete(id)
        reject(error)
      }
    })
    openImportText(text)
  } catch (error) {
    if (error?.message !== 'cancelled') {
      showToast(error.message || '无法读取备份', 'error')
    }
  }
}

function openImportText(text) {
  try {
    const backup = parseBackup(text)
    ui.pendingImport = backup
    openConfirm({
      title: '导入这份备份？',
      message: `将用备份里的 ${backup.logs.length} 晚记录替换当前记录，外观设置会一起恢复。当前 API Key 会保留。`,
      confirmLabel: '导入并替换',
      action: () => {
        applyBackup(state, backup)
        invalidateAI()
        applyAppearance(false)
        render({ animate: false, preserveScroll: true })
        showToast(`已导入 ${state.logs.length} 晚记录`)
      },
    })
  } catch (error) {
    showToast(error.message || '无法读取这个备份文件', 'error')
  }
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    openImportText(await file.text())
  } catch (error) {
    showToast(error.message || '无法读取这个备份文件', 'error')
  }
}

function confirmClearDemo() {
  const count = countDemoLogs(state)
  if (!count) return
  openConfirm({
    title: '清空示例数据？',
    message: `${count} 晚示例记录会被移除，你自己记录的夜晚会保留。`,
    confirmLabel: '清空示例',
    danger: true,
    action: () => {
      clearDemoLogs(state)
      invalidateAI()
      ui.diaryLimit = 14
      render({ animate: false, preserveScroll: true })
      showToast('示例数据已清空')
    },
  })
}

function confirmClearAll() {
  if (!state.logs.length) {
    showToast('现在还没有可以清空的记录', 'info')
    return
  }
  openConfirm({
    title: '清空全部睡眠记录？',
    message: `本机的 ${state.logs.length} 晚记录会被永久删除。外观与 AI 配置会保留。建议先导出备份。`,
    confirmLabel: '全部清空',
    danger: true,
    action: () => {
      clearAllLogs(state)
      invalidateAI()
      ui.diaryLimit = 14
      render({ animate: false, preserveScroll: true })
      showToast('所有睡眠记录已清空', 'info')
    },
  })
}

/* Native hardware-back support; harmless when opened in a normal browser. */
window.mianyuHandleBack = () => {
  if (isSheetOpen()) {
    closeSheet()
    return true
  }
  return false
}

bootstrap()
