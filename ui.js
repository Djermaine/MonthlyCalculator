/* Icons, Kategorie-Farben und Diagramme (reines SVG, keine Abhängigkeiten) */
(function (root) {
  'use strict';

  // ---------- Icons (24er-Raster, Kontur) ----------
  const P = {
    home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
    bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.5 12.5a9.5 9.5 0 0 1 13 0"/><path d="M8.7 16a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.3" r=".9" fill="currentColor"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.8-3.2 8-7.5 9.5-4.3-1.5-7.5-4.7-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    car: '<path d="M4.5 15.5v-3.2L6.6 7.4A2 2 0 0 1 8.4 6.2h7.2a2 2 0 0 1 1.8 1.2l2.1 4.9v3.2"/><rect x="3" y="12" width="18" height="5.5" rx="1.8"/><path d="M6 17.5V20M18 17.5V20"/><circle cx="7.3" cy="14.8" r=".9" fill="currentColor"/><circle cx="16.7" cy="14.8" r=".9" fill="currentColor"/>',
    fuel: '<path d="M4.5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16"/><path d="M3 21h12"/><path d="M4.5 10h9"/><path d="M13.5 8.5l3 2.5v6a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.2l4.5 2.8-4.5 2.8z" fill="currentColor"/>',
    cart: '<path d="M3 4h2.2l2.3 11h10.3L20 7.5H6.3"/><circle cx="9" cy="19.2" r="1.4"/><circle cx="16.8" cy="19.2" r="1.4"/>',
    vault: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="12" cy="12" r="3.6"/><path d="M12 8.4v1.2M12 14.4v1.2M8.4 12h1.2M14.4 12h1.2M6 19.5V21M18 19.5V21"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.4"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19M6 15h4"/>',
    bank: '<path d="M3 9.5L12 4l9 5.5"/><path d="M5 10v7.5M9.7 10v7.5M14.3 10v7.5M19 10v7.5"/><path d="M3 20.5h18"/>',
    bike: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5L9 9h6.5l3 7.5M9 9l3.2 7.5h-6.7M14 6h2.5l-1 3"/><path d="M13 6.5l1-2"/>',
    tv: '<rect x="3" y="6.5" width="18" height="12" rx="2.5"/><path d="M8.5 21.5h7M9 3l3 3.5L15 3"/>',
    doc: '<path d="M7 3h7l4.5 4.5V21H7z"/><path d="M14 3v4.5h4.5M10 12.5h5.5M10 16.5h5.5"/>',
    shirt: '<path d="M8.5 3.5L3.5 6.5l2 4 2.5-1V20.5h8V9.5l2.5 1 2-4-5-3a3.6 3.6 0 0 1-7 0z"/>',
    in: '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 20h14"/>',
    wallet: '<path d="M4 7.5V18a2 2 0 0 0 2 2h13.5V9.5H6a2 2 0 0 1-2-2zm0 0A2 2 0 0 1 6 5.5h11V9.5"/><circle cx="16" cy="14.7" r="1.2" fill="currentColor"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7M3 12.5h18"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M2.5 9h19M12 9v11.5M12 9c-1.5-4-6-4-5.5-1.5S12 9 12 9zm0 0c1.5-4 6-4 5.5-1.5S12 9 12 9z"/>',
    food: '<path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v5"/><path d="M17 21V3c-2.2 1-3.5 3.5-3.5 7v3H17"/>',
    kitchen: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 10h16M8 6.5h1.5M8 13.5v3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M21.5 20h-19"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.1" fill="currentColor"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor"/><circle cx="4.5" cy="18" r="1.1" fill="currentColor"/>',
    save: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4 16v3.5h16V16"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6"/><circle cx="12" cy="17" r=".9" fill="currentColor"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  };

  // Kategorie → [Farbe, Icon]
  const CAT = {
    'Wohnen': ['#5b6cf0', 'home'], 'Energie': ['#f0a020', 'bolt'], 'Kommunikation': ['#11a9b8', 'phone'],
    'Versicherung': ['#3b82f6', 'shield'], 'Mobilität': ['#f06a35', 'car'], 'Abos & Freizeit': ['#e0509a', 'star'],
    'Lebenshaltung': ['#1fa36a', 'cart'], 'Rücklage': ['#8b5cf6', 'vault'], 'Sonstiges': ['#8a8f98', 'tag'],
    'Rate': ['#e5484d', 'card'], 'Bank & Zinsen': ['#9f1239', 'bank'], 'Einnahme': ['#16a34a', 'in'], 'Gehalt': ['#0ea5e9', 'briefcase'], 'Sonder': ['#16a34a', 'gift'],
  };
  const KW = [
    [/dispo|zins|kontoführ/i, 'bank'],
    [/tank|sprit|benzin|diesel|laden/i, 'fuel'], [/lebensmittel|drogerie|einkauf|supermarkt|rewe|edeka|aldi|lidl/i, 'cart'],
    [/restaurant|essen gehen|imbiss|lieferando|kantine/i, 'food'], [/miete|wohnung/i, 'home'], [/strom|gas|heiz/i, 'bolt'],
    [/internet|wlan|dsl|glasfaser|flatrate/i, 'wifi'], [/handy|iphone|smartphone|mobilfunk/i, 'phone'], [/spotify|musik|music/i, 'music'],
    [/netflix|disney|prime|dazn|youtube|video/i, 'play'], [/rundfunk|gez/i, 'tv'], [/steuer/i, 'doc'], [/versicher|haftpflicht|hausrat/i, 'shield'],
    [/kredit|darlehen/i, 'bank'], [/e-?bike|fahrrad|rad\b/i, 'bike'], [/küche/i, 'kitchen'], [/kleidung|mode|schuhe/i, 'shirt'],
    [/freizeit|ausgehen|kino|hobby/i, 'star'], [/sparrate|rücklage|sparen/i, 'vault'], [/gehalt|lohn/i, 'briefcase'], [/kfz|auto|werkstatt/i, 'car'],
    [/beteiligung|erstattung/i, 'wallet'],
  ];
  const EXTRA = ['#0f9d8a', '#c2410c', '#7c3aed', '#be185d', '#0369a1', '#4d7c0f', '#b45309', '#475569'];
  const hash = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };

  function visual(kat, bez) {
    const c = CAT[kat] || [EXTRA[hash(kat || bez || '') % EXTRA.length], 'tag'];
    let icon = c[1];
    for (const [re, i] of KW) if (re.test(bez || '')) { icon = i; break; }
    return { color: c[0], icon };
  }
  const catColor = (kat) => (CAT[kat] ? CAT[kat][0] : EXTRA[hash(kat || '') % EXTRA.length]);
  const svg = (name, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || P.tag}</svg>`;
  const icon = (v, cls = '') => `<span class="ic ${cls}" style="--c:${v.color}">${svg(v.icon)}</span>`;

  // ---------- Diagramme ----------
  const fx = (n) => n.toFixed(1);

  // Ring-/Donut-Diagramm. segs: [{v, color}]
  function donut(segs, size = 180, stroke = 18, center = '') {
    const total = segs.reduce((a, s) => a + Math.max(0, s.v), 0) || 1;
    const r = (size - stroke) / 2, C = 2 * Math.PI * r, gap = segs.length > 1 ? Math.min(3, C * 0.006) : 0;
    let off = 0, out = '';
    for (const s of segs) {
      const len = (Math.max(0, s.v) / total) * C;
      const vis = Math.max(0.01, len - gap);
      out += `<circle cx="${size / 2}" cy="${size / 2}" r="${fx(r)}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${fx(vis)} ${fx(C - vis)}" stroke-dashoffset="${fx(-off)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
      off += len;
    }
    return `<div class="donut" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${fx(r)}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>${out}</svg><div class="donut-c">${center}</div></div>`;
  }

  // Fortschrittsring 0..1
  function ring(p, color, size = 64, stroke = 7, center = '', marker = null) {
    const r = (size - stroke) / 2, C = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p)) * C;
    let mk = '';
    if (marker != null) {
      const a = Math.max(0, Math.min(1, marker)) * 2 * Math.PI - Math.PI / 2;
      mk = `<circle class="mk" cx="${fx(size / 2 + r * Math.cos(a))}" cy="${fx(size / 2 + r * Math.sin(a))}" r="${fx(stroke / 2 + 1)}" fill="var(--card)" stroke="var(--text)" stroke-width="1.6"/>`;
    }
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${fx(r)}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${fx(r)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${fx(v)} ${fx(C)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${mk}</svg><div class="ring-c">${center}</div></div>`;
  }

  // Säulen. items: [{label, v, key, on}] – positive grün, negative rot; antippbar via data-act/data-m
  function bars(items, { act = 'mon-set', fmt = (v) => v } = {}) {
    const W = 340, H = 160, T = 26, B = 20, n = items.length, bw = (W / n) * 0.62;
    const hi = Math.max(0, ...items.map((i) => i.v)), lo = Math.min(0, ...items.map((i) => i.v));
    const span = hi - lo || 1, y = (v) => T + ((hi - v) * (H - T - B)) / span;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="bars">`;
    s += `<line x1="0" x2="${W}" y1="${fx(y(0))}" y2="${fx(y(0))}" stroke="var(--line)"/>`;
    items.forEach((it, i) => {
      const cx = (i + 0.5) * (W / n), top = Math.min(y(it.v), y(0)), hgt = Math.max(2, Math.abs(y(it.v) - y(0)));
      const col = it.v >= 0 ? 'var(--pos)' : 'var(--neg)';
      s += `<g data-act="${act}" data-m="${it.key}" style="cursor:pointer"><rect x="${fx(cx - W / n / 2)}" y="0" width="${fx(W / n)}" height="${H}" fill="transparent"/>
        <rect x="${fx(cx - bw / 2)}" y="${fx(top)}" width="${fx(bw)}" height="${fx(hgt)}" rx="4" fill="${col}" opacity="${it.on ? 1 : 0.38}"/>
        <text x="${fx(cx)}" y="${H - 5}" text-anchor="middle" class="${it.on ? 'on' : ''}">${it.label}</text>
        ${it.on ? `<text x="${fx(cx)}" y="${fx(top - 5)}" text-anchor="${i < 2 ? 'start' : i > n - 3 ? 'end' : 'middle'}" class="val">${fmt(it.v)}</text>` : ''}</g>`;
    });
    return s + '</svg>';
  }

  // Flächen-/Liniendiagramm. pts: [[x, y]], opts: limit (rote Linie), labels: [[x, text]], mark: [x, text]
  function area(pts, { limit = null, limitLabel = '', xLabels = [], mark = null, step = false, color = 'var(--accent)', id = 'a' } = {}) {
    if (pts.length < 2) return '';
    const W = 340, H = 170, L = 4, R = 4, T = 22, B = 20;
    const xs = pts.map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const ys = pts.map((p) => p[1]).concat(limit != null ? [limit] : []);
    let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * 0.1 || 50; lo -= pad; hi += pad;
    const X = (v) => L + ((v - x0) * (W - L - R)) / (x1 - x0 || 1), Y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    let d = '';
    pts.forEach((p, i) => { d += i === 0 ? `M${fx(X(p[0]))},${fx(Y(p[1]))}` : step ? `H${fx(X(p[0]))}V${fx(Y(p[1]))}` : `L${fx(X(p[0]))},${fx(Y(p[1]))}`; });
    const base = fx(H - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="area"><defs><linearGradient id="gr-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
    for (let k = 1; k <= 3; k++) { const gy = T + (k * (H - T - B)) / 4; s += `<line x1="${L}" x2="${W - R}" y1="${fx(gy)}" y2="${fx(gy)}" stroke="var(--line)" stroke-dasharray="2 4"/>`; }
    s += `<path d="${d}V${base}H${fx(X(pts[0][0]))}Z" fill="url(#gr-${id})"/>`;
    if (limit != null) s += `<line x1="${L}" x2="${W - R}" y1="${fx(Y(limit))}" y2="${fx(Y(limit))}" stroke="var(--neg)" stroke-width="1.3" stroke-dasharray="5 4"/><text x="${W - R}" y="${fx(Y(limit) + 13)}" text-anchor="end" class="lim">${limitLabel}</text>`;
    s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const [xv, t, anchor] of xLabels) s += `<text x="${fx(X(xv))}" y="${H - 4}" text-anchor="${anchor || 'middle'}">${t}</text>`;
    if (mark) {
      const [mx, my, t] = mark, cx = X(mx), cy = Y(my);
      s += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="5" fill="${color}" stroke="var(--card)" stroke-width="2.5"/>
        <text x="${fx(Math.min(W - R, Math.max(L, cx)))}" y="${fx(cy - 10)}" text-anchor="${cx > W * 0.7 ? 'end' : cx < W * 0.3 ? 'start' : 'middle'}" class="val">${t}</text>`;
    }
    return s + '</svg>';
  }

  // Gestapelter Balken. segs: [{v, color}]
  const stack = (segs) => {
    const t = segs.reduce((a, s) => a + Math.max(0, s.v), 0) || 1;
    return `<div class="stack">${segs.filter((s) => s.v > 0).map((s) => `<i style="width:${((s.v / t) * 100).toFixed(2)}%;background:${s.color}"></i>`).join('')}</div>`;
  };

  root.UI = { visual, icon, svg, catColor, donut, ring, bars, area, stack, CAT };
})(typeof self !== 'undefined' ? self : this);
