/* Mtl. Kosten – App */
(function () {
  'use strict';
  const E = window.Engine;
  const { fmt, D, iso, ymd, som, edate } = E;
  const KEY = 'mtlkosten.v1';
  const $ = (sel, el = document) => el.querySelector(sel);
  const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num = (v) => (v === '' || v == null || isNaN(+v) ? 0 : +v);

  // ---------- Formatierung ----------
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const p2 = (n) => String(n).padStart(2, '0');
  const fd = (n) => { if (n == null) return '–'; const a = ymd(n); return `${p2(a.d)}.${p2(a.m)}.${a.y}`; };
  const fds = (n) => { const a = ymd(n); return `${WD[E.weekday(n)]}, ${p2(a.d)}.${p2(a.m)}.`; };
  const fm = (n) => { const a = ymd(n); return `${MON[a.m - 1]} ${a.y}`; };
  const fms = (n) => { const a = ymd(n); return `${MON[a.m - 1].slice(0, 3)} ${String(a.y).slice(2)}`; };
  const fmy = (n) => { const a = ymd(n); return `${p2(a.m)}/${a.y}`; };
  const sign = (v) => (v > 0.004 ? 'pos' : v < -0.004 ? 'neg' : '');
  const money = (v, cls = true) => `<span class="num ${cls ? sign(v) : ''}">${fmt(v)}</span>`;
  const plus = (v) => (v > 0.004 ? '+' : '') + fmt(v);
  const parseMoney = (s) => {
    s = String(s ?? '').replace(/[€\s]/g, '').replace(/−/g, '-');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const v = parseFloat(s); return isNaN(v) ? null : Math.round(v * 100) / 100;
  };
  const moneyIn = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));

  // ---------- Zustand ----------
  let S = load();
  let C = null;                      // Rechenergebnis
  const ui = { tab: 'jetzt', monat: null, posten: 'kosten', mehr: null, zeigeErledigt: false, lastKat: localStorage.getItem(KEY + '.lastKat') || null };

  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.app === 'mtl-kosten' ? s : null; } catch { return null; } }
  function persist() { localStorage.setItem(KEY, JSON.stringify(S)); }
  function commit(msg, undo) { persist(); render(); if (msg) toast(msg, undo); }
  function snapshot() { return JSON.stringify(S); }
  function restoreFn(snap) { return () => { S = JSON.parse(snap); persist(); render(); }; }

  function emptyState() {
    return {
      app: 'mtl-kosten', version: 1,
      konto: { stand: 0, datum: iso(E.todayNum()), dispo: 0, gehaltstag: 28, puffer: 0 },
      budgetModus: 'erfasst', planStart: iso(som(E.todayNum())), topfStart: 0,
      kategorien: ['Wohnen', 'Energie', 'Kommunikation', 'Versicherung', 'Mobilität', 'Abos & Freizeit', 'Lebenshaltung', 'Rücklage', 'Sonstiges'],
      gehalt: [], einnahmen: [], sonder: [], kosten: [], raten: [], buchungen: [],
    };
  }
  function normalize(s) {
    const base = emptyState();
    for (const k of Object.keys(base)) if (s[k] == null) s[k] = base[k];
    for (const list of ['gehalt', 'einnahmen', 'sonder', 'kosten', 'raten', 'buchungen']) for (const x of s[list]) if (!x.id) x.id = uid();
    s.app = 'mtl-kosten';
    return s;
  }

  // ---------- Icons ----------
  const I = {
    jetzt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
    monat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20V11M10 20V5M15 20v-7M20 20V8"/></svg>',
    posten: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/></svg>',
    mehr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="16" cy="12" r="1" fill="currentColor"/></svg>',
    add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  };

  // ---------- Rendering ----------
  function render() {
    if (!S) { $('#tabbar').classList.add('hidden'); $('#view').innerHTML = viewWelcome(); return; }
    $('#tabbar').classList.remove('hidden');
    C = E.compute(S);
    if (ui.monat == null) ui.monat = defaultMonat();
    const v = { jetzt: viewJetzt, monat: viewMonat, posten: viewPosten, mehr: viewMehr }[ui.tab]();
    $('#view').innerHTML = v;
    for (const b of document.querySelectorAll('#tabbar [data-tab]')) b.classList.toggle('on', b.dataset.tab === ui.tab);
  }

  // Aktueller Monat, aber nicht vor dem Planungsstart
  function defaultMonat() { return Math.max(som(C.today), C.plan[0].m); }

  function viewWelcome() {
    return `<div class="welcome">
      <img class="logo" src="icons/icon-192.png" alt="">
      <h1>Mtl. Kosten</h1>
      <p>Dein Excel-Sheet als App. Importiere deine Daten (JSON-Datei) oder starte leer.</p>
      <button class="btn" data-act="import-file">Daten importieren …</button>
      <button class="btn sec" data-act="import-paste">Aus Zwischenablage einfügen</button>
      <button class="btn sec" data-act="start-empty">Leer starten</button>
    </div>`;
  }

  // ----- Tab: Jetzt -----
  function viewJetzt() {
    const K = C.K;
    let out = `<div class="top"><h1>Konto jetzt</h1><button class="pill" data-act="konto">Kontostand</button></div>`;
    if (K.veraltet > 0) out += `<button class="banner warn" data-act="konto">⚠ <span>Kontostand ist <b>${K.veraltet} ${K.veraltet === 1 ? 'Tag' : 'Tage'} alt</b> – tippen zum Aktualisieren</span></button>`;
    const neg = K.KFrei < 0;
    out += `<section class="hero">
      <div class="label">Frei bis zum Gehalt · nach Puffer</div>
      <div class="big num ${neg ? 'neg' : ''}">${fmt(K.KFrei)}</div>
      <div class="sub">${neg ? 'Dispo-Grenze würde überschritten' : `≈ ${fmt(K.proTag)} pro Tag`} · noch ${K.tageBisGehalt} ${K.tageBisGehalt === 1 ? 'Tag' : 'Tage'} · Gehalt ${fds(K.ZEnde)}</div>
    </section>`;
    if (K.KBudgetRest > K.KFrei + 0.004) out += `<div class="banner bad" style="margin-top:10px">⚠ Budgets (${fmt(K.KBudgetRest)}) passen nicht rein – es fehlen ${fmt(K.KBudgetRest - K.KFrei)}</div>`;
    out += `<div class="grid2">
      <div class="tile"><div class="l">Rest nach Budgets</div><div class="v">${money(K.KRest)}</div><div class="s">Budgets noch ${fmt(K.KBudgetRest)}</div></div>
      <button class="tile" data-act="konto"><div class="l">Kontostand</div><div class="v">${money(K.KStand)}</div><div class="s">vom ${fd(K.KDatum)}</div></button>
    </div>`;

    // Budgets
    const bl = K.budgetListe.filter((b) => b.budget > 0 || b.ausgegeben > 0);
    out += `<h2>Budgets im Gehaltszyklus <button data-act="add">+ Ausgabe</button></h2><div class="card">`;
    if (!bl.length) out += `<div class="empty">Keine variablen Budgets angelegt (Posten → Kosten, Typ „Variabel“).</div>`;
    for (const b of bl) {
      const pct = b.budget > 0 ? Math.min(100, (b.ausgegeben / b.budget) * 100) : 100;
      const over = b.rest < -0.004;
      out += `<button class="row tap" data-act="add" data-kat="${h(b.id)}"><div class="main">
        <div class="t" style="display:flex;justify-content:space-between;gap:8px"><span>${h(b.bez)}</span><span class="num ${over ? 'neg' : ''}" style="font-weight:600">${over ? 'über ' + fmt(-b.rest) : 'noch ' + fmt(b.rest)}</span></div>
        <div class="bar"><i class="${over ? 'over' : ''}" style="width:${pct}%"></i></div>
        <div class="s">${fmt(b.ausgegeben)} von ${fmt(b.budget)} ausgegeben</div></div></button>`;
    }
    out += `</div><div class="foot">Seit ${fds(K.ZStart)} erfasst. ${S.budgetModus === 'anteilig' ? 'Modus „anteilig“: Restbudget wird nach verbleibenden Tagen berechnet (wie Excel).' : 'Restbudget = Budget minus erfasste Ausgaben.'}</div>`;

    // Bis zum Gehalt
    const abst = K.KMin + K.KDispo;
    out += `<h2>Bis zum Gehalt am ${fds(K.ZEnde)}</h2><div class="card">
      <div class="kv"><span class="k">Noch offene Abbuchungen</span><span class="v">${money(K.KOffenAus)}</span></div>
      <div class="kv"><span class="k">Noch offene Eingänge</span><span class="v">${money(K.KOffenEin)}</span></div>
      <div class="kv total"><span class="k">Kontostand vor Gehalt<small>ohne Budgets · mit Budgets ${fmt(K.KVorGehalt - K.KBudgetRest)}</small></span><span class="v">${money(K.KVorGehalt)}</span></div>
      <div class="kv"><span class="k">Tiefster Stand inkl. Budgets<small>am ${fds(K.KMinDatum)} · Abstand zur Grenze ${fmt(abst)}</small></span><span class="v">${money(K.KMin)}</span></div>
      <div class="kv"><span class="k">Worst Case<small>Eingänge bleiben aus, Budgets werden ausgegeben</small></span><span class="v">${money(K.KWorst)}</span></div>
      <div class="kv"><span class="k">Dispo-Grenze${K.KPuffer ? `<small>Puffer ${fmt(K.KPuffer)}</small>` : ''}</span><span class="v">${money(-K.KDispo)}</span></div>
    </div>`;
    if (K.KFreiSicher < 0) out += `<div class="banner warn" style="margin-top:10px">⚠ Im Worst Case wird die Grenze um ${fmt(-K.KFreiSicher)} überschritten</div>`;
    if (C.naechstesGehalt) out += `<div class="foot">Erwartetes Gehalt am ${fds(K.ZEnde)}: ${fmt(C.naechstesGehalt)}</div>`;
    const A = C.ausblick;
    if (A) {
      const cls = A.status === 'ok' ? 'good' : A.status === 'knapp' ? 'warn' : 'bad';
      const txt = A.status === 'ok' ? `✔ Grenze wird in 12 Monaten nicht erreicht – tiefster Stand ${fmt(A.min)} (${fms(A.monat)})`
        : A.status === 'knapp' ? `⚠ Knapp: tiefster Stand ${fmt(A.min)} im ${fm(A.monat)}` : `⚠ Dispo-Grenze wird überschritten – tiefster Stand ${fmt(A.min)} im ${fm(A.monat)}`;
      out += `<button class="banner ${cls}" style="margin-top:10px" data-act="go-monat">${txt}</button>`;
    }

    // Buchungen
    const rows = K.rows.filter((r) => ui.zeigeErledigt || r.status !== 'erledigt');
    const nErl = K.rows.length - K.rows.filter((r) => r.status !== 'erledigt').length;
    out += `<h2>Buchungen im Zyklus ${nErl ? `<button data-act="toggle-erledigt">${ui.zeigeErledigt ? 'Erledigte ausblenden' : `+ ${nErl} erledigte`}</button>` : ''}</h2><div class="card">`;
    if (!rows.length) out += `<div class="empty">Keine offenen Buchungen bis zum Gehalt.</div>`;
    for (const r of rows) {
      const a = ymd(r.d), erl = r.status === 'erledigt';
      const sub = [r.status === 'vorgemerkt' ? '<span class="tag acc">vorgemerkt</span>' : erl ? '<span class="tag">✔ erledigt</span>' : '', r.verschoben ? `<span class="tag warn">verschoben von ${fds(r.nd)}</span>` : ''].filter(Boolean).join(' ');
      out += `<div class="row ${erl ? 'dim' : ''} ${r.src === 'buchung' ? 'tap' : ''}" ${r.src === 'buchung' ? `data-act="edit" data-ent="buchungen" data-id="${h(r.id)}"` : ''}>
        <div class="date"><b>${a.d}</b><span>${WD[E.weekday(r.d)]}</span></div>
        <div class="main"><div class="t">${h(r.name)}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>
        <div class="r"><div class="num ${r.a > 0 ? 'pos' : ''}" style="font-weight:600">${plus(r.a)}</div>${r.run != null ? `<div class="s num">→ ${fmt(r.run)}</div>` : ''}</div></div>`;
    }
    out += `</div><div class="foot">„→“ = Kontostand danach inkl. Budgets (gleichmäßig pro Tag verteilt). Buchungen mit Datum ≤ „Stand vom“ gelten als erledigt; vorgemerkte zählen, solange ihr Datum ≥ „Stand vom“ ist.</div>`;
    return out;
  }

  // ----- Tab: Monat -----
  function viewMonat() {
    const m = ui.monat;
    const r = C.plan.find((x) => x.m === m);
    const val = `${ymd(m).y}-${p2(ymd(m).m)}`;
    let out = `<div class="top"><h1>Übersicht</h1><button class="pill" data-act="mehr" data-v="plan">Planung</button></div>
      <div class="monthnav"><button class="arrow" data-act="mon" data-d="-1">‹</button>
      <div class="lbl">${fm(m)}<input type="month" value="${val}" data-act="mon-pick"></div>
      <button class="arrow" data-act="mon" data-d="1">›</button></div>`;
    if (!r) return out + `<div class="card"><div class="empty">Monat liegt außerhalb der Planung (Start ${fm(som(D(S.planStart)))}, 8 Jahre).</div></div>`;
    const tp = C.topf.rows.find((x) => x.m === m);
    out += `<div class="grid2" style="margin-top:0">
      <div class="tile"><div class="l">Einnahmen</div><div class="v num">${fmt(r.einnahmen)}</div><div class="s">davon Gehalt ${fmt(r.gehalt)}</div></div>
      <div class="tile"><div class="l">Ausgaben (Giro)</div><div class="v num">${fmt(r.ausgaben)}</div><div class="s">davon Raten ${fmt(r.raten)}</div></div>
      <div class="tile"><div class="l">Frei verfügbar</div><div class="v">${money(r.frei)}</div><div class="s">ggü. Vormonat ${plus(r.veraenderung)}</div></div>
      <button class="tile" data-act="mehr" data-v="topf"><div class="l">Rücklagen-Topf</div><div class="v">${money(tp.stand)}</div><div class="s">${C.topf.diff < 0 ? '⚠ Sparrate zu niedrig' : '✔ Sparrate reicht'}</div></button>
    </div>`;
    if (r.kontoVorGehalt != null) out += `<div class="card pad" style="margin-top:10px;display:flex;justify-content:space-between"><span class="muted">Kontostand vor Gehalt (Prognose)</span><b>${money(r.kontoVorGehalt)}</b></div>`;
    if (r.ereignisse.length) out += `<div class="events">${r.ereignisse.map((e) => `<div class="banner good" style="margin:0">★ ${h(e)}</div>`).join('')}</div>`;

    const posten = E.monatsPosten(C.P, m);
    out += `<h2>Ausgaben im Monat</h2><div class="card">`;
    if (!posten.length) out += `<div class="empty">Keine Ausgaben.</div>`;
    for (const p of posten) out += `<div class="row"><div class="main"><div class="t">${h(p.bez)}</div><div class="s">${h(p.kat)}${p.typ === 'Variabel' ? ' · Budget' : ''}</div></div><div class="r num">${fmt(p.betrag)}</div></div>`;
    out += `</div>`;

    // Erfasste Ausgaben im Kalendermonat
    const mEnd = E.eomonth(m, 0);
    const erf = S.buchungen.filter((b) => { const d = D(b.datum); return d >= m && d <= mEnd; });
    if (erf.length) {
      const byKat = {};
      for (const b of erf) { const k = b.kat || '_'; byKat[k] = (byKat[k] || 0) + num(b.betrag); }
      out += `<h2>Erfasste Buchungen im ${MON[ymd(m).m - 1]}</h2><div class="card">`;
      for (const [k, v] of Object.entries(byKat).sort((a, b) => b[1] - a[1])) {
        const kb = C.P.kosten.find((x) => x.id === k);
        out += `<div class="kv"><span class="k">${h(kb ? kb.bez : 'Ohne Budget')}${kb ? `<small>Budget ${fmt(kb.proMonat)}</small>` : ''}</span><span class="v num">${fmt(v)}</span></div>`;
      }
      out += `</div>`;
    }

    // Prognose-Chart
    const pts = C.plan.filter((x) => x.kontoVorGehalt != null).slice(0, 24);
    if (pts.length > 1) out += `<h2>Kontostand vor Gehalt – 24 Monate</h2><div class="card chart">${lineChart(pts.map((x) => [x.m, x.kontoVorGehalt]), -C.K.KDispo, m)}</div>`;

    // Raten-Ende
    const re = C.P.raten.filter((x) => x.letzte != null).sort((a, b) => a.letzte - b.letzte);
    if (re.length) {
      out += `<h2>Wann bleibt mehr übrig?</h2><div class="card">`;
      for (const x of re) {
        const pr = C.plan.find((p) => p.m === x.mehrFreiAb);
        out += `<button class="row tap" data-act="mon-set" data-m="${x.mehrFreiAb}"><div class="main"><div class="t">${h(x.bez)}</div><div class="s">bis ${fmy(x.letzte)} · mehr frei ab ${fms(x.mehrFreiAb)}</div></div>
          <div class="r"><div class="num pos" style="font-weight:600">+${fmt(num(x.rate))}</div><div class="s">${pr ? 'dann frei ' + fmt(pr.frei) : ''}</div></div></button>`;
      }
      out += `</div>`;
    }
    return out;
  }

  function lineChart(pts, limit, mark) {
    const W = 340, H = 170, L = 8, R = 8, T = 12, B = 22;
    const vals = pts.map((p) => p[1]).concat([limit, 0]);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.08 || 100; lo -= pad; hi += pad;
    const x = (i) => L + (i * (W - L - R)) / (pts.length - 1), y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    const area = `${path}L${x(pts.length - 1).toFixed(1)},${(H - B).toFixed(1)}L${x(0).toFixed(1)},${(H - B).toFixed(1)}Z`;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Prognose Kontostand">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#g)"/>`;
    s += `<line x1="${L}" x2="${W - R}" y1="${y(limit)}" y2="${y(limit)}" stroke="var(--neg)" stroke-dasharray="4 3" stroke-width="1.2"/>
      <text x="${W - R}" y="${y(limit) - 4}" text-anchor="end" style="fill:var(--neg)">Dispo-Grenze ${fmt(limit)}</text>`;
    if (0 < hi && 0 > lo) s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)" stroke-width="1"/><text x="${L}" y="${y(0) - 4}">0 €</text>`;
    s += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p, i) => {
      if (p[0] === mark) s += `<circle cx="${x(i)}" cy="${y(p[1])}" r="4.5" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>`;
      if (i % 6 === 0 || i === pts.length - 1) s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${fms(p[0])}</text>`;
    });
    const last = pts[pts.length - 1];
    s += `<text x="${W - R}" y="${y(last[1]) - 8}" text-anchor="end" style="fill:var(--text);font-weight:600">${fmt(last[1])}</text></svg>`;
    return s;
  }

  // ----- Tab: Posten -----
  function viewPosten() {
    const t = ui.posten;
    let out = `<div class="top"><h1>Posten</h1><button class="pill" data-act="new" data-ent="${t === 'einnahmen' ? 'einnahmen' : t}">+ Neu</button></div>
      <div class="seg">${[['kosten', 'Kosten'], ['raten', 'Raten'], ['einnahmen', 'Einnahmen']].map(([k, l]) => `<button class="${t === k ? 'on' : ''}" data-act="posten-tab" data-v="${k}">${l}</button>`).join('')}</div>`;
    const today = C.today;
    if (t === 'kosten') {
      const groups = [
        ['Fixkosten · Girokonto', (k) => k.typ === 'Fixkosten' && k.ueber === 'Girokonto'],
        ['Fixkosten · über Sparkonto (Topf)', (k) => k.typ === 'Fixkosten' && k.ueber !== 'Girokonto'],
        ['Rücklage', (k) => k.typ === 'Rücklage'],
        ['Variable Budgets', (k) => k.typ === 'Variabel'],
      ];
      for (const [title, f] of groups) {
        const items = C.P.kosten.filter(f);
        if (!items.length) continue;
        const sum = items.filter((k) => !(k.bis && k.bis < today)).reduce((a, k) => a + k.proMonat, 0);
        out += `<h2>${title}<span class="num" style="text-transform:none">Ø ${fmt(sum)}/Mon.</span></h2><div class="card">`;
        for (const k of items) {
          const ended = k.bis && k.bis < today;
          const det = [k.kat, k.rhythmus !== 'Monatlich' ? (k.rhythmus === 'Einmalig' ? 'einmalig ' + (k.von != null ? fd(k.von) : '') : `${k.rhythmus}${k.faellig ? ' ab ' + MON[k.faellig - 1].slice(0, 3) : ''}`) : '', k.tag ? `am ${k.tag}.` : '', ended ? 'beendet' : k.bis ? 'bis ' + fd(k.bis) : ''].filter(Boolean).join(' · ');
          out += `<button class="row tap chev ${ended ? 'dim' : ''}" data-act="edit" data-ent="kosten" data-id="${h(k.id)}"><div class="main"><div class="t">${h(k.bez)}</div><div class="s">${h(det)}</div></div><div class="r num">${fmt(num(k.betrag))}${k.iv > 1 ? `<div class="s">Ø ${fmt(k.proMonat)}</div>` : ''}</div></button>`;
        }
        out += `</div>`;
      }
      if (!C.P.kosten.length) out += `<div class="card"><div class="empty">Noch keine Kosten.</div></div>`;
    } else if (t === 'raten') {
      const rs = C.P.raten;
      const aktiv = rs.filter((r) => r.offen > 0);
      out += `<div class="grid2" style="margin-top:0"><div class="tile"><div class="l">Monatsraten (aktiv)</div><div class="v num">${fmt(aktiv.reduce((a, r) => a + num(r.rate), 0))}</div></div>
        <div class="tile"><div class="l">Noch zu zahlen</div><div class="v num">${fmt(rs.reduce((a, r) => a + r.rest, 0))}</div></div></div><h2>Raten & Kredite</h2><div class="card">`;
      if (!rs.length) out += `<div class="empty">Noch keine Raten.</div>`;
      for (const r of rs) {
        const done = r.offen <= 0;
        out += `<button class="row tap chev" data-act="edit" data-ent="raten" data-id="${h(r.id)}"><div class="main">
          <div class="t" style="display:flex;justify-content:space-between;gap:8px"><span>${h(r.bez)} <span class="muted" style="font-size:13px">${h(r.anbieter || '')}</span></span><span class="num" style="font-weight:600">${fmt(num(r.rate))}</span></div>
          <div class="bar"><i class="${done ? 'done' : ''}" style="width:${Math.round(r.fortschritt * 100)}%"></i></div>
          <div class="s">${done ? '✔ abbezahlt' : `noch ${r.offen} von ${num(r.gesamt)} Raten · Rest ${fmt(r.rest)} · bis ${r.letzte != null ? fmy(r.letzte) : '–'}`}</div></div></button>`;
      }
      out += `</div><div class="foot">„Bereits bezahlt“ = Anzahl Raten vor der nächsten Abbuchung. Enddatum, Rest und Fortschritt rechnen sich mit dem heutigen Datum selbst weiter.</div>`;
    } else {
      out += `<h2>Gehalt (netto) <button data-act="new" data-ent="gehalt">+ Neu</button></h2><div class="card">`;
      const gs = [...S.gehalt].sort((a, b) => (a.ab < b.ab ? 1 : -1));
      if (!gs.length) out += `<div class="empty">Noch kein Gehalt eingetragen.</div>`;
      const curG = [...S.gehalt].filter((g) => D(g.ab) <= C.today).sort((a, b) => (a.ab < b.ab ? 1 : -1))[0];
      for (const g of gs) out += `<button class="row tap chev" data-act="edit" data-ent="gehalt" data-id="${h(g.id)}"><div class="main"><div class="t">ab ${fd(D(g.ab))} ${g === curG ? '<span class="tag acc">aktuell</span>' : D(g.ab) > C.today ? '<span class="tag">künftig</span>' : ''}</div><div class="s">${g.brutto ? 'Brutto ' + fmt(num(g.brutto)) + ' · ' : ''}${h(g.notiz || '')}</div></div><div class="r num" style="font-weight:600">${fmt(num(g.netto))}</div></button>`;
      out += `</div><div class="foot">Es gilt immer die letzte Zeile, deren Datum erreicht ist. <a href="https://www.brutto-netto-rechner.info/" target="_blank" rel="noopener" style="color:var(--accent)">Brutto-Netto-Rechner</a></div>`;
      out += `<h2>Weitere Einnahmen <button data-act="new" data-ent="einnahmen">+ Neu</button></h2><div class="card">`;
      if (!C.P.einnahmen.length) out += `<div class="empty">Keine weiteren Einnahmen.</div>`;
      for (const e of C.P.einnahmen) {
        const ended = e.bis && e.bis < C.today;
        const rn = e.bisRate ? (C.P.raten.find((r) => r.id === e.bisRate) || {}).bez : null;
        out += `<button class="row tap chev ${ended ? 'dim' : ''}" data-act="edit" data-ent="einnahmen" data-id="${h(e.id)}"><div class="main"><div class="t">${h(e.bez)}</div><div class="s">${h(e.rhythmus)}${e.tag ? ` · am ${e.tag}.` : ''}${e.bis ? ` · bis ${fd(e.bis)}` : ''}${rn ? ` (endet mit ${h(rn)})` : ''}</div></div><div class="r num pos">${fmt(num(e.betrag))}</div></button>`;
      }
      out += `</div><h2>Sonderzahlungen <button data-act="new" data-ent="sonder">+ Neu</button></h2><div class="card">`;
      if (!S.sonder.length) out += `<div class="empty">z. B. Urlaubs-/Weihnachtsgeld – nur eintragen, wenn sicher.</div>`;
      for (const x of [...S.sonder].sort((a, b) => (a.monat > b.monat ? 1 : -1))) out += `<button class="row tap chev" data-act="edit" data-ent="sonder" data-id="${h(x.id)}"><div class="main"><div class="t">${h(x.bez || 'Sonderzahlung')}</div><div class="s">${fm(D(x.monat))}</div></div><div class="r num pos">${fmt(num(x.betrag))}</div></button>`;
      out += `</div>`;
    }
    return out;
  }

  // ----- Tab: Mehr -----
  function viewMehr() {
    const v = ui.mehr;
    if (v === 'topf') return viewTopf();
    if (v === 'plan') return viewPlan();
    if (v === 'buchungen') return viewBuchungen();
    if (v === 'einstellungen') return viewEinstellungen();
    if (v === 'backup') return viewBackup();
    if (v === 'hilfe') return viewHilfe();
    const lb = S.meta && S.meta.lastBackup ? Math.floor((Date.now() - S.meta.lastBackup) / 864e5) : null;
    const item = (k, t, s) => `<button class="row tap chev" data-act="mehr" data-v="${k}"><div class="main"><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div></button>`;
    return `<div class="top"><h1>Mehr</h1></div>
      ${lb == null || lb > 14 ? `<button class="banner warn" data-act="mehr" data-v="backup">💾 <span>${lb == null ? 'Noch keine Datensicherung' : `Letzte Sicherung vor ${lb} Tagen`} – jetzt sichern</span></button>` : ''}
      <div class="card">${item('topf', 'Rücklagen-Topf', `Stand Monatsende ${fmt(C.topf.rows[0] ? C.topf.rows[0].stand : 0)} · ${C.topf.diff < 0 ? '⚠ Sparrate zu niedrig' : '✔ Sparrate reicht'}`)}
      ${item('plan', 'Monatsplanung', '8 Jahre Vorschau')}
      ${item('buchungen', 'Alle Buchungen', `${S.buchungen.length} erfasst`)}</div>
      <div class="card">${item('einstellungen', 'Einstellungen', 'Dispo, Gehaltstag, Puffer, Kategorien')}
      ${item('backup', 'Datensicherung', lb == null ? 'Export / Import' : `zuletzt vor ${lb} ${lb === 1 ? 'Tag' : 'Tagen'}`)}
      ${item('hilfe', 'So funktioniert’s', '')}</div>`;
  }
  const backTop = (title, right = '') => `<div class="top"><div><button class="back" data-act="mehr" data-v="">‹ Mehr</button><h1>${title}</h1></div>${right}</div>`;

  function viewTopf() {
    const T = C.topf;
    let out = backTop('Rücklagen-Topf', `<button class="pill" data-act="einstellung" data-f="topfStart">Startbestand</button>`);
    const status = T.min < 0 ? ['bad', '⚠ Der Topf rutscht ins Minus – Sparrate erhöhen oder Startbestand einzahlen.'] : T.diff < 0 ? ['warn', '⚠ Sparrate liegt unter dem Jahresbedarf – auf Dauer reicht es nicht.'] : ['good', '✔ Die Sparrate deckt alle Zahlungen.'];
    out += `<div class="banner ${status[0]}">${status[1]}</div><div class="card">
      <div class="kv"><span class="k">Startbestand (${fms(som(D(S.planStart)))})</span><span class="v">${money(num(S.topfStart), false)}</span></div>
      <div class="kv"><span class="k">Jahresbedarf</span><span class="v num">${fmt(T.bedarf)}</span></div>
      <div class="kv"><span class="k">Nötige Sparrate / Monat</span><span class="v num">${fmt(T.noetig)}</span></div>
      <div class="kv"><span class="k">Aktuelle Sparrate / Monat</span><span class="v num">${fmt(T.ist)}</span></div>
      <div class="kv"><span class="k">Differenz / Monat</span><span class="v">${money(T.diff)}</span></div>
      <div class="kv total"><span class="k">Niedrigster Stand (12 Monate)</span><span class="v">${money(T.min)}</span></div></div>
      <h2>Verlauf</h2><div class="card"><table class="t"><thead><tr><th>Monat</th><th>Rein</th><th>Raus</th><th>Stand</th></tr></thead><tbody>`;
    for (const r of T.rows.slice(0, 36)) out += `<tr><td>${fms(r.m)}${r.details.length ? `<small>${h(r.details.map((d) => d[0]).join(', '))}</small>` : ''}</td><td>${fmt(r.einzahlung)}</td><td>${r.faellig ? fmt(-r.faellig) : '–'}</td><td class="${sign(r.stand)}"><b>${fmt(r.stand)}</b></td></tr>`;
    return out + `</tbody></table></div><div class="foot">Kosten mit „Bezahlt über: Sparkonto“ laufen über diesen Topf, die Sparrate (Typ „Rücklage“) füllt ihn.</div>`;
  }

  function viewPlan() {
    let out = backTop('Monatsplanung', `<button class="pill" data-act="einstellung" data-f="planStart">Start</button>`);
    out += `<div class="card"><table class="t"><thead><tr><th>Monat</th><th>Einn.</th><th>Ausg.</th><th>Frei</th><th>Konto v. G.</th></tr></thead><tbody>`;
    const cur = som(C.today);
    for (const r of C.plan) out += `<tr class="${r.m === cur ? 'cur' : ''}" data-act="mon-set" data-m="${r.m}"><td>${fms(r.m)}${r.ereignisse.length ? `<small>${h(r.ereignisse.join(' · '))}</small>` : ''}</td><td>${fmt(r.einnahmen)}</td><td>${fmt(r.ausgaben)}</td><td class="${sign(r.frei)}">${fmt(r.frei)}</td><td class="${r.kontoVorGehalt != null && r.kontoVorGehalt < -C.K.KDispo ? 'neg' : ''}">${r.kontoVorGehalt == null ? '' : fmt(r.kontoVorGehalt)}</td></tr>`;
    return out + `</tbody></table></div><div class="foot">Ausgaben = Fixkosten (Giro) + Raten + Rücklage + variable Budgets. Tippe auf einen Monat für die Details.</div>`;
  }

  function viewBuchungen() {
    let out = backTop('Buchungen', `<button class="pill" data-act="add">+ Neu</button>`);
    const list = [...S.buchungen].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
    if (!list.length) return out + `<div class="card"><div class="empty">Noch nichts erfasst. Tippe unten auf ＋.</div></div>`;
    let curM = null;
    const KD = C.K.KDatum;
    for (const b of list) {
      const d = D(b.datum), m = som(d);
      if (m !== curM) {
        if (curM != null) out += `</div>`;
        const sum = list.filter((x) => som(D(x.datum)) === m).reduce((a, x) => a + num(x.betrag), 0);
        out += `<h2>${fm(m)}<span class="num" style="text-transform:none">${fmt(sum)}</span></h2><div class="card">`; curM = m;
      }
      const kb = b.kat ? C.P.kosten.find((x) => x.id === b.kat) : null;
      const pending = !b.gebucht && d >= KD;
      out += `<button class="row tap" data-act="edit" data-ent="buchungen" data-id="${h(b.id)}"><div class="date"><b>${ymd(d).d}</b><span>${WD[E.weekday(d)]}</span></div>
        <div class="main"><div class="t">${h(b.bez || (kb ? kb.bez : 'Ausgabe'))}</div><div class="s">${kb ? h(kb.bez) : 'ohne Budget'}${pending ? ' · <span class="tag acc">offen</span>' : ''}</div></div>
        <div class="r num ${num(b.betrag) < 0 ? 'pos' : ''}" style="font-weight:600">${fmt(-num(b.betrag))}</div></button>`;
    }
    return out + `</div>`;
  }

  function viewEinstellungen() {
    const k = S.konto;
    const item = (f, t, v) => `<button class="row tap chev" data-act="einstellung" data-f="${f}"><div class="main"><div class="t">${t}</div></div><div class="r muted">${v}</div></button>`;
    return backTop('Einstellungen') + `<div class="card">
      ${item('dispo', 'Dispo-Rahmen', fmt(num(k.dispo)))}
      ${item('gehaltstag', 'Gehaltseingang am', `${k.gehaltstag}.`)}
      ${item('puffer', 'Sicherheitspuffer', fmt(num(k.puffer)))}</div><div class="foot">Gehaltstag: fällt er aufs Wochenende/Feiertag, zählt der Werktag davor. Der Puffer bleibt immer unangetastet.</div>
      <h2>Planung</h2><div class="card">
      ${item('planStart', 'Planungsstart', fm(som(D(S.planStart))))}
      ${item('topfStart', 'Topf-Startbestand', fmt(num(S.topfStart)))}
      ${item('budgetModus', 'Budget-Berechnung', S.budgetModus === 'anteilig' ? 'anteilig (wie Excel)' : 'nach Erfassung')}
      ${item('kategorien', 'Kategorien', S.kategorien.length)}</div>
      <div class="foot">Budget-Berechnung „nach Erfassung“: Restbudget = Monatsbudget minus deine erfassten Ausgaben im Gehaltszyklus. „Anteilig“: Budget wird nach verbleibenden Tagen gerechnet – wie im Excel.</div>`;
  }

  function viewBackup() {
    const lb = S.meta && S.meta.lastBackup ? new Date(S.meta.lastBackup).toLocaleString('de-DE') : 'noch nie';
    return backTop('Datensicherung') + `<div class="foot" style="margin:0 4px 12px">Deine Daten liegen nur auf diesem iPhone. Sichere regelmäßig (z. B. in iCloud Drive), dann kannst du jederzeit wiederherstellen. Letzte Sicherung: <b>${lb}</b></div>
      <button class="btn" data-act="export">Sicherung exportieren (JSON)</button>
      <button class="btn sec" data-act="export-csv">Buchungen als CSV (für Excel)</button>
      <h2>Wiederherstellen</h2>
      <button class="btn sec" data-act="import-file">Sicherung importieren …</button>
      <button class="btn sec" data-act="import-paste">Aus Zwischenablage einfügen</button>
      <h2>Gefahrenzone</h2>
      <button class="btn danger" data-act="reset">Alle Daten löschen</button>`;
  }

  function viewHilfe() {
    const p = [
      '<b>Unterwegs:</b> Auf ＋ tippen, Betrag eingeben, Budget wählen, fertig. Die Ausgabe zählt sofort als vorgemerkt und verringert „Frei bis zum Gehalt“ und das Budget.',
      '<b>Kontostand aktualisieren:</b> Kontostand laut Bank (Minus-Schalter bei negativem Stand) + Datum. Erfasste Ausgaben mit älterem Datum fallen dann automatisch raus – sie sind ja schon im Kontostand. Für Ausgaben von heute, die schon gebucht sind: in der Buchung „Schon im Kontostand“ einschalten.',
      '<b>Frei bis zum Gehalt</b> = was du bis zum nächsten Gehalt für Essen, Tanken & Co. ausgeben kannst, ohne die Dispo-Grenze (minus Puffer) zu reißen – auch wenn du alles sofort ausgibst.',
      '<b>Neue Kosten:</b> Posten → Kosten → + Neu. Vierteljährlich/Halbjährlich/Jährlich: „Fällig im Monat“ = Monat der (ersten) Abbuchung. Einmalig: Datum bei „Gültig ab“.',
      '<b>Vertrag gekündigt?</b> „Gültig bis“ eintragen statt zu löschen – die Vorschau stimmt dann weiterhin.',
      '<b>Neue Rate:</b> Posten → Raten. Monatsrate, Raten gesamt, bereits bezahlt, nächste Abbuchung – der Rest rechnet sich.',
      '<b>Bezahlt über Sparkonto</b> = läuft über den Rücklagen-Topf, nicht übers Girokonto.',
      '<b>Gehalt geändert?</b> Posten → Einnahmen → Gehalt → + Neu mit „Gültig ab“.',
      '<b>Feiertage</b> (bundesweit) werden automatisch für jedes Jahr berechnet – Buchungen am Wochenende/Feiertag werden auf den nächsten Werktag verschoben.',
    ];
    return backTop('So funktioniert’s') + `<div class="card pad">${p.map((x) => `<p style="margin:0 0 12px">${x}</p>`).join('')}</div>`;
  }

  // ---------- Formulare ----------
  const RH = Object.keys(E.RHYTHMUS);
  const SCHEMA = {
    kosten: { title: 'Kosten', fields: () => [
      ['bez', 'Bezeichnung', 'text'], ['betrag', 'Betrag', 'money'], ['kat', 'Kategorie', 'select', S.kategorien],
      ['typ', 'Typ', 'select', ['Fixkosten', 'Rücklage', 'Variabel']], ['ueber', 'Bezahlt über', 'select', ['Girokonto', 'Sparkonto']],
      ['rhythmus', 'Rhythmus', 'select', RH], ['faellig', 'Fällig im Monat', 'month12'], ['tag', 'Abbuchungstag', 'int', 'leer = 1.'],
      ['ab', 'Gültig ab', 'date'], ['bis', 'Gültig bis', 'date'], ['notiz', 'Notiz', 'textarea']],
      defaults: () => ({ kat: 'Sonstiges', typ: 'Fixkosten', ueber: 'Girokonto', rhythmus: 'Monatlich' }),
      hint: 'Typ: Fixkosten = feste Kosten · Rücklage = Überweisung aufs Sparkonto · Variabel = Budget (Essen, Tanken …).' },
    raten: { title: 'Rate', fields: () => [
      ['bez', 'Bezeichnung', 'text'], ['anbieter', 'Anbieter', 'text'], ['rate', 'Monatsrate', 'money'], ['gesamt', 'Raten gesamt', 'int'],
      ['bezahlt', 'Bereits bezahlt', 'int'], ['naechste', 'Nächste Abbuchung', 'date'], ['notiz', 'Notiz', 'textarea']],
      defaults: () => ({ bezahlt: 0 }), hint: '„Bereits bezahlt“ = Anzahl Raten vor der nächsten Abbuchung. Der Tag der nächsten Abbuchung ist der monatliche Abbuchungstag.' },
    einnahmen: { title: 'Einnahme', fields: () => [
      ['bez', 'Bezeichnung', 'text'], ['betrag', 'Betrag', 'money'], ['rhythmus', 'Rhythmus', 'select', RH], ['faellig', 'Fällig im Monat', 'month12'],
      ['tag', 'Eingangstag', 'int', 'leer = 1.'], ['ab', 'Gültig ab', 'date'], ['bis', 'Gültig bis', 'date'],
      ['bisRate', 'Endet mit Rate', 'select', [['', '—'], ...S.raten.map((r) => [r.id, r.bez])]], ['notiz', 'Notiz', 'textarea']],
      defaults: () => ({ rhythmus: 'Monatlich', bisRate: '' }) },
    gehalt: { title: 'Gehalt', fields: () => [['ab', 'Gültig ab', 'date'], ['netto', 'Netto', 'money'], ['brutto', 'Brutto', 'money'], ['notiz', 'Notiz', 'textarea']],
      defaults: () => ({ ab: iso(som(E.todayNum())) }) },
    sonder: { title: 'Sonderzahlung', fields: () => [['monat', 'Monat', 'month'], ['betrag', 'Betrag', 'money'], ['bez', 'Bezeichnung', 'text']],
      defaults: () => ({ monat: iso(som(E.todayNum())) }) },
    buchungen: { title: 'Buchung', fields: () => [
      ['betrag', 'Betrag (Ausgabe)', 'money'], ['bez', 'Bezeichnung', 'text'], ['kat', 'Budget', 'select', [['', 'Ohne Budget'], ...S.kosten.filter((k) => k.typ === 'Variabel').map((k) => [k.id, k.bez])]],
      ['datum', 'Datum', 'date'], ['gebucht', 'Schon im Kontostand', 'bool']],
      hint: 'Negativer Betrag = Gutschrift/Eingang. „Schon im Kontostand“: Buchung ist bereits im eingetragenen Kontostand enthalten und zählt nicht mehr als offen.' },
  };

  function fieldHtml([k, label, type, opt], val) {
    const id = 'f_' + k;
    const wrap = (inner, cls = '') => `<div class="field ${cls}" data-field="${k}"><label for="${id}">${label}</label>${inner}</div>`;
    switch (type) {
      case 'money': return wrap(`<input id="${id}" name="${k}" inputmode="decimal" placeholder="0,00" value="${h(moneyIn(val))}" autocomplete="off">`);
      case 'int': return wrap(`<input id="${id}" name="${k}" inputmode="numeric" pattern="[0-9]*" placeholder="${h(opt || '')}" value="${h(val ?? '')}">`);
      case 'date': return wrap(`<input id="${id}" name="${k}" type="date" value="${h(val || '')}">`);
      case 'month': return wrap(`<input id="${id}" name="${k}" type="month" value="${h(val ? val.slice(0, 7) : '')}">`);
      case 'bool': return wrap(`<input id="${id}" name="${k}" type="checkbox" ${val ? 'checked' : ''}>`);
      case 'textarea': return wrap(`<textarea id="${id}" name="${k}" rows="3">${h(val || '')}</textarea>`, 'stack');
      case 'month12': return wrap(`<select id="${id}" name="${k}"><option value="">—</option>${MON.map((m, i) => `<option value="${i + 1}" ${+val === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>`);
      case 'select': {
        const opts = opt.map((o) => (Array.isArray(o) ? o : [o, o]));
        if (val && !opts.some((o) => o[0] === val)) opts.push([val, val]);
        return wrap(`<select id="${id}" name="${k}">${opts.map(([v, l]) => `<option value="${h(v)}" ${String(val ?? '') === String(v) ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`);
      }
      default: return wrap(`<input id="${id}" name="${k}" value="${h(val || '')}" autocomplete="off" autocapitalize="sentences">`);
    }
  }
  function readField([k, , type], form) {
    const el = form.elements[k]; if (!el) return undefined;
    const v = el.value;
    switch (type) {
      case 'money': return parseMoney(v);
      case 'int': return v === '' ? null : parseInt(v, 10);
      case 'date': return v || null;
      case 'month': return v ? v + '-01' : null;
      case 'bool': return el.checked;
      case 'month12': return v ? +v : null;
      case 'select': return v === '' ? null : v;
      default: return v.trim();
    }
  }

  function openForm(ent, id) {
    const sc = SCHEMA[ent];
    const fields = sc.fields();
    const existing = id ? S[ent].find((x) => x.id === id) : null;
    const obj = existing || (sc.defaults ? sc.defaults() : {});
    const body = `<form id="frm" autocomplete="off"><div class="card formcard">${fields.map((f) => fieldHtml(f, obj[f[0]])).join('')}</div>
      ${sc.hint ? `<div class="hint">${sc.hint}</div>` : ''}
      ${existing ? `<button type="button" class="btn danger" data-act="delete" data-ent="${ent}" data-id="${h(id)}">${sc.title} löschen</button>` : ''}</form>`;
    openSheet((existing ? '' : 'Neu: ') + sc.title, body, () => {
      const form = $('#frm');
      const o = existing ? { ...existing } : { id: uid() };
      for (const f of fields) o[f[0]] = readField(f, form);
      if (ent !== 'gehalt' && ent !== 'buchungen' && ent !== 'sonder' && !o.bez) { toast('Bitte eine Bezeichnung eingeben'); return false; }
      if (ent === 'gehalt' && (!o.ab || o.netto == null)) { toast('Bitte Datum und Netto eingeben'); return false; }
      if (ent === 'sonder' && (!o.monat || o.betrag == null)) { toast('Bitte Monat und Betrag eingeben'); return false; }
      if (ent === 'buchungen' && (!o.betrag || !o.datum)) { toast('Bitte Betrag und Datum eingeben'); return false; }
      const snap = snapshot();
      if (existing) Object.assign(existing, o); else S[ent].push(o);
      commit(existing ? 'Gespeichert' : 'Hinzugefügt', restoreFn(snap));
    });
    const syncVis = () => {
      const r = $('#frm [name=rhythmus]'); if (!r) return;
      const fr = $('#frm [data-field=faellig]'); if (fr) fr.classList.toggle('hidden', r.value === 'Monatlich' || r.value === 'Einmalig');
    };
    syncVis(); $('#frm').addEventListener('change', syncVis);
  }

  // Schnellerfassung
  function openAdd(kat) {
    const budgets = S.kosten.filter((k) => k.typ === 'Variabel');
    let sel = kat !== undefined ? kat : (ui.lastKat && budgets.some((b) => b.id === ui.lastKat) ? ui.lastKat : (budgets[0] || {}).id || '');
    const bl = C.K.budgetListe;
    const chips = () => budgets.map((b) => { const x = bl.find((y) => y.id === b.id); return `<button type="button" class="chip ${sel === b.id ? 'on' : ''}" data-kat="${h(b.id)}">${h(b.bez)}${x && x.budget > 0 ? `<small>${fmt(x.rest)}</small>` : ''}</button>`; }).join('') + `<button type="button" class="chip ${!sel ? 'on' : ''}" data-kat="">Ohne Budget</button>`;
    const body = `<form id="frm" autocomplete="off">
      <div class="amount"><input id="amt" inputmode="decimal" placeholder="0,00" enterkeyhint="done"><span>€</span></div>
      <div class="chips" id="chips">${chips()}</div>
      <div class="card formcard" style="margin-top:14px">
        <div class="field"><label for="f_bez">Notiz</label><input id="f_bez" name="bez" placeholder="optional, z. B. Aral" autocapitalize="sentences" enterkeyhint="done"></div>
        <div class="field"><label for="f_datum">Datum</label><input id="f_datum" name="datum" type="date" value="${iso(E.todayNum())}"></div>
        <div class="field"><label for="f_ein">Ist ein Eingang</label><input id="f_ein" name="ein" type="checkbox"></div>
        <div class="field"><label for="f_geb">Schon im Kontostand</label><input id="f_geb" name="gebucht" type="checkbox"></div>
      </div><div class="hint">Zählt als vorgemerkt, bis du den Kontostand mit einem späteren Datum aktualisierst.</div></form>`;
    openSheet('Neue Ausgabe', body, () => {
      const v = parseMoney($('#amt').value);
      if (!v) { toast('Bitte einen Betrag eingeben'); $('#amt').focus(); return false; }
      const f = $('#frm');
      const b = { id: uid(), datum: f.elements.datum.value || iso(E.todayNum()), betrag: f.elements.ein.checked ? -Math.abs(v) : Math.abs(v), bez: f.elements.bez.value.trim(), kat: sel || null, gebucht: f.elements.gebucht.checked };
      const snap = snapshot();
      S.buchungen.push(b);
      ui.lastKat = sel; localStorage.setItem(KEY + '.lastKat', sel || '');
      const kb = budgets.find((x) => x.id === sel);
      commit(`${fmt(Math.abs(v))} ${f.elements.ein.checked ? 'Eingang' : kb ? '· ' + kb.bez : ''} gespeichert`, restoreFn(snap));
    }, 'Sichern');
    $('#chips').addEventListener('click', (e) => { const c = e.target.closest('[data-kat]'); if (!c) return; sel = c.dataset.kat; $('#chips').innerHTML = chips(); });
    $('#amt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#sheet .save').click(); } });
    $('#amt').focus();
  }

  // Kontostand
  function openKonto() {
    const k = S.konto;
    const neg = num(k.stand) < 0;
    const body = `<form id="frm"><div class="seg" id="sgn"><button type="button" class="${neg ? '' : 'on'}" data-s="1">Im Plus</button><button type="button" class="${neg ? 'on' : ''}" data-s="-1">Im Minus</button></div>
      <div class="amount"><span id="sgnl" class="${neg ? 'neg' : ''}">${neg ? '−' : ''}</span><input id="amt" inputmode="decimal" value="${h(moneyIn(Math.abs(num(k.stand))))}"><span>€</span></div>
      <div class="card formcard"><div class="field"><label for="f_datum">Stand vom</label><input id="f_datum" type="date" value="${iso(E.todayNum())}"></div>
      <div class="field"><label>Verfügbar laut Bank</label><span id="verf" class="num muted"></span></div></div>
      <div class="hint">Kontostand laut Bank (gebuchte Umsätze). „Verfügbar“ sollte mit der Bank-App übereinstimmen. Vorgemerkte Umsätze mit älterem Datum fallen automatisch raus.</div></form>`;
    let sg = neg ? -1 : 1;
    openSheet('Kontostand', body, () => {
      const v = parseMoney($('#amt').value);
      if (v == null) { toast('Bitte Kontostand eingeben'); return false; }
      const snap = snapshot();
      S.konto.stand = sg * Math.abs(v); S.konto.datum = $('#f_datum').value || iso(E.todayNum());
      commit('Kontostand aktualisiert', restoreFn(snap));
    });
    const upd = () => { const v = parseMoney($('#amt').value) || 0; $('#verf').textContent = fmt(sg * Math.abs(v) + num(S.konto.dispo)); $('#sgnl').textContent = sg < 0 ? '−' : ''; };
    $('#sgn').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; sg = +b.dataset.s; for (const x of $('#sgn').children) x.classList.toggle('on', x === b); upd(); });
    $('#amt').addEventListener('input', upd); upd();
    const a = $('#amt'); a.focus(); a.select();
  }

  // Einzelne Einstellung
  function openEinstellung(f) {
    const defs = {
      dispo: ['Dispo-Rahmen', 'money', S.konto.dispo, (v) => (S.konto.dispo = v || 0)],
      puffer: ['Sicherheitspuffer', 'money', S.konto.puffer, (v) => (S.konto.puffer = v || 0)],
      gehaltstag: ['Gehaltseingang am (Tag)', 'int', S.konto.gehaltstag, (v) => (S.konto.gehaltstag = Math.max(1, Math.min(31, v || 1)))],
      planStart: ['Planungsstart', 'month', S.planStart, (v) => v && (S.planStart = v)],
      topfStart: ['Topf-Startbestand', 'money', S.topfStart, (v) => (S.topfStart = v || 0)],
      budgetModus: ['Budget-Berechnung', 'select', S.budgetModus, (v) => (S.budgetModus = v), [['erfasst', 'nach Erfassung'], ['anteilig', 'anteilig (wie Excel)']]],
      kategorien: ['Kategorien', 'textarea', S.kategorien.join('\n'), (v) => (S.kategorien = String(v || '').split('\n').map((x) => x.trim()).filter(Boolean))],
    };
    const [label, type, val, set, opt] = defs[f];
    const fd0 = [f, label, type, opt];
    openSheet(label, `<form id="frm"><div class="card formcard">${fieldHtml(fd0, val)}</div>${f === 'kategorien' ? '<div class="hint">Eine Kategorie pro Zeile.</div>' : ''}</form>`, () => {
      const snap = snapshot(); set(readField(fd0, $('#frm'))); commit('Gespeichert', restoreFn(snap));
    });
    const el = $('#frm [name]'); if (el && type !== 'select' && type !== 'month') el.focus();
  }

  // ---------- Sheet & Toast ----------
  let onSave = null;
  function openSheet(title, body, save, saveLabel = 'Fertig') {
    $('#sheet').innerHTML = `<div class="sh-head"><button data-act="close">Abbrechen</button><b>${h(title)}</b><button class="save" data-act="save">${saveLabel}</button></div><div class="sh-body">${body}</div>`;
    onSave = save;
    $('#sheet').classList.add('on'); $('#scrim').classList.add('on');
    $('#frm') && $('#frm').addEventListener('submit', (e) => { e.preventDefault(); doSave(); });
  }
  function closeSheet() { $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); onSave = null; document.activeElement && document.activeElement.blur(); }
  function doSave() { if (!onSave) return; if (onSave() === false) return; closeSheet(); }

  let toastT = null, toastUndo = null;
  function toast(msg, undo, label = 'Rückgängig') {
    const t = $('#toast');
    t.innerHTML = `<span>${h(msg)}</span>${undo ? `<button data-act="undo">${label}</button>` : ''}`;
    toastUndo = undo || null;
    t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), undo ? 4500 : 2200);
  }

  // ---------- Import / Export ----------
  function importText(txt) {
    let s;
    try { s = JSON.parse(txt); } catch { toast('Keine gültige Sicherungsdatei'); return; }
    if (!s || !s.konto || !Array.isArray(s.kosten)) { toast('Datei enthält keine Mtl.-Kosten-Daten'); return; }
    if (S && !confirm('Aktuelle Daten durch die Sicherung ersetzen?')) return;
    S = normalize(s); ui.tab = 'jetzt'; ui.mehr = null; persist(); render(); toast('Daten importiert');
  }
  function pickFile() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json,text/plain';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then(importText); };
    inp.click();
  }
  async function pasteImport() {
    try { const t = await navigator.clipboard.readText(); if (t) return importText(t); } catch { /* Fallback unten */ }
    openSheet('Einfügen', `<form id="frm"><div class="card formcard"><div class="field stack"><label>JSON der Sicherung</label><textarea id="pj" rows="8" placeholder="Hier einfügen"></textarea></div></div></form>`, () => { importText($('#pj').value); });
  }
  async function shareFile(name, text, type) {
    const file = new File([text], name, { type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return false; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return true;
  }
  async function exportJson() {
    const d = new Date(); const name = `Mtl-Kosten-Sicherung-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`;
    const ok = await shareFile(name, JSON.stringify(S, null, 2), 'application/json');
    if (ok) { S.meta = { ...(S.meta || {}), lastBackup: Date.now() }; commit('Sicherung erstellt'); }
  }
  function exportCsv() {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Datum', 'Betrag', 'Bezeichnung', 'Budget', 'Im Kontostand'].join(';')];
    for (const b of [...S.buchungen].sort((a, c) => (a.datum > c.datum ? 1 : -1))) {
      const kb = S.kosten.find((k) => k.id === b.kat);
      lines.push([fd(D(b.datum)), String(-num(b.betrag)).replace('.', ','), q(b.bez), q(kb ? kb.bez : ''), b.gebucht ? 'ja' : ''].join(';'));
    }
    shareFile('Mtl-Kosten-Buchungen.csv', '﻿' + lines.join('\r\n'), 'text/csv');
  }

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act],[data-tab]'); if (!el) return;
    if (el.dataset.tab) {
      const t = el.dataset.tab;
      if (t === 'add') return openAdd();
      if (ui.tab === t && t === 'mehr') ui.mehr = null;
      if (ui.tab === t && t === 'monat') ui.monat = defaultMonat();
      ui.tab = t; render(); window.scrollTo(0, 0); return;
    }
    const a = el.dataset.act;
    switch (a) {
      case 'add': return openAdd(el.dataset.kat);
      case 'konto': return openKonto();
      case 'close': return closeSheet();
      case 'save': return doSave();
      case 'undo': if (toastUndo) { toastUndo(); toastUndo = null; $('#toast').classList.remove('on'); } return;
      case 'edit': return openForm(el.dataset.ent, el.dataset.id);
      case 'new': return openForm(el.dataset.ent);
      case 'delete': {
        const { ent, id } = el.dataset;
        if (ent === 'raten' && S.einnahmen.some((x) => x.bisRate === id) && !confirm('Einnahmen sind an diese Rate gekoppelt. Trotzdem löschen?')) return;
        if (ent === 'kosten' && S.buchungen.some((x) => x.kat === id) && !confirm('Dieses Budget hat erfasste Buchungen (bleiben ohne Budget erhalten). Trotzdem löschen?')) return;
        const snap = snapshot();
        S[ent] = S[ent].filter((x) => x.id !== id);
        if (ent === 'kosten') for (const b of S.buchungen) if (b.kat === id) b.kat = null;
        if (ent === 'raten') for (const x of S.einnahmen) if (x.bisRate === id) x.bisRate = null;
        closeSheet(); commit('Gelöscht', restoreFn(snap)); return;
      }
      case 'toggle-erledigt': ui.zeigeErledigt = !ui.zeigeErledigt; return render();
      case 'go-monat': ui.tab = 'monat'; ui.monat = C.ausblick ? C.ausblick.monat : defaultMonat(); render(); return window.scrollTo(0, 0);
      case 'mon': ui.monat = edate(ui.monat, +el.dataset.d); return render();
      case 'mon-set': ui.tab = 'monat'; ui.monat = +el.dataset.m; render(); return window.scrollTo(0, 0);
      case 'posten-tab': ui.posten = el.dataset.v; return render();
      case 'mehr': ui.tab = 'mehr'; ui.mehr = el.dataset.v || null; render(); return window.scrollTo(0, 0);
      case 'einstellung': return openEinstellung(el.dataset.f);
      case 'export': return exportJson();
      case 'export-csv': return exportCsv();
      case 'import-file': return pickFile();
      case 'import-paste': return pasteImport();
      case 'start-empty': S = emptyState(); persist(); ui.tab = 'mehr'; ui.mehr = 'einstellungen'; render(); return toast('Leer gestartet – trag zuerst Dispo & Gehaltstag ein');
      case 'reset':
        if (confirm('Wirklich ALLE Daten auf diesem Gerät löschen? Das kann nicht rückgängig gemacht werden.')) { localStorage.removeItem(KEY); S = null; render(); }
        return;
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.dataset.act === 'mon-pick' && e.target.value) { ui.monat = D(e.target.value + '-01'); render(); }
  });
  $('#scrim').addEventListener('click', closeSheet);

  // Neu berechnen, wenn die App nach Mitternacht wieder geöffnet wird
  let lastDay = E.todayNum();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && E.todayNum() !== lastDay) { lastDay = E.todayNum(); render(); } });

  // Tabbar
  $('#tabbar').innerHTML = [['jetzt', 'Jetzt'], ['monat', 'Monat'], ['add', ''], ['posten', 'Posten'], ['mehr', 'Mehr']]
    .map(([k, l]) => (k === 'add' ? `<button class="add" data-tab="add" aria-label="Ausgabe erfassen"><span>${I.add}</span></button>` : `<button data-tab="${k}">${I[k]}<span>${l}</span></button>`)).join('');

  render();

  // Offline-Fähigkeit & dauerhafter Speicher
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Update verfügbar', () => location.reload(), 'Neu laden'); });
      });
    }).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
