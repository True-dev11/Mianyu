import {
  addDays, average, averageBedtime, averageWake, clamp, daysBetween, diffDays,
  formatDuration, minToTime, parseISO, sleepStartMin, stdDev, timeToMin, todayISO,
} from './lib.js'
import { TAG_MAP } from './store.js'

export const RANGES = [
  { key: '7d', label: '7天', days: 7 },
  { key: '1m', label: '1月', days: 30 },
  { key: '3m', label: '3月', days: 90 },
  { key: '1y', label: '1年', days: 365 },
  { key: 'all', label: '全部', days: null },
]

export const RANGE_MAP = Object.fromEntries(RANGES.map(r => [r.key, r]))

export function scoreBand(score) {
  const s = Number(score) || 0
  if (s >= 90) return { key: 'excellent', label: '极佳', tone: 'good' }
  if (s >= 80) return { key: 'good', label: '不错', tone: 'good' }
  if (s >= 70) return { key: 'fair', label: '平稳', tone: 'mid' }
  if (s >= 60) return { key: 'low', label: '欠佳', tone: 'warn' }
  return { key: 'poor', label: '需关照', tone: 'bad' }
}

function emptyScoreParts(goalMin) {
  return {
    windowMin: 0,
    latency: 0,
    sleepMin: 0,
    efficiency: 0,
    customDuration: false,
    startClock: null,
    wakeups: 0,
    durationScore: 0,
    latencyScore: 0,
    continuityScore: 0,
    feelScore: 0,
    consistencyScore: 0,
    consistencySd: null,
    score: 0,
    band: scoreBand(0),
    goalMin,
  }
}

function priorContext(logs, date, count = 14) {
  return logs
    .filter(l => l.date < date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, count)
    .sort((a, b) => (a.date > b.date ? 1 : -1))
}

export function enrichLog(log, logs, goalMin = 450) {
  if (!log) return emptyScoreParts(goalMin)
  const bedMin = timeToMin(log.bed)
  const wakeMin = timeToMin(log.wake)
  let windowMin = 0
  if (bedMin != null && wakeMin != null) {
    windowMin = wakeMin - bedMin
    if (windowMin <= 0) windowMin += 1440
  }
  const latency = clamp(Math.round(Number(log.latency) || 0), 0, Math.max(0, windowMin - 1))
  const autoSleep = Math.max(0, windowMin - latency)
  const durationMin = Number(log.durationMin)
  const custom = Number.isFinite(durationMin) && durationMin > 0
  const sleepMin = custom ? clamp(Math.round(durationMin), 0, windowMin) : autoSleep
  const efficiency = windowMin > 0 ? clamp((sleepMin / windowMin) * 100, 0, 100) : 0

  const prior = priorContext(logs, log.date, 13)
  const bedAnchors = prior.map(l => {
    const m = timeToMin(l.bed)
    if (m == null) return null
    return m > 12 * 60 ? m - 1440 : m
  }).filter(v => Number.isFinite(v))
  const currentBed = bedMin == null ? null : bedMin > 12 * 60 ? bedMin - 1440 : bedMin
  if (Number.isFinite(currentBed)) bedAnchors.push(currentBed)
  const consistencySd = bedAnchors.length >= 3 ? stdDev(bedAnchors) : null

  const wakeups = clamp(Math.round(Number(log.wakeups) || 0), 0, 20)
  const durationDeviation = Math.abs(sleepMin - goalMin)
  const durationScore = 40 * clamp(1 - Math.max(0, durationDeviation - 20) / 190, 0, 1)
  const latencyScore = 20 * clamp(1 - Math.max(0, latency - 15) / 95, 0, 1)
  const continuityScore = 10 * clamp(1 - wakeups / 5, 0, 1)
  const feelScore = 20 * clamp((Number(log.feel) - 1) / 4, 0, 1)
  const consistencyScore = consistencySd == null
    ? 7
    : 10 * clamp(1 - consistencySd / 120, 0.18, 1)
  const score = Math.round(clamp(
    durationScore + latencyScore + continuityScore + feelScore + consistencyScore,
    0,
    100,
  ))

  return {
    windowMin,
    latency,
    sleepMin,
    efficiency,
    customDuration: custom,
    startClock: sleepStartMin(log.bed, latency),
    wakeups,
    durationScore,
    latencyScore,
    continuityScore,
    feelScore,
    consistencyScore,
    consistencySd,
    score,
    band: scoreBand(score),
    goalMin,
  }
}

