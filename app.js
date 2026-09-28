/* Mtl. Kosten – App */
(function () {
  'use strict';
  const E = window.Engine;
  const UI = window.UI;
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
  let migrationMsg = null;
  let S = migrate(load());
  let C = null;                      // Rechenergebnis
  const ui = { tab: 'jetzt', monat: null, posten: 'kosten', mehr: null, zeigeErledigt: false, lastKat: localStorage.getItem(KEY + '.lastKat') || null };

  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.app === 'mtl-kosten' ? s : null; } catch { return null; } }
  function persist() { localStorage.setItem(KEY, JSON.stringify(S)); }
  function commit(msg, undo) { persist(); render(); if (msg) toast(msg, undo); }
  function snapshot() { return JSON.stringify(S); }
  function restoreFn(snap) { return () => { S = JSON.parse(snap); persist(); render(); }; }

  function emptyState() {
    return {
      app: 'mtl-kosten', version: 2,
      konto: { stand: 0, datum: iso(E.todayNum()), dispo: 0, gehaltstag: 28, puffer: 0, dispoZins: 0 },
      budgetModus: 'erfasst', planStart: iso(som(E.todayNum())), topfStart: 0,
      kategorien: ['Wohnen', 'Energie', 'Kommunikation', 'Versicherung', 'Mobilität', 'Abos & Freizeit', 'Lebenshaltung', 'Rücklage', 'Sonstiges'],
      gehalt: [], einnahmen: [], sonder: [], kosten: [], raten: [], buchungen: [],
    };
  }
  // Einmalige Ergänzungen bestehender Daten
  function migrate(s) {
    if (!s || (s.version || 1) >= 2) return s;
    s.version = 2;
    if (s.konto.dispoZins == null) s.konto.dispoZins = 13.026;
    if (!s.kategorien.includes('Bank & Zinsen')) s.kategorien.push('Bank & Zinsen');
    if (!s.kosten.some((k) => /kontoführ/i.test(k.bez || ''))) s.kosten.push({ id: uid(), kat: 'Bank & Zinsen', bez: 'Kontoführungsentgelt', betrag: 5.9, rhythmus: 'Monatlich', faellig: null, tag: 31, typ: 'Fixkosten', ueber: 'Girokonto', ab: null, bis: null, notiz: '' });
    localStorage.setItem(KEY, JSON.stringify(s));
    migrationMsg = 'Dispozinsen (13,026 %) und Kontoführung (5,90 €) ergänzt';
    return s;
  }
  function normalize(s) {
    const base = emptyState();
    for (const k of Object.keys(base)) if (s[k] == null) s[k] = base[k];
    for (const list of ['gehalt', 'einnahmen', 'sonder', 'kosten', 'raten', 'buchungen']) for (const x of s[list]) if (!x.id) x.id = uid();
    s.app = 'mtl-kosten';
    return s;
  }

  // ---------- Tabbar-Icons ----------
  const I = { jetzt: UI.svg('wallet'), monat: UI.svg('chart'), posten: UI.svg('list'), mehr: UI.svg('gear'), add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' };

  // ---------- Rendering ----------
  function render() {
    if (!S) { $('#tabbar').classList.add('hidden'); $('#view').innerHTML = viewWelcome(); return; }
    $('#tabbar').classList.remove('hidden');
    C = E.compute(S);
    if (ui.monat == null) ui.monat = defaultMonat();
    const v = { jetzt: viewJetzt, monat: viewMonat, posten: viewPosten, mehr: viewMehr }[ui.tab]();
    const view = $('#view');
    view.innerHTML = v;
    if (ui.anim) {
      const cls = ui.anim === true ? 'anim' : 'anim slide-' + ui.anim;
      view.className = cls; ui.anim = false;
      clearTimeout(render.t); render.t = setTimeout(() => (view.className = ''), 1300);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) countUp(view);
    }
    for (const b of document.querySelectorAll('#tabbar [data-tab]')) b.classList.toggle('on', b.dataset.tab === ui.tab);
  }

  // Beträge hochzählen lassen
  function countUp(root) {
    for (const el of root.querySelectorAll('[data-count]')) {
      const to = +el.dataset.count, t0 = performance.now(), dur = 700;
      const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
      setTimeout(() => (el.textContent = fmt(to)), dur + 80);
    }
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

  // ---------- Visuals (Icons/Farben je Posten) ----------
  const WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const kostenById = (id) => C.P.kosten.find((x) => x.id === id);
  const visKosten = (k) => UI.visual(k.kat, k.bez);
  const visRate = (r) => UI.visual('Rate', r.bez);
  const visEin = (e) => UI.visual('Einnahme', e.bez);
  function visBuchung(b) {
    const k = b.kat ? kostenById(b.kat) : null;
    if (k) return visKosten(k);
    return num(b.betrag) < 0 ? UI.visual('Einnahme', b.bez) : UI.visual('Sonstiges', b.bez);
  }
  function visRow(r) {
    if (r.src === 'kosten') { const k = kostenById(r.ref); return k ? visKosten(k) : UI.visual('Sonstiges', r.name); }
    if (r.src === 'rate') return UI.visual('Rate', r.name);
    if (r.src === 'einnahme') return UI.visual('Einnahme', r.name);
    if (r.src === 'zins') return UI.visual('Bank & Zinsen', 'Zinsen');
    return visBuchung(S.buchungen.find((b) => b.id === r.id) || { kat: r.kat, betrag: -r.a, bez: r.name });
  }
  const dayLabel = (d) => {
    const t = C.today, a = ymd(d);
    if (d === t) return 'Heute'; if (d === t + 1) return 'Morgen'; if (d === t - 1) return 'Gestern';
    return `${WDL[E.weekday(d)]}, ${a.d}. ${MON[a.m - 1]}`;
  };
  const pct = (v) => `${Math.round(v * 100)} %`;
  const katLabel = (k) => (k === 'Rate' ? 'Raten & Kredite' : k);

  // ----- Tab: Jetzt -----
  function viewJetzt() {
    const K = C.K, t = ymd(C.today);
    let out = `<div class="top"><div><div class="eyebrow">${WDL[E.weekday(C.today)]}, ${t.d}. ${MON[t.m - 1]}</div><h1>Konto jetzt</h1></div><button class="pill" data-act="konto">${UI.svg('wallet', 'class="pi"')}Kontostand</button></div>`;
    if (K.veraltet > 0) out += `<button class="banner warn" data-act="konto">${UI.svg('clock', 'class="bi"')}<span>Kontostand ist <b>${K.veraltet} ${K.veraltet === 1 ? 'Tag' : 'Tage'} alt</b> – tippen zum Aktualisieren</span></button>`;

    // Hero
    const zyk = Math.max(1, K.ZEnde - K.ZStart), vergangen = Math.min(1, Math.max(0, (K.KDatum - K.ZStart) / zyk));
    const dispoUse = K.KDispo > 0 ? Math.max(0, Math.min(1, -K.KStand / K.KDispo)) : 0;
    const neg = K.KFrei < 0;
    out += `<section class="hero-g ${neg ? 'bad' : ''}" data-act="konto">
      <div class="hg-top"><div class="hg-main"><div class="hg-l">Frei bis zum Gehalt</div><div class="hg-big num" data-count="${K.KFrei}">${fmt(K.KFrei)}</div>
        <div class="hg-sub">${neg ? 'Dispo-Grenze würde überschritten' : `≈ ${fmt(K.proTag)} pro Tag`}</div></div>
        ${UI.ring(1 - vergangen, 'rgba(255,255,255,.95)', 84, 8, `<b>${K.tageBisGehalt}</b><span>${K.tageBisGehalt === 1 ? 'Tag' : 'Tage'}</span>`)}</div>
      <div class="hg-stats"><div><span>Kontostand</span><b class="num">${fmt(K.KStand)}</b></div><div><span>Verfügbar</span><b class="num">${fmt(K.KStand + K.KDispo)}</b></div><div><span>Nach Budgets</span><b class="num">${fmt(K.KRest)}</b></div></div>
      ${K.KDispo > 0 ? `<div class="hg-bar"><div class="hg-bl"><span>Dispo genutzt</span><span>${pct(dispoUse)} von ${fmt(K.KDispo)}</span></div><div class="hg-track"><i style="width:${(dispoUse * 100).toFixed(1)}%"></i></div></div>` : ''}
      <div class="hg-foot">Gehalt ${fds(K.ZEnde)}${C.naechstesGehalt ? ` · erwartet ${fmt(C.naechstesGehalt)}` : ''} · Stand vom ${fd(K.KDatum)}</div>
    </section>`;
    if (K.KBudgetRest > K.KFrei + 0.004) out += `<div class="banner bad">${UI.svg('help', 'class="bi"')}<span>Budgets (${fmt(K.KBudgetRest)}) passen nicht rein – es fehlen <b>${fmt(K.KBudgetRest - K.KFrei)}</b></span></div>`;

    // Budgets
    const bl = K.budgetListe.filter((b) => b.budget > 0 || b.ausgegeben > 0);
    out += `<h2>Budgets<button data-act="add">+ Ausgabe</button></h2><div class="hscroll">`;
    const zyk0 = Math.max(1, K.ZEnde - K.ZStart), soll = Math.min(1, (K.KDatum - K.ZStart + 1) / zyk0);
    for (const b of bl) {
      const k = kostenById(b.id), v = visKosten(k), over = b.rest < -0.004;
      const p = b.budget > 0 ? b.ausgegeben / b.budget : 1;
      const plan = b.budget * soll, tempo = b.ausgegeben - plan;
      const paceCls = over ? 'bad' : tempo > 1 ? 'warn' : 'ok';
      const paceTxt = over ? 'überzogen' : tempo > 1 ? `${fmt(tempo)} über Plan` : 'im Plan';
      out += `<button class="bcard" data-act="add" data-kat="${h(b.id)}">
        <div class="bc-head">${UI.icon(v, 'sm')}<span>${h(b.bez)}</span></div>
        <div class="bc-body">${UI.ring(p, over ? 'var(--neg)' : v.color, 58, 7, `<small>${b.budget > 0 ? Math.round(p * 100) + '%' : '–'}</small>`, b.budget > 0 ? soll : null)}
        <div><div class="bc-v num ${over ? 'neg' : ''}">${over ? '−' + fmt(-b.rest) : fmt(b.rest)}</div><div class="bc-s">von ${fmt(b.budget)}</div></div></div>
        <div class="bc-foot"><span class="pace ${paceCls}">${paceTxt}</span><span>${over ? '' : '≈ ' + fmt(Math.max(0, b.rest) / K.tageBisGehalt) + '/Tag'}</span></div></button>`;
    }
    out += `<button class="bcard add" data-act="add">${UI.svg('in', 'style="transform:rotate(180deg)"')}<span>Ausgabe erfassen</span></button></div>`;

    // Insights
    const ins = [];
    const frei = C.plan.find((r) => r.kontoVorGehalt != null && r.kontoVorGehalt >= 0);
    if (K.KStand < 0) {
      const start = Math.min(K.KVorGehalt - K.KBudgetRest, K.KStand);
      ins.push({ c: '#1fa36a', i: 'shield', l: 'Dispo ausgeglichen', v: frei ? fm(frei.m) : 'nicht in Sicht', s: frei ? `in ${Math.round((frei.m - som(C.today)) / 30.44)} Monaten · noch ${fmt(-start)}` : 'mit aktuellem Plan nicht in 8 Jahren' });
    }
    const nx = K.rows.find((r) => r.status === 'offen' && r.a < 0 && r.src !== 'buchung');
    if (nx) ins.push({ c: visRow(nx).color, i: visRow(nx).icon, l: 'Nächste Abbuchung', v: fmt(-nx.a), s: `${h(nx.name)} · ${dayLabel(nx.d)}` });
    const re = C.P.raten.filter((x) => x.offen > 0 && x.letzte != null).sort((a, b) => a.letzte - b.letzte)[0];
    if (re) ins.push({ c: '#e5484d', i: visRate(re).icon, l: 'Nächste Rate endet', v: '+' + fmt(num(re.rate)), s: `${h(re.bez)} · ab ${fm(re.mehrFreiAb)}` });
    if (C.zins.satz > 0) ins.push({ c: '#9f1239', i: 'bank', l: 'Dispozinsen 12 Monate', v: '≈ ' + fmt(C.zins.proMonat * 12), s: `Ø ${fmt(C.zins.proMonat)} pro Monat` });
    if (ins.length) {
      out += `<h2>Insights</h2><div class="hscroll">${ins.map((x) => `<div class="icard" style="--c:${x.c}"><div class="ic-top">${UI.icon({ color: x.c, icon: x.i }, 'xs')}<span>${x.l}</span></div><div class="ic-v num">${x.v}</div><div class="ic-s">${x.s}</div></div>`).join('')}</div>`;
    }

    // Kontoverlauf bis Gehalt
    const pend = K.rows.filter((r) => r.status !== 'erledigt');
    const pts = [];
    for (let d = K.KDatum; d <= Math.max(K.KDatum + 1, K.ZEnde - 1); d++) {
      const bal = K.KStand + pend.filter((r) => r.d <= d).reduce((a, r) => a + r.a, 0) - K.KBudgetTag * (d - K.KDatum);
      pts.push([d, bal]);
    }
    const minP = pts.reduce((m, p) => (p[1] < m[1] ? p : m), pts[0]);
    const lastIdx = pts.length - 1;
    out += `<h2>Kontoverlauf bis zum Gehalt</h2><div class="card chart">
      <div class="ch-head"><div><span>Tiefster Stand</span><b class="num ${minP[1] < -K.KDispo ? 'neg' : ''}">${fmt(minP[1])}</b></div><div class="r"><span>Abstand zur Grenze</span><b class="num ${minP[1] + K.KDispo < 0 ? 'neg' : 'pos'}">${fmt(minP[1] + K.KDispo)}</b></div></div>
      ${UI.area(pts, { limit: -K.KDispo, limitLabel: 'Dispo-Grenze', id: 'kv', mark: [minP[0], minP[1], fds(minP[0])], xLabels: [[pts[0][0], 'Heute', 'start'], [pts[Math.floor(lastIdx / 2)][0], fds(pts[Math.floor(lastIdx / 2)][0])], [pts[lastIdx][0], 'Gehalt', 'end']] })}
      <div class="ch-foot">inkl. Budgets, gleichmäßig pro Tag verteilt</div></div>`;

    // Dispozinsen
    const Z = C.zins;
    if (Z.satz > 0) {
      const nz = Z.naechste;
      out += `<h2>Dispozinsen</h2><div class="card"><button class="row tap" ${nz ? `data-act="zins" data-key="${iso(nz.datum)}" data-b="${nz.betrag}"` : ''}>${UI.icon(UI.visual('Bank & Zinsen', 'Zinsen'))}
        <div class="main"><div class="t">Ø ${fmt(Z.proMonat)} pro Monat</div><div class="s">${String(+Z.satz.toFixed(3)).replace('.', ',')} % p. a.${nz ? ` · ${fds(nz.datum)} ${nz.ist ? 'laut Bank' : 'geschätzt'}` : ''}</div></div>
        <div class="r"><div class="amt num neg">${nz ? fmt(-nz.betrag) : ''}</div><div class="s">${nz ? 'Q' + nz.quartal : ''}</div></div></button></div>
        <div class="foot">Taggenau geschätzt aus der Kontostand-Prognose, abgebucht am letzten Werktag jedes Quartals. Kennst du den echten Betrag, tippe die Zeile an.</div>`;
    }

    // Kennzahlen
    const A = C.ausblick;
    out += `<div class="grid2">
      <div class="tile">${UI.icon({ color: '#e5484d', icon: 'card' }, 'xs')}<div class="l">Offene Abbuchungen</div><div class="v num">${fmt(K.KOffenAus)}</div></div>
      <div class="tile">${UI.icon({ color: '#16a34a', icon: 'in' }, 'xs')}<div class="l">Offene Eingänge</div><div class="v num pos">${fmt(K.KOffenEin)}</div></div>
      <div class="tile">${UI.icon({ color: '#5b6cf0', icon: 'calendar' }, 'xs')}<div class="l">Vor dem Gehalt</div><div class="v num">${fmt(K.KVorGehalt - K.KBudgetRest)}</div><div class="s">inkl. Budgets</div></div>
      <div class="tile">${UI.icon({ color: K.KFreiSicher < 0 ? '#e5484d' : '#8a8f98', icon: 'shield' }, 'xs')}<div class="l">Worst Case</div><div class="v num ${K.KFreiSicher < 0 ? 'neg' : ''}">${fmt(K.KWorst)}</div><div class="s">${K.KFreiSicher < 0 ? `${fmt(-K.KFreiSicher)} über Grenze` : 'Eingänge bleiben aus'}</div></div>
    </div>`;
    if (A) {
      const cls = A.status === 'ok' ? 'good' : A.status === 'knapp' ? 'warn' : 'bad';
      const txt = A.status === 'ok' ? `Grenze wird in 12 Monaten nicht erreicht – tiefster Stand <b>${fmt(A.min)}</b> (${fms(A.monat)})`
        : A.status === 'knapp' ? `Knapp: tiefster Stand <b>${fmt(A.min)}</b> im ${fm(A.monat)}` : `Dispo-Grenze wird überschritten – <b>${fmt(A.min)}</b> im ${fm(A.monat)}`;
      out += `<button class="banner ${cls}" style="margin-top:10px" data-act="go-monat">${UI.svg('chart', 'class="bi"')}<span>${txt}</span></button>`;
    }

    // Buchungen nach Tag
    const rows = K.rows.filter((r) => ui.zeigeErledigt || r.status !== 'erledigt');
    const nErl = K.rows.length - pend.length;
    out += `<h2>Kommende Buchungen${nErl ? `<button data-act="toggle-erledigt">${ui.zeigeErledigt ? 'Erledigte ausblenden' : `+ ${nErl} erledigte`}</button>` : ''}</h2>`;
    if (!rows.length) out += `<div class="card"><div class="empty">Keine offenen Buchungen bis zum Gehalt.</div></div>`;
    let curD = null;
    for (const r of rows) {
      if (r.d !== curD) {
        if (curD != null) out += `</div>`;
        const daySum = rows.filter((x) => x.d === r.d).reduce((a, x) => a + x.a, 0);
        out += `<div class="dayhdr"><span>${dayLabel(r.d)}</span><span class="num">${plus(daySum)}</span></div><div class="card">`; curD = r.d;
      }
      const erl = r.status === 'erledigt', tap = r.src === 'buchung' || r.src === 'zins';
      const sub = [r.status === 'vorgemerkt' ? '<span class="tag acc">vorgemerkt</span>' : erl ? '<span class="tag">✔ erledigt</span>' : r.src === 'zins' ? (r.ist ? '<span class="tag acc">laut Bank</span>' : '<span class="tag warn">geschätzt · antippen</span>') : r.src === 'rate' ? 'Rate' : r.src === 'einnahme' ? 'Eingang' : h((kostenById(r.ref) || {}).kat || ''),
        r.verschoben ? `<span class="tag warn">von ${fds(r.nd)}</span>` : ''].filter(Boolean).join(' ');
      out += `<div class="row ${erl ? 'dim' : ''} ${tap ? 'tap' : ''}" ${r.src === 'zins' ? `data-act="zins" data-key="${r.zinsKey}" data-b="${-r.a}"` : tap ? `data-act="edit" data-ent="buchungen" data-id="${h(r.id)}"` : ''}>
        ${UI.icon(visRow(r))}<div class="main"><div class="t">${h(r.name)}</div><div class="s">${sub}</div></div>
        <div class="r"><div class="amt num ${r.a > 0 ? 'pos' : ''}">${plus(r.a)}</div>${r.run != null ? `<div class="s num">${fmt(r.run)}</div>` : ''}</div></div>`;
    }
    if (curD != null) out += `</div>`;
    out += `<div class="foot">Kleine Zahl = Kontostand danach inkl. Budgets. Vorgemerkte zählen, solange ihr Datum ≥ „Stand vom“ ist.</div>`;
    return out;
  }

  // ----- Tab: Monat -----
  function viewMonat() {
    const m = ui.monat;
    const r = C.plan.find((x) => x.m === m);
    const val = `${ymd(m).y}-${p2(ymd(m).m)}`;
    let out = `<div class="top"><div><div class="eyebrow">Übersicht</div><h1>${MON[ymd(m).m - 1]} <span class="muted">${ymd(m).y}</span></h1></div><button class="pill" data-act="mehr" data-v="plan">${UI.svg('list', 'class="pi"')}Planung</button></div>
      <div class="monthnav"><button class="arrow" data-act="mon" data-d="-1" aria-label="Vormonat">‹</button>
      <div class="lbl">${UI.svg('calendar', 'class="pi"')} ${fm(m)}<input type="month" value="${val}" data-act="mon-pick" aria-label="Monat wählen"></div>
      <button class="arrow" data-act="mon" data-d="1" aria-label="Nächster Monat">›</button></div>`;
    if (!r) return out + `<div class="card"><div class="empty">Monat liegt außerhalb der Planung (Start ${fm(som(D(S.planStart)))}, 8 Jahre).</div></div>`;

    // Cashflow-Karte
    const quote = r.einnahmen > 0 ? Math.min(1, r.ausgaben / r.einnahmen) : 1;
    out += `<section class="card cash">
      <div class="cf-top"><div><div class="l">Frei verfügbar</div><div class="big num ${sign(r.frei)}">${fmt(r.frei)}</div></div>
      <span class="chip-d ${r.veraenderung > 0.004 ? 'up' : r.veraenderung < -0.004 ? 'down' : ''}">${r.veraenderung > 0.004 ? '▲' : r.veraenderung < -0.004 ? '▼' : '•'} ${plus(r.veraenderung)}</span></div>
      <div class="cf-cols"><div>${UI.icon({ color: '#16a34a', icon: 'in' }, 'xs')}<span class="l">Einnahmen</span><b class="num">${fmt(r.einnahmen)}</b><small>Gehalt ${fmt(r.gehalt)}${r.weitere ? ` · weitere ${fmt(r.weitere)}` : ''}${r.sonder ? ` · Sonder ${fmt(r.sonder)}` : ''}</small></div>
      <div>${UI.icon({ color: '#e5484d', icon: 'card' }, 'xs')}<span class="l">Ausgaben</span><b class="num">${fmt(r.ausgaben)}</b><small>davon Raten ${fmt(r.raten)}${r.zinsen ? ` · Zinsen ${fmt(r.zinsen)}` : ''}</small></div></div>
      <div class="cf-bar"><i style="width:${(quote * 100).toFixed(1)}%"></i></div><div class="cf-bl"><span>${pct(quote)} der Einnahmen verplant</span><span>${r.kontoVorGehalt != null ? 'Konto vor Gehalt ' + fmt(r.kontoVorGehalt) : ''}</span></div>
    </section>`;
    if (r.ereignisse.length) out += `<div class="events">${r.ereignisse.map((e) => `<div class="banner good" style="margin:0">${UI.svg('star', 'class="bi"')}<span>${h(e)}</span></div>`).join('')}</div>`;

    // Säulen: frei verfügbar
    const i0 = Math.max(0, Math.min(C.plan.length - 12, C.plan.findIndex((x) => x.m === m) - 5));
    const win = C.plan.slice(i0, i0 + 12);
    out += `<h2>Frei verfügbar je Monat</h2><div class="card chart">${UI.bars(win.map((x) => ({ label: MON[ymd(x.m).m - 1][0], v: x.frei, key: x.m, on: x.m === m })), { fmt: (v) => fmt(v) })}
      <div class="ch-foot">${fms(win[0].m)} – ${fms(win[win.length - 1].m)} · Säule antippen zum Wechseln</div></div>`;

    // Donut nach Kategorie
    const posten = E.monatsPosten(C.P, m, r);
    const byCat = {};
    for (const p of posten) byCat[p.kat] = (byCat[p.kat] || 0) + p.betrag;
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const tot = cats.reduce((a, c) => a + c[1], 0);
    if (cats.length) {
      out += `<h2>Ausgaben nach Kategorie</h2><div class="card pad"><div class="donut-wrap">${UI.donut(cats.map(([k, v]) => ({ v, color: UI.catColor(k) })), 200, 22, `<span>Gesamt</span><b class="num">${fmt(tot)}</b><span>${posten.length} Posten</span>`)}</div><div class="legend">`;
      for (const [k, v] of cats) {
        const vis = UI.visual(k, k === 'Rate' ? 'Kredit' : '');
        out += `<div class="lg-row">${UI.icon({ ...vis, color: UI.catColor(k) }, 'sm')}<div class="main"><div class="lg-t"><span>${h(katLabel(k))}</span><b class="num">${fmt(v)}</b></div>
          <div class="lg-bar"><i style="width:${((v / tot) * 100).toFixed(1)}%;background:${UI.catColor(k)}"></i></div></div><span class="lg-p">${Math.round((v / tot) * 100)}%</span></div>`;
      }
      out += `</div></div>`;
    }

    // Einzelposten
    out += `<h2>Alle Ausgaben im ${MON[ymd(m).m - 1]}<span class="num" style="text-transform:none">${fmt(tot)}</span></h2><div class="card">`;
    if (!posten.length) out += `<div class="empty">Keine Ausgaben.</div>`;
    for (const p of posten) {
      const v = p.typ === 'Rate' ? UI.visual('Rate', p.bez) : UI.visual(p.kat, p.bez);
      out += `<div class="row">${UI.icon(v)}<div class="main"><div class="t">${h(p.bez)}</div><div class="s">${h(katLabel(p.kat))}${p.typ === 'Variabel' ? ' · Budget' : ''}</div></div><div class="r amt num">${fmt(p.betrag)}</div></div>`;
    }
    out += `</div>`;

    // Erfasste Buchungen vs. Budget (Kalendermonat)
    const mEnd = E.eomonth(m, 0);
    const erf = S.buchungen.filter((b) => { const d = D(b.datum); return d >= m && d <= mEnd; });
    if (erf.length) {
      const byK = {};
      for (const b of erf) { const k = b.kat || '_'; byK[k] = (byK[k] || 0) + num(b.betrag); }
      out += `<h2>Erfasst im ${MON[ymd(m).m - 1]}</h2><div class="card">`;
      for (const [k, v] of Object.entries(byK).sort((a, b) => b[1] - a[1])) {
        const kb = kostenById(k);
        const vis = kb ? visKosten(kb) : UI.visual('Sonstiges', '');
        const p = kb && kb.proMonat > 0 ? v / kb.proMonat : null;
        out += `<div class="row">${UI.icon(vis)}<div class="main"><div class="t">${h(kb ? kb.bez : 'Ohne Budget')}</div>${p != null ? `<div class="bar"><i class="${p > 1 ? 'over' : ''}" style="width:${Math.min(100, p * 100)}%;${p <= 1 ? `background:${vis.color}` : ''}"></i></div><div class="s">${pct(p)} von ${fmt(kb.proMonat)}</div>` : ''}</div><div class="r amt num">${fmt(v)}</div></div>`;
      }
      out += `</div>`;
    }

    // Prognose Kontostand
    const pts = C.plan.filter((x) => x.kontoVorGehalt != null).slice(0, 24);
    if (pts.length > 1) {
      const sel = pts.find((x) => x.m === m);
      out += `<h2>Kontostand vor Gehalt · 24 Monate</h2><div class="card chart">${UI.area(pts.map((x) => [x.m, x.kontoVorGehalt]), {
        limit: -C.K.KDispo, limitLabel: 'Dispo-Grenze', id: 'kp',
        mark: sel ? [sel.m, sel.kontoVorGehalt, fmt(sel.kontoVorGehalt)] : [pts[pts.length - 1].m, pts[pts.length - 1].kontoVorGehalt, fmt(pts[pts.length - 1].kontoVorGehalt)],
        xLabels: [[pts[0].m, fms(pts[0].m), 'start'], [pts[12] ? pts[12].m : pts[0].m, pts[12] ? fms(pts[12].m) : ''], [pts[pts.length - 1].m, fms(pts[pts.length - 1].m), 'end']],
      })}</div>`;
    }

    // Raten-Ende
    const re = C.P.raten.filter((x) => x.letzte != null && x.offen > 0).sort((a, b) => a.letzte - b.letzte);
    if (re.length) {
      out += `<h2>Wann bleibt mehr übrig?</h2><div class="card timeline">`;
      for (const x of re) {
        const pr = C.plan.find((p) => p.m === x.mehrFreiAb);
        out += `<button class="row tap" data-act="mon-set" data-m="${x.mehrFreiAb}">${UI.icon(visRate(x))}<div class="main"><div class="t">${h(x.bez)}</div><div class="s">ab ${fm(x.mehrFreiAb)}${pr ? ` · dann frei ${fmt(pr.frei)}` : ''}</div></div>
          <div class="r"><div class="amt num pos">+${fmt(num(x.rate))}</div><div class="s">pro Monat</div></div></button>`;
      }
      out += `</div>`;
    }
    return out;
  }

  // ----- Tab: Posten -----
  function viewPosten() {
    const t = ui.posten;
    let out = `<div class="top"><div><div class="eyebrow">Verträge & Einnahmen</div><h1>Posten</h1></div><button class="pill" data-act="new" data-ent="${t}">+ Neu</button></div>
      <div class="seg">${[['kosten', 'Kosten'], ['raten', 'Raten'], ['einnahmen', 'Einnahmen']].map(([k, l]) => `<button class="${t === k ? 'on' : ''}" data-act="posten-tab" data-v="${k}">${l}</button>`).join('')}</div>`;
    const today = C.today;
    if (t === 'kosten') {
      const aktiv = C.P.kosten.filter((k) => !(k.bis && k.bis < today) && k.iv !== 0);
      const fixe = aktiv.filter((k) => k.typ !== 'Variabel');
      const byCat = {};
      for (const k of fixe) byCat[k.kat] = (byCat[k.kat] || 0) + k.proMonat;
      const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const sumFix = fixe.reduce((a, k) => a + k.proMonat, 0), sumVar = aktiv.filter((k) => k.typ === 'Variabel').reduce((a, k) => a + k.proMonat, 0);
      out += `<section class="card pad sumcard"><div class="l">Fixkosten pro Monat (Ø)</div><div class="big num">${fmt(sumFix)}</div>
        ${UI.stack(cats.map(([k, v]) => ({ v, color: UI.catColor(k) })))}
        <div class="lg-chips">${cats.map(([k, v]) => `<span><i style="background:${UI.catColor(k)}"></i>${h(k)} <b class="num">${fmt(v)}</b></span>`).join('')}</div>
        <div class="sum-sub"><span>+ Budgets</span><b class="num">${fmt(sumVar)}</b><span>+ Raten</span><b class="num">${fmt(C.P.raten.filter((r) => r.offen > 0).reduce((a, r) => a + num(r.rate), 0))}</b>${C.zins.satz > 0 ? `<span>+ Zinsen Ø</span><b class="num">${fmt(C.zins.proMonat)}</b>` : ''}</div></section>`;
      const groups = [
        ['Fixkosten · Girokonto', (k) => k.typ === 'Fixkosten' && k.ueber === 'Girokonto'],
        ['Über Sparkonto (Rücklagen-Topf)', (k) => k.typ === 'Fixkosten' && k.ueber !== 'Girokonto'],
        ['Rücklage', (k) => k.typ === 'Rücklage'],
        ['Variable Budgets', (k) => k.typ === 'Variabel'],
      ];
      for (const [title, f] of groups) {
        const items = C.P.kosten.filter(f);
        if (!items.length) continue;
        const sum = items.filter((k) => !(k.bis && k.bis < today)).reduce((a, k) => a + k.proMonat, 0);
        out += `<h2>${title}<span class="num" style="text-transform:none">Ø ${fmt(sum)}</span></h2><div class="card">`;
        for (const k of items) {
          const ended = k.bis && k.bis < today;
          const rh = k.rhythmus === 'Monatlich' ? 'monatlich' : k.rhythmus === 'Einmalig' ? 'einmalig ' + (k.von != null ? fd(k.von) : '') : `${k.rhythmus.toLowerCase()}${k.faellig ? ', ab ' + MON[k.faellig - 1] : ''}`;
          const det = [rh, k.tag ? `am ${k.tag}.` : '', ended ? 'beendet' : k.bis ? 'bis ' + fd(k.bis) : ''].filter(Boolean).join(' · ');
          out += `<button class="row tap ${ended ? 'dim' : ''}" data-act="edit" data-ent="kosten" data-id="${h(k.id)}">${UI.icon(visKosten(k))}<div class="main"><div class="t">${h(k.bez)}</div><div class="s">${h(det)}</div></div><div class="r"><div class="amt num">${fmt(num(k.betrag))}</div>${k.iv > 1 ? `<div class="s">Ø ${fmt(k.proMonat)}/Mon.</div>` : `<div class="s">${h(k.kat)}</div>`}</div></button>`;
        }
        out += `</div>`;
      }
      if (!C.P.kosten.length) out += `<div class="card"><div class="empty">Noch keine Kosten.</div></div>`;
    } else if (t === 'raten') {
      const rs = C.P.raten;
      const aktiv = rs.filter((r) => r.offen > 0);
      const restSum = rs.reduce((a, r) => a + r.rest, 0), gesSum = rs.reduce((a, r) => a + num(r.gesamt) * num(r.rate), 0);
      out += `<section class="card pad sumcard"><div class="sum2"><div><div class="l">Monatsraten</div><div class="big num">${fmt(aktiv.reduce((a, r) => a + num(r.rate), 0))}</div></div>
        <div class="r"><div class="l">Restschuld</div><div class="big num neg">${fmt(restSum)}</div></div></div>
        <div class="bar thick"><i class="done" style="width:${gesSum ? ((1 - restSum / gesSum) * 100).toFixed(1) : 0}%"></i></div>
        <div class="sum-sub"><span>${pct(gesSum ? 1 - restSum / gesSum : 0)} aller Raten bezahlt</span><span>${aktiv.length} aktiv</span></div></section>`;
      if (!rs.length) out += `<div class="card"><div class="empty">Noch keine Raten.</div></div>`;
      for (const r of [...rs].sort((a, b) => (a.letzte || 0) - (b.letzte || 0))) {
        const done = r.offen <= 0, v = visRate(r);
        out += `<button class="card ratecard tap" data-act="edit" data-ent="raten" data-id="${h(r.id)}">
          ${UI.ring(r.fortschritt, done ? 'var(--pos)' : v.color, 64, 7, `<small>${Math.round(r.fortschritt * 100)}%</small>`)}
          <div class="main"><div class="rc-t"><span>${h(r.bez)}</span><b class="num">${fmt(num(r.rate))}</b></div><div class="s">${h(r.anbieter || '')}${r.anbieter ? ' · ' : ''}${done ? '✔ abbezahlt' : `${r.offen} von ${num(r.gesamt)} Raten offen`}</div>
          <div class="rc-f"><span>Rest <b class="num">${fmt(r.rest)}</b></span><span>bis <b>${r.letzte != null ? fmy(r.letzte) : '–'}</b></span></div></div></button>`;
      }
      out += `<div class="foot">„Bereits bezahlt“ = Anzahl Raten vor der nächsten Abbuchung. Enddatum, Rest und Fortschritt rechnen sich mit dem heutigen Datum selbst weiter.</div>`;
    } else {
      const curG = [...S.gehalt].filter((g) => D(g.ab) <= C.today).sort((a, b) => (a.ab < b.ab ? 1 : -1))[0];
      const weitere = C.P.einnahmen.reduce((a, e) => a + E.imMonat(som(C.today), e.betrag, e.von, e.bis, e.iv, e.faellig), 0);
      out += `<section class="card pad sumcard"><div class="sum2"><div><div class="l">Gehalt netto</div><div class="big num pos">${fmt(curG ? num(curG.netto) : 0)}</div></div>
        <div class="r"><div class="l">Weitere / Monat</div><div class="big num pos">${fmt(weitere)}</div></div></div></section>`;
      out += `<h2>Gehalt<button data-act="new" data-ent="gehalt">+ Neu</button></h2><div class="card">`;
      const gs = [...S.gehalt].sort((a, b) => (a.ab < b.ab ? 1 : -1));
      if (!gs.length) out += `<div class="empty">Noch kein Gehalt eingetragen.</div>`;
      for (const g of gs) out += `<button class="row tap" data-act="edit" data-ent="gehalt" data-id="${h(g.id)}">${UI.icon(UI.visual('Gehalt', 'Gehalt'))}<div class="main"><div class="t">ab ${fd(D(g.ab))} ${g === curG ? '<span class="tag acc">aktuell</span>' : D(g.ab) > C.today ? '<span class="tag">künftig</span>' : ''}</div><div class="s">${g.brutto ? 'Brutto ' + fmt(num(g.brutto)) + ' · ' : ''}${h(g.notiz || '')}</div></div><div class="r amt num">${fmt(num(g.netto))}</div></button>`;
      out += `</div><div class="foot">Es gilt immer die letzte Zeile, deren Datum erreicht ist. <a href="https://www.brutto-netto-rechner.info/" target="_blank" rel="noopener" style="color:var(--accent)">Brutto-Netto-Rechner</a></div>`;
      out += `<h2>Weitere Einnahmen<button data-act="new" data-ent="einnahmen">+ Neu</button></h2><div class="card">`;
      if (!C.P.einnahmen.length) out += `<div class="empty">Keine weiteren Einnahmen.</div>`;
      for (const e of C.P.einnahmen) {
        const ended = e.bis && e.bis < C.today;
        const rn = e.bisRate ? (C.P.raten.find((r) => r.id === e.bisRate) || {}).bez : null;
        out += `<button class="row tap ${ended ? 'dim' : ''}" data-act="edit" data-ent="einnahmen" data-id="${h(e.id)}">${UI.icon(visEin(e))}<div class="main"><div class="t">${h(e.bez)}</div><div class="s">${h(e.rhythmus.toLowerCase())}${e.tag ? ` · am ${e.tag}.` : ''}${e.bis ? ` · bis ${fmy(e.bis)}` : ''}${rn ? ` (mit ${h(rn)})` : ''}</div></div><div class="r amt num pos">+${fmt(num(e.betrag))}</div></button>`;
      }
      out += `</div><h2>Sonderzahlungen<button data-act="new" data-ent="sonder">+ Neu</button></h2><div class="card">`;
      if (!S.sonder.length) out += `<div class="empty">z. B. Urlaubs-/Weihnachtsgeld – nur eintragen, wenn sicher.</div>`;
      for (const x of [...S.sonder].sort((a, b) => (a.monat > b.monat ? 1 : -1))) out += `<button class="row tap" data-act="edit" data-ent="sonder" data-id="${h(x.id)}">${UI.icon(UI.visual('Sonder', ''))}<div class="main"><div class="t">${h(x.bez || 'Sonderzahlung')}</div><div class="s">${fm(D(x.monat))}</div></div><div class="r amt num pos">+${fmt(num(x.betrag))}</div></button>`;
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
    const item = (k, ic, col, t, s) => `<button class="row tap chev" data-act="mehr" data-v="${k}">${UI.icon({ color: col, icon: ic }, 'sq')}<div class="main"><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div></button>`;
    const T = C.topf;
    return `<div class="top"><div><div class="eyebrow">Werkzeuge</div><h1>Mehr</h1></div></div>
      ${lb == null || lb > 14 ? `<button class="banner warn" data-act="mehr" data-v="backup">${UI.svg('save', 'class="bi"')}<span>${lb == null ? 'Noch keine Datensicherung' : `Letzte Sicherung vor ${lb} Tagen`} – jetzt sichern</span></button>` : ''}
      <button class="card topfcard tap" data-act="mehr" data-v="topf">${UI.icon({ color: '#8b5cf6', icon: 'vault' })}<div class="main"><div class="l">Rücklagen-Topf</div><div class="big num">${fmt(T.rows[0] ? T.rows[0].stand : 0)}</div><div class="s">${T.min < 0 ? '⚠ rutscht ins Minus' : T.diff < 0 ? '⚠ Sparrate zu niedrig' : '✔ Sparrate reicht'} · ${fmt(T.ist)}/Monat</div></div>
        <div class="spark">${UI.area(T.rows.slice(0, 12).map((x) => [x.m, x.stand]), { id: 'sp', color: '#8b5cf6' })}</div></button>
      <div class="card" style="margin-top:14px">${item('plan', 'chart', '#0ea5e9', 'Monatsplanung', '8 Jahre Vorschau')}
      ${item('buchungen', 'list', '#1fa36a', 'Alle Buchungen', `${S.buchungen.length} erfasst`)}</div>
      <div class="card">${item('einstellungen', 'gear', '#8a8f98', 'Einstellungen', 'Dispo, Gehaltstag, Puffer, Kategorien')}
      ${item('backup', 'save', '#3b82f6', 'Datensicherung', lb == null ? 'Export / Import' : `zuletzt vor ${lb} ${lb === 1 ? 'Tag' : 'Tagen'}`)}
      ${item('hilfe', 'help', '#f06a35', 'So funktioniert’s', '')}</div>`;
  }
  const backTop = (title, right = '') => `<div class="top"><div><button class="back" data-act="mehr" data-v="">‹ Mehr</button><h1>${title}</h1></div>${right}</div>`;

  function viewTopf() {
    const T = C.topf;
    let out = backTop('Rücklagen-Topf', `<button class="pill" data-act="einstellung" data-f="topfStart">Startbestand</button>`);
    const status = T.min < 0 ? ['bad', 'Der Topf rutscht ins Minus – Sparrate erhöhen oder Startbestand einzahlen.'] : T.diff < 0 ? ['warn', 'Sparrate liegt unter dem Jahresbedarf – auf Dauer reicht es nicht.'] : ['good', 'Die Sparrate deckt alle Zahlungen.'];
    const pts = T.rows.slice(0, 24);
    const minR = pts.slice(0, 12).reduce((a, x) => (x.stand < a.stand ? x : a), pts[0]);
    out += `<div class="banner ${status[0]}">${UI.svg(status[0] === 'good' ? 'shield' : 'help', 'class="bi"')}<span>${status[1]}</span></div>
      <div class="card chart"><div class="ch-head"><div><span>Stand ${fms(pts[0].m)}</span><b class="num">${fmt(pts[0].stand)}</b></div><div class="r"><span>Tiefster (12 Mon.)</span><b class="num ${minR.stand < 0 ? 'neg' : ''}">${fmt(minR.stand)}</b></div></div>
      ${UI.area(pts.map((x) => [x.m, x.stand]), { id: 'tp', color: '#8b5cf6', limit: 0, limitLabel: '0 €', mark: [minR.m, minR.stand, fms(minR.m)], xLabels: [[pts[0].m, fms(pts[0].m), 'start'], [pts[12].m, fms(pts[12].m)], [pts[23].m, fms(pts[23].m), 'end']] })}</div>
      <div class="grid2">
      <div class="tile"><div class="l">Jahresbedarf</div><div class="v num">${fmt(T.bedarf)}</div></div>
      <div class="tile"><div class="l">Startbestand</div><div class="v num">${fmt(num(S.topfStart))}</div></div>
      <div class="tile"><div class="l">Nötige Sparrate</div><div class="v num">${fmt(T.noetig)}</div></div>
      <div class="tile"><div class="l">Aktuelle Sparrate</div><div class="v num">${fmt(T.ist)}</div><div class="s ${T.diff < 0 ? 'neg' : 'pos'}">${plus(T.diff)} / Monat</div></div></div>
      <h2>Fällige Zahlungen</h2><div class="card">`;
    for (const r of T.rows.slice(0, 24).filter((x) => x.faellig > 0)) {
      out += `<div class="row">${UI.icon({ color: '#8b5cf6', icon: 'calendar' })}<div class="main"><div class="t">${fm(r.m)}</div><div class="s">${h(r.details.map((d) => d[0]).join(', '))}</div></div><div class="r"><div class="amt num">${fmt(-r.faellig)}</div><div class="s num">Stand ${fmt(r.stand)}</div></div></div>`;
    }
    return out + `</div><div class="foot">Kosten mit „Bezahlt über: Sparkonto“ laufen über diesen Topf, die Sparrate (Typ „Rücklage“) füllt ihn.</div>`;
  }

  function viewPlan() {
    let out = backTop('Monatsplanung', `<button class="pill" data-act="einstellung" data-f="planStart">Start</button>`);
    const w = C.plan.slice(0, 24);
    out += `<div class="card chart">${UI.bars(w.map((x) => ({ label: MON[ymd(x.m).m - 1][0], v: x.frei, key: x.m, on: x.m === som(C.today) })), { fmt })}<div class="ch-foot">Frei verfügbar · ${fms(w[0].m)} – ${fms(w[w.length - 1].m)}</div></div>`;
    out += `<h2>Alle Monate</h2><div class="card"><table class="t"><thead><tr><th>Monat</th><th>Einn.</th><th>Ausg.</th><th>Frei</th><th>Konto v. G.</th></tr></thead><tbody>`;
    const cur = som(C.today);
    for (const r of C.plan) out += `<tr class="${r.m === cur ? 'cur' : ''}" data-act="mon-set" data-m="${r.m}"><td>${fms(r.m)}${r.ereignisse.length ? `<small>${h(r.ereignisse.join(' · '))}</small>` : ''}</td><td>${fmt(r.einnahmen)}</td><td>${fmt(r.ausgaben)}</td><td class="${sign(r.frei)}">${fmt(r.frei)}</td><td class="${r.kontoVorGehalt != null && r.kontoVorGehalt < -C.K.KDispo ? 'neg' : ''}">${r.kontoVorGehalt == null ? '' : fmt(r.kontoVorGehalt)}</td></tr>`;
    return out + `</tbody></table></div><div class="foot">Ausgaben = Fixkosten (Giro) + Raten + Rücklage + variable Budgets. Tippe auf einen Monat für die Details.</div>`;
  }

  function viewBuchungen() {
    let out = backTop('Buchungen', `<button class="pill" data-act="add">+ Neu</button>`);
    const list = [...S.buchungen].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
    if (!list.length) return out + `<div class="card"><div class="empty">Noch nichts erfasst. Tippe unten auf ＋.</div></div>`;
    const KD = C.K.KDatum;
    let curD = null;
    for (const b of list) {
      const d = D(b.datum);
      if (d !== curD) {
        if (curD != null) out += `</div>`;
        const sum = list.filter((x) => x.datum === b.datum).reduce((a, x) => a + num(x.betrag), 0);
        out += `<div class="dayhdr"><span>${dayLabel(d)}${ymd(d).y !== ymd(C.today).y ? ' ' + ymd(d).y : ''}</span><span class="num">${fmt(-sum)}</span></div><div class="card">`; curD = d;
      }
      const kb = b.kat ? kostenById(b.kat) : null;
      const pending = !b.gebucht && d >= KD;
      out += `<button class="row tap" data-act="edit" data-ent="buchungen" data-id="${h(b.id)}">${UI.icon(visBuchung(b))}
        <div class="main"><div class="t">${h(b.bez || (kb ? kb.bez : 'Ausgabe'))}</div><div class="s">${kb ? h(kb.bez) : num(b.betrag) < 0 ? 'Eingang' : 'ohne Budget'}${pending ? ' · <span class="tag acc">offen</span>' : ''}</div></div>
        <div class="r amt num ${num(b.betrag) < 0 ? 'pos' : ''}">${plus(-num(b.betrag))}</div></button>`;
    }
    return out + `</div>`;
  }

  function viewEinstellungen() {
    const k = S.konto;
    const item = (f, ic, col, t, v) => `<button class="row tap chev" data-act="einstellung" data-f="${f}">${UI.icon({ color: col, icon: ic }, 'sq')}<div class="main"><div class="t">${t}</div></div><div class="r muted">${v}</div></button>`;
    return backTop('Einstellungen') + `<div class="card">
      ${item('dispo', 'bank', '#e5484d', 'Dispo-Rahmen', fmt(num(k.dispo)))}
      ${item('gehaltstag', 'briefcase', '#0ea5e9', 'Gehaltseingang am', `${k.gehaltstag}.`)}
      ${item('puffer', 'shield', '#1fa36a', 'Sicherheitspuffer', fmt(num(k.puffer)))}
      ${item('dispoZins', 'bank', '#9f1239', 'Dispozins', `${String(num(k.dispoZins)).replace('.', ',')} % p. a.`)}</div><div class="foot">Gehaltstag: fällt er aufs Wochenende/Feiertag, zählt der Werktag davor. Der Puffer bleibt immer unangetastet.</div>
      <h2>Planung</h2><div class="card">
      ${item('planStart', 'calendar', '#5b6cf0', 'Planungsstart', fm(som(D(S.planStart))))}
      ${item('topfStart', 'vault', '#8b5cf6', 'Topf-Startbestand', fmt(num(S.topfStart)))}
      ${item('budgetModus', 'chart', '#f0a020', 'Budget-Berechnung', S.budgetModus === 'anteilig' ? 'anteilig' : 'nach Erfassung')}
      ${item('kategorien', 'tag', '#8a8f98', 'Kategorien', S.kategorien.length)}</div>
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
      ['in', '#1fa36a', 'Unterwegs', 'Auf ＋ tippen, Betrag eingeben, Budget wählen, fertig. Die Ausgabe zählt sofort als vorgemerkt und verringert „Frei bis zum Gehalt“ und das Budget.'],
      ['wallet', '#3b82f6', 'Kontostand aktualisieren', 'Kontostand laut Bank (Minus-Schalter bei negativem Stand) + Datum. Erfasste Ausgaben mit älterem Datum fallen dann automatisch raus. Für Ausgaben von heute, die schon gebucht sind: in der Buchung „Schon im Kontostand“ einschalten.'],
      ['shield', '#5b6cf0', 'Frei bis zum Gehalt', 'Was du bis zum nächsten Gehalt für Essen, Tanken & Co. ausgeben kannst, ohne die Dispo-Grenze (minus Puffer) zu reißen – auch wenn du alles sofort ausgibst.'],
      ['list', '#f06a35', 'Neue Kosten', 'Posten → Kosten → Neu. Vierteljährlich/Halbjährlich/Jährlich: „Fällig im Monat“ = Monat der (ersten) Abbuchung. Einmalig: Datum bei „Gültig ab“. Gekündigt? „Gültig bis“ eintragen statt löschen.'],
      ['card', '#e5484d', 'Neue Rate', 'Posten → Raten. Monatsrate, Raten gesamt, bereits bezahlt, nächste Abbuchung – der Rest rechnet sich.'],
      ['vault', '#8b5cf6', 'Sparkonto', '„Bezahlt über Sparkonto“ läuft über den Rücklagen-Topf, nicht übers Girokonto.'],
      ['calendar', '#0ea5e9', 'Feiertage', 'Bundesweite Feiertage werden automatisch berechnet – Buchungen am Wochenende/Feiertag rutschen auf den nächsten Werktag.'],
    ];
    return backTop('So funktioniert’s') + `<div class="card">${p.map(([ic, c, t, x]) => `<div class="row" style="align-items:flex-start">${UI.icon({ color: c, icon: ic }, 'sq')}<div class="main"><div class="t" style="font-weight:600;white-space:normal">${t}</div><div class="s" style="white-space:normal;font-size:14px">${x}</div></div></div>`).join('')}</div>`;
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
      case 'rate': return wrap(`<input id="${id}" name="${k}" inputmode="decimal" placeholder="0,000" value="${h(moneyIn(val))}" autocomplete="off">`);
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
      case 'rate': { const x = parseFloat(String(v).replace(/\s|%/g, '').replace(',', '.')); return isNaN(x) ? null : x; }
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
    const chips = () => budgets.map((b) => { const x = bl.find((y) => y.id === b.id); const v = UI.visual(b.kat, b.bez); return `<button type="button" class="chip ${sel === b.id ? 'on' : ''}" style="--c:${v.color}" data-kat="${h(b.id)}">${UI.icon(v, 'xs')}<span>${h(b.bez)}${x && x.budget > 0 ? `<small>noch ${fmt(x.rest)}</small>` : ''}</span></button>`; }).join('') + `<button type="button" class="chip ${!sel ? 'on' : ''}" style="--c:#8a8f98" data-kat="">${UI.icon(UI.visual('Sonstiges', ''), 'xs')}<span>Ohne Budget</span></button>`;
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

  // Tatsächliche Dispozinsen einer Abrechnung
  function openZins(key, betrag) {
    const cur = (S.zinsIst || {})[key];
    const body = `<form id="frm"><div class="amount"><span>−</span><input id="amt" inputmode="decimal" value="${h(moneyIn(cur != null ? cur : Math.round(betrag * 100) / 100))}"><span>€</span></div>
      <div class="hint">${cur != null ? 'Tatsächlicher Betrag laut Bank ist eingetragen.' : `Geschätzt: ${fmt(betrag)}. Trag hier den Betrag aus der Kontoabrechnung ein – die Schätzung wird dann ersetzt.`}</div>
      ${cur != null ? `<button type="button" class="btn danger" data-act="zins-reset" data-key="${key}">Wieder schätzen lassen</button>` : ''}</form>`;
    openSheet('Dispozinsen ' + fd(D(key)), body, () => {
      const v = parseMoney($('#amt').value);
      if (v == null) { toast('Bitte Betrag eingeben'); return false; }
      const snap = snapshot(); S.zinsIst = { ...(S.zinsIst || {}), [key]: Math.abs(v) }; commit('Dispozinsen gespeichert', restoreFn(snap));
    });
    const a = $('#amt'); a.focus(); a.select();
  }

  // Einzelne Einstellung
  function openEinstellung(f) {
    const defs = {
      dispo: ['Dispo-Rahmen', 'money', S.konto.dispo, (v) => (S.konto.dispo = v || 0)],
      puffer: ['Sicherheitspuffer', 'money', S.konto.puffer, (v) => (S.konto.puffer = v || 0)],
      dispoZins: ['Dispozins (% p. a.)', 'rate', S.konto.dispoZins, (v) => (S.konto.dispoZins = v || 0)],
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
    $('#sheet').innerHTML = `<div class="sh-grab"></div><div class="sh-head"><button data-act="close">Abbrechen</button><b>${h(title)}</b><button class="save" data-act="save">${saveLabel}</button></div><div class="sh-body">${body}</div>`;
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
    S = migrate(normalize(s)); ui.tab = 'jetzt'; ui.mehr = null; persist(); render(); toast('Daten importiert');
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
      if (ui.tab !== t) ui.anim = true;
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
      case 'zins': return openZins(el.dataset.key, +el.dataset.b);
      case 'zins-reset': { const snap = snapshot(); delete S.zinsIst[el.dataset.key]; closeSheet(); commit('Schätzung aktiv', restoreFn(snap)); return; }
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
      case 'mon': ui.monat = edate(ui.monat, +el.dataset.d); ui.anim = +el.dataset.d > 0 ? 'l' : 'r'; return render();
      case 'mon-set': ui.anim = true; ui.tab = 'monat'; ui.monat = +el.dataset.m; render(); return window.scrollTo(0, 0);
      case 'posten-tab': ui.posten = el.dataset.v; ui.anim = true; return render();
      case 'mehr': ui.anim = true; ui.tab = 'mehr'; ui.mehr = el.dataset.v || null; render(); return window.scrollTo(0, 0);
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

  // Gesten: im Monat-Tab seitlich wischen
  (() => {
    let x0 = null, y0 = 0;
    const v = $('#view');
    v.addEventListener('touchstart', (e) => {
      if (ui.tab !== 'monat' || e.target.closest('.hscroll, input, .chart')) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    v.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 45) { ui.monat = edate(ui.monat, dx < 0 ? 1 : -1); ui.anim = dx < 0 ? 'l' : 'r'; render(); }
    }, { passive: true });
  })();
  // Sheet nach unten ziehen zum Schließen
  (() => {
    const sh = $('#sheet'); let y0 = null, dy = 0;
    sh.addEventListener('touchstart', (e) => { if (!e.target.closest('.sh-grab, .sh-head') || e.target.closest('button')) return; y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
    sh.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
    sh.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) closeSheet(); });
  })();

  ui.anim = true;
  render();
  if (migrationMsg) toast(migrationMsg);

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
