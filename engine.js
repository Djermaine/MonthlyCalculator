/* Rechen-Engine – 1:1-Umsetzung der Formeln aus „Mtl. Kosten 2026.xlsx“.
   Datumswerte intern als Tagnummern (Tage seit 1970-01-01, UTC). */
(function (root) {
  'use strict';

  // ---------- Datum ----------
  const DAY = 864e5;
  const mk = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);          // m: 1–12
  const D = (iso) => (iso ? Math.round(Date.parse(iso + 'T00:00:00Z') / DAY) : null);
  const ymd = (n) => { const t = new Date(n * DAY); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  const iso = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weekday = (n) => (((n + 4) % 7) + 7) % 7;                          // 0 = Sonntag
  const som = (n) => { const a = ymd(n); return mk(a.y, a.m, 1); };
  const eomonth = (n, k = 0) => { const a = ymd(n); return mk(a.y, a.m + k + 1, 0); };
  const edate = (n, k) => { const a = ymd(n); const t = ymd(mk(a.y, a.m + k, 1)); return mk(t.y, t.m, Math.min(a.d, dim(t.y, t.m))); };
  const dayIn = (monthStart, tag) => { const a = ymd(monthStart); return mk(a.y, a.m, Math.min(tag, dim(a.y, a.m))); };
  const todayNum = () => { const t = new Date(); return mk(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
  // Ganze Monate zwischen a und b (Excel DATEDIF "m")
  const datedifM = (a, b) => { const x = ymd(a), y = ymd(b); let m = (y.y - x.y) * 12 + (y.m - x.m); if (y.d < x.d) m--; return Math.max(0, m); };

  // ---------- Bundesweite Bank-Feiertage (wie Tabelle „tFeiertage“, aber für jedes Jahr berechnet) ----------
  const holCache = {};
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return mk(y, mo, da);
  }
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    const e = easter(y);
    const list = [
      [mk(y, 1, 1), 'Neujahr'], [e - 2, 'Karfreitag'], [e + 1, 'Ostermontag'], [mk(y, 5, 1), 'Tag der Arbeit'],
      [e + 39, 'Christi Himmelfahrt'], [e + 50, 'Pfingstmontag'], [mk(y, 10, 3), 'Tag der Deutschen Einheit'],
      [mk(y, 12, 25), '1. Weihnachtstag'], [mk(y, 12, 26), '2. Weihnachtstag'],
    ];
    return (holCache[y] = { set: new Set(list.map((x) => x[0])), list });
  }
  const isWorkday = (n) => { const w = weekday(n); return w !== 0 && w !== 6 && !holidays(ymd(n).y).set.has(n); };
  const prevWorkday = (n) => { while (!isWorkday(n)) n--; return n; };   // = WORKDAY(n+1,-1)
  const nextWorkday = (n) => { while (!isWorkday(n)) n++; return n; };   // = WORKDAY(n-1, 1)

  // ---------- Stammdaten-Helfer ----------
  const RHYTHMUS = { 'Monatlich': 1, 'Vierteljährlich': 3, 'Halbjährlich': 6, 'Jährlich': 12, 'Einmalig': 0 };
  const intervall = (r) => (r in RHYTHMUS ? RHYTHMUS[r] : 1);
  const num = (v) => (v === '' || v == null || isNaN(+v) ? 0 : +v);

  // LAMBDA IMMONAT(monat, betrag, von, bis, intervall, fällig)
  function imMonat(m, betrag, von, bis, iv, faell) {
    const ende = eomonth(m, 0);
    const aktiv = (von == null || von <= ende) && (!bis || bis >= m);
    if (!aktiv) return 0;
    let treffer;
    if (iv === 0) {
      if (von == null) return 0;
      const a = ymd(von), b = ymd(m); treffer = a.y === b.y && a.m === b.m;
    } else {
      const x = ymd(m).m - num(faell); treffer = ((x % iv) + iv) % iv === 0;
    }
    return treffer ? num(betrag) : 0;
  }

  // Raten: abgeleitete Spalten
  function rateInfo(r, today) {
    const naechste = D(r.naechste), gesamt = num(r.gesamt), bezahlt = num(r.bezahlt);
    if (naechste == null) return { ...r, erste: null, letzte: null, mehrFreiAb: null, bezahltHeute: bezahlt, offen: gesamt - bezahlt, rest: 0, fortschritt: 0 };
    const erste = edate(naechste, -bezahlt);
    const letzte = edate(naechste, gesamt - bezahlt - 1);
    const mehrFreiAb = eomonth(letzte, 0) + 1;
    const bezahltHeute = Math.min(gesamt, bezahlt + (today >= naechste ? datedifM(naechste, today) + 1 : 0));
    const offen = gesamt - bezahltHeute;
    return { ...r, erste, letzte, mehrFreiAb, bezahltHeute, offen, rest: offen * num(r.rate), fortschritt: gesamt ? bezahltHeute / gesamt : 0 };
  }

  function prepare(s, today) {
    const raten = (s.raten || []).map((r) => rateInfo(r, today));
    const rateById = Object.fromEntries(raten.map((r) => [r.id, r]));
    const kosten = (s.kosten || []).map((k) => {
      const iv = intervall(k.rhythmus);
      return { ...k, iv, von: D(k.ab), bis: D(k.bis), proMonat: iv === 0 ? 0 : num(k.betrag) / iv };
    });
    const einnahmen = (s.einnahmen || []).map((e) => {
      let bis = D(e.bis);
      if (e.bisRate && rateById[e.bisRate] && rateById[e.bisRate].letzte != null) bis = eomonth(rateById[e.bisRate].letzte, 0);
      return { ...e, iv: intervall(e.rhythmus), von: D(e.ab), bis };
    });
    const gehalt = (s.gehalt || []).map((g) => ({ ...g, abN: D(g.ab) })).filter((g) => g.abN != null).sort((a, b) => a.abN - b.abN);
    const sonder = (s.sonder || []).map((x) => ({ ...x, mN: D(x.monat) })).filter((x) => x.mN != null);
    return { raten, kosten, einnahmen, gehalt, sonder };
  }

  const kostenIm = (k, m) => imMonat(m, k.betrag, k.von, k.bis, k.iv, k.faellig);
  const einnIm = (e, m) => imMonat(m, e.betrag, e.von, e.bis, e.iv, e.faellig);
  const rateIm = (r, m) => (r.erste != null && r.erste <= eomonth(m, 0) && r.letzte >= m ? num(r.rate) : 0);
  function gehaltIm(P, m) { let v = 0; for (const g of P.gehalt) { if (g.abN <= m) v = num(g.netto); else break; } return v; }

  // ---------- Monatsplanung (tPlan) ----------
  function planMonth(P, m) {
    const gehalt = gehaltIm(P, m);
    const weitere = P.einnahmen.reduce((a, e) => a + einnIm(e, m), 0);
    const mm = ymd(m);
    const sonder = P.sonder.reduce((a, x) => { const t = ymd(x.mN); return a + (t.y === mm.y && t.m === mm.m ? num(x.betrag) : 0); }, 0);
    let fix = 0, ruecklage = 0, variabel = 0, sparkonto = 0;
    for (const k of P.kosten) {
      const v = kostenIm(k, m); if (!v) continue;
      if (k.typ === 'Fixkosten' && k.ueber === 'Girokonto') fix += v;
      if (k.typ === 'Fixkosten' && k.ueber === 'Sparkonto') sparkonto += v;
      if (k.typ === 'Rücklage') ruecklage += v;
      if (k.typ === 'Variabel') variabel += v;
    }
    const raten = P.raten.reduce((a, r) => a + rateIm(r, m), 0);
    const einnahmen = gehalt + weitere + sonder;
    const ausgaben = fix + raten + ruecklage + variabel;
    return { m, gehalt, weitere, sonder, einnahmen, fix, raten, ruecklage, variabel, sparkonto, ausgaben, frei: einnahmen - ausgaben };
  }

  // ---------- Konto jetzt ----------
  function kontoJetzt(s, P, today) {
    const k = s.konto || {};
    const KStand = num(k.stand), KDatum = D(k.datum) ?? today, KDispo = num(k.dispo), KPuffer = num(k.puffer);
    const tag = Math.max(1, Math.min(31, num(k.gehaltstag) || 1));

    // Gehaltszyklus
    const t = ymd(KDatum);
    const c = prevWorkday(mk(t.y, t.m, Math.min(tag, dim(t.y, t.m))));
    const p = ymd(eomonth(KDatum, -1));
    const ZStart = c <= KDatum ? c : prevWorkday(mk(p.y, p.m, Math.min(tag, p.d)));
    const e = ymd(eomonth(ZStart, 1));
    const ZEnde = prevWorkday(mk(e.y, e.m, Math.min(tag, e.d)));

    // Budgets (Kosten, Typ Variabel)
    const budgets = P.kosten.filter((x) => x.typ === 'Variabel');
    const KBudget = budgets.reduce((a, x) => a + x.proMonat, 0);
    const buchungen = (s.buchungen || []).map((b) => ({ ...b, dN: D(b.datum) })).filter((b) => b.dN != null);
    const spent = {};
    for (const b of buchungen) if (b.kat && b.dN >= ZStart && b.dN < ZEnde) spent[b.kat] = (spent[b.kat] || 0) + num(b.betrag);
    const budgetListe = budgets.map((x) => ({ id: x.id, bez: x.bez, budget: x.proMonat, ausgegeben: spent[x.id] || 0, rest: x.proMonat - (spent[x.id] || 0) }));
    const restTage = Math.max(0, ZEnde - KDatum), zyklusTage = Math.max(1, ZEnde - ZStart);
    const KBudgetRest = s.budgetModus === 'anteilig'
      ? KBudget * restTage / zyklusTage
      : budgetListe.reduce((a, x) => a + Math.max(0, x.rest), 0);
    const KBudgetTag = KBudgetRest / Math.max(1, ZEnde - KDatum);

    // Register der Buchungen im Zyklus (Formel in 'Konto jetzt'!B29)
    const m1 = eomonth(ZStart, -1) + 1, m2 = edate(m1, 1);
    const reg = [];
    const push = (nd, name, a, src, obj) => {
      const d = nextWorkday(nd);
      reg.push({ d, nd, name, a, src, kat: obj.kat || null, ref: obj.id, status: d <= KDatum ? 'erledigt' : 'offen', verschoben: d !== nd, ok: a !== 0 && d >= ZStart && d < ZEnde });
    };
    for (const m of [m1, m2]) for (const x of P.kosten) {
      if (x.ueber !== 'Girokonto' || x.typ === 'Variabel') continue;
      push(dayIn(m, num(x.tag) || 1), x.bez, -kostenIm(x, m), 'kosten', x);
    }
    for (const m of [m1, m2]) for (const r of P.raten) {
      if (r.erste == null) continue;
      const rd = dayIn(m, ymd(D(r.naechste)).d);
      push(rd, r.bez, -(num(r.rate) * (rd >= r.erste && rd <= r.letzte ? 1 : 0)), 'rate', r);
    }
    for (const m of [m1, m2]) for (const x of P.einnahmen) push(dayIn(m, num(x.tag) || 1), x.bez, einnIm(x, m), 'einnahme', x);
    const rows = reg.filter((r) => r.ok);
    for (const b of buchungen) {
      if (!num(b.betrag) || b.gebucht || b.dN < KDatum) continue;
      rows.push({ d: b.dN, nd: b.dN, name: b.bez || (b.kat ? (budgets.find((x) => x.id === b.kat) || {}).bez : '') || 'vorgemerkt', a: -num(b.betrag), src: 'buchung', id: b.id, kat: b.kat || null, status: 'vorgemerkt', verschoben: false });
    }
    rows.forEach((r, i) => (r.i = i));
    rows.sort((x, y) => x.d - y.d || x.a - y.a || x.i - y.i);
    let acc = 0;
    for (const r of rows) {
      if (r.status !== 'erledigt') acc += r.a;
      r.run = r.status === 'erledigt' ? null : KStand + acc - KBudgetTag * (r.d > KDatum ? r.d - KDatum : 0);
    }
    const KOffenAus = rows.filter((r) => r.status !== 'erledigt' && r.a < 0).reduce((a, r) => a + r.a, 0);
    const KOffenEin = rows.filter((r) => r.status !== 'erledigt' && r.a > 0).reduce((a, r) => a + r.a, 0);
    const KVorGehalt = KStand + KOffenAus + KOffenEin;
    const runs = rows.filter((r) => r.run != null);
    const KMin = Math.min(KStand, ...runs.map((r) => r.run), KVorGehalt - KBudgetRest);
    let KMinDatum = ZEnde - 1;
    if (KMin === KStand) KMinDatum = KDatum; else { const hit = runs.find((r) => r.run === KMin); if (hit) KMinDatum = hit.d; }
    const KMinOhne = Math.min(KStand, ...runs.map((r) => r.run + KBudgetTag * (r.d > KDatum ? r.d - KDatum : 0)));
    const KFrei = KMinOhne + KDispo - KPuffer;
    const KWorst = Math.min(KStand, KStand + KOffenAus - KBudgetRest);
    const KFreiSicher = KWorst + KDispo - KPuffer;
    const tageBisGehalt = Math.max(1, ZEnde - KDatum);
    return {
      KStand, KDatum, KDispo, KPuffer, gehaltstag: tag, ZStart, ZEnde, KBudget, KBudgetRest, KBudgetTag, budgetListe,
      rows, KOffenAus, KOffenEin, KVorGehalt, KMin, KMinDatum, KMinOhne, KFrei, KRest: KFrei - KBudgetRest,
      KWorst, KFreiSicher, tageBisGehalt, proTag: KFrei / tageBisGehalt, veraltet: Math.max(0, today - KDatum),
    };
  }

  // ---------- Gesamtberechnung ----------
  function compute(s, today = todayNum()) {
    const P = prepare(s, today);
    const K = kontoJetzt(s, P, today);
    const planStart = som(D(s.planStart) ?? today);
    const plan = [];
    for (let i = 0; i < 96; i++) plan.push(planMonth(P, edate(planStart, i)));
    const m0 = som(K.ZStart + 15);
    let cum = 0;
    plan.forEach((r, i) => {
      r.veraenderung = i === 0 ? 0 : r.frei - plan[i - 1].frei;
      if (r.m > m0) cum += r.frei;
      r.kontoVorGehalt = r.m < m0 ? null : K.KVorGehalt - K.KBudgetRest + cum;
      const ev = [];
      if (i > 0 && r.gehalt !== plan[i - 1].gehalt) ev.push('Neues Netto: ' + fmt(r.gehalt));
      if (r.sonder > 0) ev.push('Sonderzahlung +' + fmt(r.sonder));
      for (const x of P.raten) if (x.mehrFreiAb === r.m) ev.push(x.bez + ' abbezahlt (+' + fmt(num(x.rate)) + ')');
      for (const x of P.einnahmen) if (x.bis && eomonth(x.bis, 0) + 1 === r.m) ev.push(x.bez + ' endet (−' + fmt(num(x.betrag)) + ')');
      r.ereignisse = ev;
    });

    // Ausblick 12 Monate (Formel 'Konto jetzt'!F25)
    const next12 = plan.filter((r) => r.kontoVorGehalt != null).slice(0, 12);
    let ausblick = null;
    if (next12.length) {
      const mn = Math.min(...next12.map((r) => r.kontoVorGehalt));
      const w = next12.find((r) => r.kontoVorGehalt === mn);
      ausblick = { min: mn, monat: w.m, status: mn < -K.KDispo ? 'ueber' : mn < -K.KDispo + K.KPuffer ? 'knapp' : 'ok' };
    }
    const naechstesGehalt = (plan.find((r) => r.m === eomonth(K.ZEnde, 0) + 1) || {}).gehalt || 0;

    // Rücklagen-Topf
    const topfBedarf = P.kosten.filter((x) => x.ueber === 'Sparkonto' && x.typ === 'Fixkosten').reduce((a, x) => a + x.proMonat, 0) * 12;
    const topfNoetig = topfBedarf / 12;
    const topfIst = P.kosten.filter((x) => x.typ === 'Rücklage').reduce((a, x) => a + x.proMonat, 0);
    let stand = num(s.topfStart);
    const topf = plan.map((r) => {
      const details = P.kosten.filter((x) => x.typ === 'Fixkosten' && x.ueber === 'Sparkonto').map((x) => [x.bez, kostenIm(x, r.m)]).filter((x) => x[1] > 0);
      stand += r.ruecklage - r.sparkonto;
      return { m: r.m, einzahlung: r.ruecklage, faellig: r.sparkonto, details, stand };
    });
    const topfMin = Math.min(...topf.slice(0, 12).map((x) => x.stand));

    return { today, P, K, plan, ausblick, naechstesGehalt, topf: { bedarf: topfBedarf, noetig: topfNoetig, ist: topfIst, diff: topfIst - topfNoetig, min: topfMin, rows: topf } };
  }

  // Ausgabenliste eines Monats (Übersicht B13)
  function monatsPosten(P, m) {
    const a = [];
    for (const k of P.kosten) { const v = kostenIm(k, m) * (k.ueber === 'Girokonto' ? 1 : 0); if (v > 0) a.push({ bez: k.bez, kat: k.kat, betrag: v, typ: k.typ }); }
    for (const r of P.raten) { const v = rateIm(r, m); if (v > 0) a.push({ bez: r.bez, kat: 'Rate', betrag: v, typ: 'Rate' }); }
    return a.sort((x, y) => y.betrag - x.betrag);
  }

  const nf = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const fmt = (v) => nf.format(Math.abs(v) < 0.005 ? 0 : v);

  const api = { compute, monatsPosten, imMonat, holidays, fmt, D, iso, ymd, mk, som, eomonth, edate, weekday, todayNum, intervall, RHYTHMUS, isWorkday };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof self !== 'undefined' ? self : this);
