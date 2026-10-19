const P = {
  home: '<path d="M3.4 10.7 12 3.5l8.6 7.2"/><path d="M5.5 9.2v10.1c0 .7.6 1.2 1.2 1.2h3.5v-5.7h3.6v5.7h3.5c.7 0 1.2-.6 1.2-1.2V9.2"/>',
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7.5 14.5 3.2-4 3 2.4L19 7"/><circle cx="19" cy="7" r="1.2" fill="currentColor" stroke="none"/>',
  book: '<path d="M5 4.8c0-.7.6-1.3 1.3-1.3H11c1.1 0 2 .9 2 2v14.6c0-.9-.7-1.6-1.6-1.6H6.3c-.7 0-1.3-.6-1.3-1.3V4.8Z"/><path d="M19 4.8c0-.7-.6-1.3-1.3-1.3H13v16.6c0-.9.7-1.6 1.6-1.6h5.1c.7 0 1.3-.6 1.3-1.3V4.8Z"/>',
  settings: '<path d="M4 7h8"/><path d="M16 7h4"/><circle cx="14" cy="7" r="2.2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2.2"/>',
  plus: '<path d="M12 5.5v13"/><path d="M5.5 12h13"/>',
  close: '<path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/>',
  moon: '<path d="M20.2 15.2A8.4 8.4 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.3v2.2M12 19.5v2.2M2.3 12h2.2M19.5 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"/>',
  sparkle: '<path d="M12 3.5c.5 4.4 2.3 6.2 6.7 6.7-4.4.5-6.2 2.3-6.7 6.7-.5-4.4-2.3-6.2-6.7-6.7 4.4-.5 6.2-2.3 6.7-6.7Z" fill="currentColor" stroke="none"/><path d="M18.4 15.2c.25 2.1 1.1 2.95 3.2 3.2-2.1.25-2.95 1.1-3.2 3.2-.25-2.1-1.1-2.95-3.2-3.2 2.1-.25 2.95-1.1 3.2-3.2Z" fill="currentColor" stroke="none"/>',
  chevron: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  chevronDown: '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
  arrowUp: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
  arrowUpRight: '<path d="M6.5 17.5 17.5 6.5"/><path d="M8 6.5h9.5V16"/>',
  edit: '<path d="m14.2 5.4 4.4 4.4"/><path d="M4.8 19.2 6 14.2 15.7 4.5a1.6 1.6 0 0 1 2.3 0l1.5 1.5a1.6 1.6 0 0 1 0 2.3L9.8 18l-5 1.2Z"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9 7V4.8h6V7"/><path d="m6.5 7 .8 12.1c0 .8.7 1.4 1.5 1.4h6.4c.8 0 1.4-.6 1.5-1.4L17.5 7"/><path d="M10 10.8v6M14 10.8v6"/>',
  download: '<path d="M12 3.5v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4.5 17v2.5c0 .6.4 1 1 1h13c.6 0 1-.4 1-1V17"/>',
  upload: '<path d="M12 14.5v-11"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M4.5 17v2.5c0 .6.4 1 1 1h13c.6 0 1-.4 1-1V17"/>',
  check: '<path d="m5 12.5 4.4 4.4L19 7.4"/>',
  eye: '<path d="M2.8 12s3.2-5.2 9.2-5.2S21.2 12 21.2 12 18 17.2 12 17.2 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff: '<path d="m4 4 16 16"/><path d="M9.5 7.3c.8-.3 1.6-.5 2.5-.5 6 0 9.2 5.2 9.2 5.2a16.7 16.7 0 0 1-3.2 3.7M6.4 8.3A16.8 16.8 0 0 0 2.8 12s3.2 5.2 9.2 5.2c1.4 0 2.6-.3 3.7-.7"/><path d="M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6"/>',
  key: '<circle cx="8" cy="15.8" r="3.7"/><path d="m10.7 13.2 8.3-8.3"/><path d="m16.3 7.6 2.2 2.2M18.5 5.4l2.2 2.2"/>',
  link: '<path d="M10.4 13.6a4 4 0 0 0 5.6 0l2.6-2.6a4 4 0 0 0-5.6-5.6L11.5 6.9"/><path d="M13.6 10.4a4 4 0 0 0-5.6 0L5.4 13a4 4 0 0 0 5.6 5.6l1.5-1.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>',
  bed: '<path d="M3.5 18.5v-10"/><path d="M3.5 15h17v3.5"/><path d="M3.5 15v-4.2c0-.7.6-1.3 1.3-1.3h5.4c.7 0 1.3.6 1.3 1.3V15"/><path d="M11.5 15v-2.7c0-.7.6-1.3 1.3-1.3h5.7c.7 0 1.3.6 1.3 1.3V15"/><path d="M6.6 9.5h1.8"/>',
  sunrise: '<path d="M3.5 18h17"/><path d="M6.5 14.5a5.5 5.5 0 0 1 11 0"/><path d="M12 4v3M4.4 8.4l2.1 2.1M19.6 8.4l-2.1 2.1M2.5 21.5h19"/>',
  activity: '<path d="M3.5 12h4l2.2-5.4 4 11 2.3-5.6h4.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.7" r="1" fill="currentColor" stroke="none"/>',
  alert: '<path d="M12 3.8 21 19H3L12 3.8Z"/><path d="M12 9v4.5"/><circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none"/>',
  rotate: '<path d="M19.2 8.5A8 8 0 1 0 20 14"/><path d="M20 4v5h-5"/>',
  cloud: '<path d="M7.2 18.5h10a3.8 3.8 0 0 0 .4-7.6A5.8 5.8 0 0 0 6.4 9.7a4.5 4.5 0 0 0 .8 8.8Z"/>',
  user: '<circle cx="12" cy="8.3" r="3.7"/><path d="M4.8 20c.3-3.6 3.2-5.7 7.2-5.7s6.9 2.1 7.2 5.7"/>',
  calendar: '<rect x="3.8" y="5.2" width="16.4" height="15" rx="2.5"/><path d="M7.5 3v4M16.5 3v4M3.8 9.2h16.4"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 16.6h.01M12 16.6h.01"/>',
  chevronLeft: '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
  arrowRight: '<path d="M4.5 12h15"/><path d="m14 6.5 5.5 5.5L14 17.5"/>',
  bedTime: '<path d="M3.5 18.5V9.8"/><path d="M3.5 15.8h17v2.7"/><path d="M3.5 15.8v-5c0-.8.7-1.5 1.5-1.5h4.8c.8 0 1.5.7 1.5 1.5v5"/><path d="M13 15.8v-3.2c0-.8.7-1.5 1.5-1.5h4.2c.8 0 1.5.7 1.5 1.5v3.2"/><path d="M18.3 3.5c-1.5.6-1.8 2.2-.6 3.2.8.7 2 .5 2.6-.3-.9.1-1.6-.5-1.7-1.3-.1-.6.2-1.2.6-1.6l-.9 0Z"/>',
}