export function enrichLogs(logs, goalMin = 450, contextLogs = logs) {
  const sorted = logs.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  return sorted.map(log => ({ ...log, ...enrichLog(log, contextLogs, goalMin) }))
}

export function rangeBounds(rangeKey, logs, today = todayISO()) {
  const def = RANGE_MAP[rangeKey] || RANGE_MAP['7d']
  if (rangeKey === 'all') {
    const dates = logs.map(l => l.date).filter(d => d <= today).sort()
    const end = today
    const start = dates.length ? dates[0] : addDays(today, -6)
    return { start, end, prevStart: null, prevEnd: null, days: diffDays(end, start) + 1 }
  }
  const end = today
  const start = addDays(today, -(def.days - 1))
  const prevEnd = addDays(start, -1)
  const prevStart = addDays(prevEnd, -(def.days - 1))
  return { start, end, prevStart, prevEnd, days: def.days }
}

function inRange(log, start, end) {
  return log.date >= start && log.date <= end
}

function makeBuckets(rangeKey, start, end, enriched) {
  const byDate = new Map(enriched.map(e => [e.date, e]))
  const buckets = []
  if (rangeKey === '7d' || rangeKey === '1m') {
    for (const date of daysBetween(start, end)) {
      const entry = byDate.get(date) || null
      const d = parseISO(date)
      buckets.push({
        key: date,
        label: rangeKey === '7d'
          ? (date === end ? '今天' : ['日', '一', '二', '三', '四', '五', '六'][d.getDay()])
          : (d.getDate() === 1 || d.getDate() % 5 === 0 ? `${d.getMonth() + 1}/${d.getDate()}` : ''),
        fullLabel: `${d.getMonth() + 1}月${d.getDate()}日`,
        short: `${d.getMonth() + 1}.${d.getDate()}`,
        entries: entry ? [entry] : [],
        count: entry ? 1 : 0,
        date,
      })
    }
    return buckets
  }

  if (rangeKey === '3m') {
    let cursor = start
    let index = 0
    while (cursor <= end) {
      const bucketEnd = addDays(cursor, 6) > end ? end : addDays(cursor, 6)
      const entries = enriched.filter(e => e.date >= cursor && e.date <= bucketEnd)
      const a = parseISO(cursor)
      buckets.push({
        key: cursor,
        label: index % 3 === 0 || bucketEnd === end ? `${a.getMonth() + 1}/${a.getDate()}` : '',
        fullLabel: `${a.getMonth() + 1}月${a.getDate()}日 – ${parseISO(bucketEnd).getMonth() + 1}月${parseISO(bucketEnd).getDate()}日`,
        short: `${a.getMonth() + 1}/${a.getDate()}`,
        entries,
        count: entries.length,
        start: cursor,
        end: bucketEnd,
      })
      cursor = addDays(bucketEnd, 1)
      index++
    }
    return buckets
  }

  // 1y and all: one column per calendar month.
  const first = parseISO(start)
  const last = parseISO(end)
  let year = first.getFullYear()
  let month = first.getMonth()
  while (year < last.getFullYear() || (year === last.getFullYear() && month <= last.getMonth())) {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const monthEndDate = new Date(year, month + 1, 0, 12)
    const monthEnd = isoMini(monthEndDate)
    const entries = enriched.filter(e => e.date >= monthStart && e.date <= monthEnd && e.date >= start && e.date <= end)
    buckets.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${month + 1}月`,
      fullLabel: `${year}年${month + 1}月`,
      short: `${month + 1}月`,
      entries,
      count: entries.length,
      start: monthStart,
      end: monthEnd,
    })
    month++
    if (month > 11) { month = 0; year++ }
  }
  return buckets
}

function isoMini(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function summarize(enriched, goalMin) {
  if (!enriched.length) {
    return {
      nights: 0, avgScore: null, avgDuration: null, avgWindow: null, avgLatency: null,
      avgEfficiency: null, avgFeel: null, avgBed: null, avgWake: null, bedSd: null,
      wakeSd: null, rhythmSd: null, regularity: null, avgWakeups: null,
      hitGoal: 0, hitPct: 0, avgStart: null, streak: 0,
    }
  }
  const bedValues = enriched.map(e => {
    const m = timeToMin(e.bed)
    return m == null ? null : (m > 720 ? m - 1440 : m)
  }).filter(Number.isFinite)
  const wakeValues = enriched.map(e => {
    const m = timeToMin(e.wake)
    return m == null ? null : (m > 960 ? m - 1440 : m)
  }).filter(Number.isFinite)
  const startValues = enriched.map(e => e.startClock).filter(Number.isFinite)
  const scores = enriched.map(e => e.score)
  const durations = enriched.map(e => e.sleepMin)
  const windows = enriched.map(e => e.windowMin)
  const latencies = enriched.map(e => e.latency)
  const efficiencies = enriched.map(e => e.efficiency)
  const feels = enriched.map(e => Number(e.feel)).filter(Number.isFinite)
  const wakeupsValues = enriched.map(e => Number(e.wakeups) || 0)
  const bedMean = average(bedValues)
  const wakeMean = average(wakeValues)
  const hitGoal = enriched.filter(e => e.sleepMin >= goalMin - 5).length
  const bedSd = bedValues.length >= 3 ? stdDev(bedValues) : null
  const wakeSd = wakeValues.length >= 3 ? stdDev(wakeValues) : null
  const rhythmSd = bedSd == null && wakeSd == null
    ? null
    : bedSd == null
      ? wakeSd
      : wakeSd == null
        ? bedSd
        : bedSd * 0.65 + wakeSd * 0.35
  const regularity = rhythmSd == null ? null : Math.round(clamp(100 - rhythmSd, 0, 100))
  let streak = 0
  const ascending = enriched.slice().sort((a, b) => (a.date > b.date ? 1 : -1))
  for (let i = ascending.length - 1; i >= 0; i--) {
    if (ascending[i].sleepMin >= goalMin - 5) streak++
    else break
  }
  return {
    nights: enriched.length,
    avgScore: average(scores),
    avgDuration: average(durations),
    avgWindow: average(windows),
    avgLatency: average(latencies),
    avgEfficiency: average(efficiencies),
    avgFeel: average(feels),
    avgWakeups: average(wakeupsValues),
    avgBed: bedMean == null ? null : bedMean + 1440,
    avgWake: wakeMean == null ? null : wakeMean + 1440,
    avgStart: average(startValues) == null ? null : average(startValues),
    bedSd,
    wakeSd,
    rhythmSd,
    regularity,
    hitGoal,
    hitPct: enriched.length ? hitGoal / enriched.length : 0,
    streak,
  }
}

export function summarizePeriod(logs, goalMin = 450, contextLogs = logs) {
  const enriched = enrichLogs(logs, goalMin, contextLogs)
  return { enriched, stats: summarize(enriched, goalMin) }
}

function behaviorImpact(enriched) {
  const total = enriched.length
  if (total < 4) return []
  const rows = []
  for (const tag of Object.keys(TAG_MAP)) {
    const withTag = enriched.filter(e => e.pre.includes(tag))
    const without = enriched.filter(e => !e.pre.includes(tag))
    if (withTag.length < 2 || without.length < 2) continue
    const avgWith = average(withTag.map(e => e.score))
    const avgWithout = average(without.map(e => e.score))
    const durWith = average(withTag.map(e => e.sleepMin))
    const durWithout = average(without.map(e => e.sleepMin))
    if (avgWith == null || avgWithout == null) continue
    rows.push({
      tag,
      label: TAG_MAP[tag]?.label || tag,
      n: withTag.length,
      withoutN: without.length,
      scoreDelta: avgWith - avgWithout,
      durationDelta: durWith - durWithout,
      avgWith,
      avgWithout,
      share: withTag.length / total,
    })
  }
  return rows
    .filter(r => r.share >= 0.08 && r.share <= 0.9)
    .sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta))
}

function comparison(current, previous) {
  if (!previous?.nights || !current?.nights) return null
  return {
    score: current.avgScore - previous.avgScore,
    duration: current.avgDuration - previous.avgDuration,
    latency: current.avgLatency - previous.avgLatency,
    previousNights: previous.nights,
  }
}

export function buildAnalytics(logs, settings, rangeKey = '7d', today = todayISO()) {
  const goalMin = settings?.goalMin || 450
  const bounds = rangeBounds(rangeKey, logs, today)
  const within = logs.filter(l => inRange(l, bounds.start, bounds.end) && l.date <= today)
  const enriched = enrichLogs(within, goalMin, logs)
  const stats = summarize(enriched, goalMin)
  const buckets = makeBuckets(rangeKey, bounds.start, bounds.end, enriched)
  const behaviors = behaviorImpact(enriched)

  let previousStats = null
  if (bounds.prevStart) {
    const prevLogs = logs.filter(l => inRange(l, bounds.prevStart, bounds.prevEnd))
    previousStats = summarize(enrichLogs(prevLogs, goalMin, logs), goalMin)
  }

  const analysis = {
    logs,
    enriched,
    newest: enriched[0] || null,
    bounds,
    stats,
    buckets,
    behaviors,
    previous: previousStats,
    change: comparison(stats, previousStats),
    goalMin,
    rangeKey,
  }
  analysis.suggestions = buildSuggestions(analysis)
  return analysis
}

export function buildSuggestions(analysis, limit = 3) {
  const { stats, behaviors } = analysis
  if (!stats.nights) {
    return [
      {
        title: '从今晚开始，留下一页',
        body: '记录睡眠不需要很精确。连续写下 3 晚，眠屿就能开始看见你的节律。',
        kind: 'empty',
      },
      {
        title: '固定起床时间',
        body: '相比强迫自己早睡，先把每天的起床时间稳定下来，通常更容易。',
        kind: 'general',
      },
    ]
  }
  if (stats.nights < 3) {
    return [
      {
        title: '再多听几晚',
        body: `已经记录 ${stats.nights} 晚。再坚持 ${3 - stats.nights} 晚，区间趋势和行为关联会更有意义。`,
        kind: 'empty',
      },
      {
        title: '记录，不必评判',
        body: '先如实记录上床、醒来和入睡用时，不需要为了“好看”而调整数字。',
        kind: 'general',
      },
    ]
  }

  const tips = []
  const negative = behaviors.find(b => b.scoreDelta <= -2.2)
  const positive = behaviors.find(b => b.scoreDelta >= 2.2)

  if (stats.avgLatency > 30) {
    tips.push({
      title: '给自己一段降速坡',
      body: `最近平均要 ${Math.round(stats.avgLatency)} 分钟才睡着。睡前 45 分钟把屏幕放下，调暗灯光，做点重复而无聊的事。`,
      kind: 'latency',
    })
  }
  if (stats.avgWakeups != null && stats.avgWakeups >= 1.2) {
    tips.push({
      title: '让夜晚少醒几次',
      body: `最近平均每晚醒来约 ${stats.avgWakeups.toFixed(1)} 次。让卧室保持凉、暗、安静，睡前少喝酒和咖啡因，醒来时也先别看时间。`,
      kind: 'wakeups',
    })
  }
  if (negative) {
    const detail = negative.tag === 'screen'
      ? '试试把手机放到伸手够不到的地方'
      : negative.tag === 'caffeine'
        ? '把最后一杯咖啡或茶提前到下午 2 点前'
        : negative.tag === 'alcohol'
          ? '睡前 3 小时不饮酒，看看夜里是否更安稳'
          : negative.tag === 'stress'
            ? '睡前把明天要担心的事写在纸上，留给明天'
            : '试着减少这种睡前行为，观察一周'
    tips.push({
      title: `留意「${negative.label}」`,
      body: `出现「${negative.label}」的 ${negative.n} 晚，平均评分低 ${Math.abs(Math.round(negative.scoreDelta))} 分。${detail}。`,
      kind: 'behavior-negative',
    })
  }
  if (stats.avgDuration < analysis.goalMin - 30) {
    const gap = Math.round(analysis.goalMin - stats.avgDuration)
    tips.push({
      title: '把上床时间往前挪一点',
      body: `平均比目标少 ${gap} 分钟。今晚提前 ${clamp(Math.round(gap / 5) * 5, 10, 60)} 分钟上床，比周末一次补觉更有效。`,
      kind: 'short',
    })
  }
  if (stats.bedSd != null && stats.bedSd > 45) {
    tips.push({
      title: '先固定起床时间',
      body: `上床时间上下浮动约 ${Math.round(stats.bedSd)} 分钟。先守住每天的起床时间，晚上自然会更容易困。`,
      kind: 'regularity',
    })
  }
  if (stats.avgEfficiency != null && stats.avgEfficiency < 85) {
    tips.push({
      title: '床只留给睡觉',
      body: `在床时间里约 ${Math.round(100 - stats.avgEfficiency)}% 是清醒的。如果 20 分钟还睡不着，先离开床，等困了再回来。`,
      kind: 'efficiency',
    })
  }
  if (positive) {
    tips.push({
      title: '把有效的事留下来',
      body: `有「${positive.label}」的夜晚，评分平均高 ${Math.round(positive.scoreDelta)} 分。它不一定适合所有人，但看起来适合你。`,
      kind: 'behavior-positive',
    })
  }
  if (stats.avgDuration > analysis.goalMin + 55) {
    tips.push({
      title: '给早晨留一点缓冲',
      body: `平均睡 ${formatDuration(stats.avgDuration, 'long')}，比目标更长。如果醒来仍觉得沉，可以试着把目标缩短 15–20 分钟。`,
      kind: 'long',
    })
  }
  tips.push({
    title: '守住现在的节奏',
    body: stats.hitPct >= 0.7
      ? '最近大多数夜晚都接近目标。保持固定起床与温和的睡前流程，就是最稳的进步。'
      : '睡眠很少靠某一个“完美夜晚”改善。先照顾节律，再看分数，会轻松一些。',
    kind: 'general',
  })
  return tips.slice(0, limit)
}

export function localInsight(analysis) {
  const { stats, behaviors } = analysis
  if (!stats.nights) return '记录几晚之后，这里会出现属于你的睡眠解读。'
  const sentences = []
  sentences.push(`这段时间平均睡 ${formatDuration(stats.avgDuration, 'long')}，平均评分 ${Math.round(stats.avgScore)}。`)
  if (stats.avgLatency != null) {
    sentences.push(stats.avgLatency <= 20
      ? '入睡速度很快，说明身体已经接住了夜晚。'
      : `平均需要 ${Math.round(stats.avgLatency)} 分钟入睡，睡前的降速还可以更温柔一些。`)
  }
  if (stats.avgWakeups != null) {
    sentences.push(stats.avgWakeups < 1
      ? '夜晚大多连续，醒来次数不多。'
      : `平均每晚醒来约 ${stats.avgWakeups.toFixed(1)} 次，夜间连续性还可以再温柔地照顾一下。`)
  }
  if (stats.regularity != null) {
    sentences.push(stats.regularity >= 75
      ? `作息规律度约 ${stats.regularity}，节律已经比较稳定。`
      : `作息规律度约 ${stats.regularity}，先把起床时间固定下来会更有帮助。`)
  }
  const negative = behaviors.find(b => b.scoreDelta < -2)
  const positive = behaviors.find(b => b.scoreDelta > 2)
  if (positive) sentences.push(`「${positive.label}」出现的夜晚评分更高，也许可以多留一点给它。`)
  if (negative) sentences.push(`「${negative.label}」出现的夜晚评分偏低，不过这只是一种关联，不必把它当成结论。`)
  return sentences.join('')
}

export function chartBuckets(analysis, metric = 'duration') {
  return analysis.buckets.map(b => {
    let value = null
    if (b.count) {
      if (metric === 'score') {
        value = average(b.entries.map(e => e.score))
      } else {
        value = average(b.entries.map(e => e.sleepMin))
      }
    }
    return {
      ...b,
      value,
      display: value == null ? '—' : metric === 'score' ? `${Math.round(value)} 分` : formatDuration(value, 'long'),
    }
  })
}

export function goalHitStreak(enriched, goalMin) {
  let streak = 0
  for (const e of enriched) {
    if (e.sleepMin >= goalMin - 5) streak++
    else break
  }
  return streak
}

export function makeDefaultRecord(today = todayISO()) {
  return {
    id: null,
    date: today,
    bed: '23:00',
    wake: '07:00',
    latency: 15,
    durationMin: null,
    feel: 3,
    pre: [],
    note: '',
  }
}

export function sortNewest(logs) {
  return logs.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
}