export function icon(name, className = '') {
  const paths = P[name] || P.info
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

export function logoMark() {
  return `<span class="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 28 28" fill="none">
      <path d="M21.2 18.6A9.2 9.2 0 0 1 9.4 6.8a9.2 9.2 0 1 0 11.8 11.8Z" fill="currentColor"/>
      <circle cx="20.1" cy="7.6" r="1.7" fill="currentColor"/>
    </svg>
  </span>`
}

export function faceSVG(level, className = '') {
  const v = Math.max(1, Math.min(5, Number(level) || 3))
  const eyes = v === 5
    ? '<path d="M8.2 10.2c.5-.7 1.3-.7 1.8 0M14 10.2c.5-.7 1.3-.7 1.8 0"/>'
    : v === 1
      ? '<path d="m8.2 9.2 1.8 1.8M10 9.2l-1.8 1.8M14 9.2l1.8 1.8M15.8 9.2 14 11"/>'
      : '<circle cx="9.1" cy="10.2" r=".85" fill="currentColor" stroke="none"/><circle cx="14.9" cy="10.2" r=".85" fill="currentColor" stroke="none"/>'
  const mouth = v === 1
    ? '<path d="M8.7 16.2c1.6-1.7 4.9-1.7 6.6 0"/>'
    : v === 2
      ? '<path d="M9.3 15.7c1.5-1 3.9-1 5.4 0"/>'
      : v === 3
        ? '<path d="M9.3 15.3h5.4"/>'
        : v === 4
          ? '<path d="M8.9 14.4c1.6 1.5 4.6 1.5 6.2 0"/>'
          : '<path d="M8.6 14.1c1.8 2.3 5 2.3 6.8 0"/><path d="M7.4 12.8c-.4 2.2.7 4.2 2.4 4.9M16.6 12.8c.4 2.2-.7 4.2-2.4 4.9"/>'
  return `<svg class="face-svg ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    ${eyes}${mouth}
  </svg>`
}

export function tagIcon(tag) {
  const icons = {
    screen: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.4"/><path d="M10.5 18.4h3"/>',
    caffeine: '<path d="M5 8.5h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5Z"/><path d="M16 10h1.4a2.3 2.3 0 0 1 0 4.6H16"/><path d="M7.5 3.5v2.2M11 3.5v2.2M14.5 3.5v2.2"/>',
    alcohol: '<path d="M6 4.5h12l-1.2 6.2A5 5 0 0 1 12 15a5 5 0 0 1-4.8-4.3L6 4.5Z"/><path d="M9 19.5h6M12 15v4.5"/>',
    lateMeal: '<path d="M4 4v6.5a2 2 0 0 0 4 0V4M6 4v16"/><path d="M15.5 20V10.2c0-3.2 1.4-5.7 3-6.2v16"/>',
    exercise: '<path d="M6.5 7.5v9M17.5 7.5v9M4 9.5v5M20 9.5v5M6.5 12h11"/>',
    stress: '<path d="M9 4.5a3 3 0 0 1 6 0v6l2.2-1a2.2 2.2 0 0 1 2.8 2.1v2.7a6.4 6.4 0 0 1-6.4 6.4h-1.2a6 6 0 0 1-4.6-2.2L4.7 15a2.1 2.1 0 0 1 3.2-2.7l1.1 1.3V4.5Z"/>',
    reading: '<path d="M4.2 5.4c2.6-.8 5.2-.4 7.8 1.3v13c-2.6-1.7-5.2-2.1-7.8-1.3v-13Z"/><path d="M19.8 5.4c-2.6-.8-5.2-.4-7.8 1.3v13c2.6-1.7 5.2-2.1 7.8-1.3v-13Z"/>',
    meditation: '<circle cx="12" cy="5.3" r="2.2"/><path d="M12 8.2v5.3M6.2 10.2l5.8 3.3 5.8-3.3M8.8 19.5 12 13.5l3.2 6M5.5 19.5h13"/>',
    shower: '<path d="M5 20V8.5A4.5 4.5 0 0 1 9.5 4H10"/><path d="M18 8.5a6 6 0 0 1 3 5.2H9a6 6 0 0 1 3-5.2"/><path d="M12 16.5v1M15 19v1.3M9 19v1.3M18 19v1.3M6 19v1.3"/>',
    nap: '<path d="M3.5 16.5h17v3h-17z"/><path d="M5.5 16.5v-6c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v6"/><path d="M13.5 16.5v-4c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v4"/><path d="M7 7.8h2.5L7 10.2h2.5M14.5 5h2.5l-2.5 2.4h2.5"/>',
  }
  return `<svg class="icon tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[tag] || P.sparkle}</svg>`
}

export function emptyArt(variant = 'moon') {
  if (variant === 'chart') {
    return `<svg class="empty-art" viewBox="0 0 220 132" fill="none" aria-hidden="true">
      <path d="M28 108h164" stroke="var(--line-strong)" stroke-linecap="round"/>
      <rect x="47" y="76" width="22" height="32" rx="8" fill="var(--accent-soft)"/>
      <rect x="85" y="54" width="22" height="54" rx="8" fill="var(--accent-soft)"/>
      <rect x="123" y="66" width="22" height="42" rx="8" fill="var(--accent-soft)"/>
      <rect x="161" y="38" width="22" height="70" rx="8" fill="var(--accent-soft)"/>
      <path d="M43 46c14-12 31-18 50-17 21 1 33 11 53 6 11-3 19-11 26-20" stroke="var(--line-strong)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 7"/>
      <circle cx="136" cy="28" r="3" fill="var(--accent)" opacity=".5"/>
    </svg>`
  }
  return `<svg class="empty-art" viewBox="0 0 220 132" fill="none" aria-hidden="true">
    <path d="M37 112c17-18 31-23 52-23 20 0 28 9 50 9 22 0 33-9 44-20" stroke="var(--line-strong)" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M138 24a27 27 0 1 0 22 41 22 22 0 0 1-22-41Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/>
    <circle cx="82" cy="44" r="2.4" fill="var(--accent)" opacity=".7"/>
    <circle cx="61" cy="66" r="1.5" fill="var(--accent)" opacity=".45"/>
    <path d="M156 78c.4 3.1 1.8 4.5 4.9 4.9-3.1.4-4.5 1.8-4.9 4.9-.4-3.1-1.8-4.5-4.9-4.9 3.1-.4 4.5-1.8 4.9-4.9Z" fill="var(--accent)" opacity=".6"/>
    <path d="M55 97c7-6 14-8 23-8 13 0 21 7 36 7" stroke="var(--line-strong)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 6"/>
  </svg>`
}
