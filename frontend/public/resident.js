import { I } from './icons.js';
import { api, subscribe } from './api.js';
import { getLaunchParams } from './bridge.js';

const CATS = {
  avaria:  { label: 'Авария',       icon: I.drop },
  musor:   { label: 'Вывоз мусора', icon: I.trash },
  svet:    { label: 'Освещение',    icon: I.bulb },
  domofon: { label: 'Домофон',      icon: I.door },
  lift:    { label: 'Лифт',         icon: I.elevator },
  other:   { label: 'Прочее',       icon: I.dots },
};
const METER_ICON = { cold: I.drop, hot: I.fire, el: I.bolt, gas: I.gas };
const TINT = { blue: '--tint-blue', warm: '--tint-warm', amber: '--o-bg', green: '--g-bg' };

const model = { overview: null, charges: null, meters: null, requests: [], notifCount: 0 };
const ui = { tab: 'home', newReq: { cat: 'avaria', desc: '', photo: false } };

const $ = s => document.querySelector(s);
const money = n => n.toLocaleString('ru-RU') + ' ₽';

let toastT;
function toast(msg, err) {
  const t = $('#toast'); t.className = err ? 'err' : '';
  t.innerHTML = (err ? I.warn : I.check) + '<span>' + msg + '</span>';
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

async function loadAll() {
  const [overview, charges, meters, requests, notif] = await Promise.all([
    api.overview(), api.charges(), api.meters(), api.requests('mine'), api.notifications(),
  ]);
  model.overview = overview; model.charges = charges; model.meters = meters.meters;
  model.metersSubmitted = meters.submitted; model.requests = requests.requests;
  model.notifCount = notif.notifications.length;
}

/* ---------- screens ---------- */
function screenHome() {
  const o = model.overview, d = o.debt;
  const debtCard = d.paid
    ? `<div class="debt paid"><div class="lbl">Начисления за ${o.period}</div>
        <div class="amt">${I.check} Оплачено</div><div class="due">Квитанция придёт в чат MAX</div></div>`
    : `<div class="debt"><div class="lbl">Задолженность на 17 сентября</div>
        <div class="row"><div><div class="amt tnum">${money(d.amount)}</div>
        <div class="due">Оплатить до ${d.due}</div></div>
        <button class="btn-amber" data-action="go-pay">Оплатить</button></div></div>`;
  const feed = (o.events || []).map(e => {
    const cls = e.kind, ic = e.kind === 'warn' ? I.warn : e.kind === 'info' ? I.wrench : I.check;
    return `<div class="evt ${cls}"><div class="eic">${ic}</div>
      <div class="etxt"><div class="et">${e.title}</div><div class="es">${e.sub}</div></div></div>`;
  }).join('') || `<div class="evt ok"><div class="eic">${I.check}</div><div class="etxt"><div class="et">Всё в порядке</div><div class="es">Активных напоминаний нет</div></div></div>`;
  const bellDot = model.notifCount ? '<span class="dot"></span>' : '';
  return `
    <div class="apphead" style="padding-bottom:6px"><div class="grow"></div>
      <button class="iconbtn" data-action="noop">${bellDot}${I.bell}</button></div>
    <div class="card greet"><div><div class="addr">${o.user.addr}</div>
      <div class="hi">Здравствуйте,<br>${o.user.name}</div></div></div>
    ${debtCard}
    <div class="tiles">
      <button class="tile" data-action="tab" data-tab="meters"><div class="ic">${I.clock}</div><span>Показания</span></button>
      <button class="tile" data-action="new-request"><div class="ic">${I.pencil}</div><span>Заявка</span></button>
      <button class="tile" data-action="tab" data-tab="requests"><div class="ic">${I.folder}</div><span>История</span></button>
    </div>
    <div class="sec-title">Ближайшие события</div>${feed}`;
}

function screenMeters() {
  const rows = model.meters.map(m => {
    const icon = METER_ICON[m.id] || I.gauge, tint = TINT[m.tint] || '--surface-alt';
    if (model.metersSubmitted && m.cur != null) {
      return `<div class="meter done"><div class="mh">
        <div class="mic" style="background:var(${tint})">${icon}</div>
        <div><div class="mn">${m.name}</div><div class="mp">Передано: ${m.cur} ${m.unit}</div></div></div>
        <div class="m-sent">${I.check} Показания приняты${m.consumption != null ? ' · расход ' + m.consumption + ' ' + m.unit : ''}</div></div>`;
    }
    return `<div class="meter"><div class="mh">
      <div class="mic" style="background:var(${tint})">${icon}</div>
      <div><div class="mn">${m.name}</div><div class="mp">Предыдущее: ${m.prev} ${m.unit}</div></div></div>
      <div class="mrow"><input class="inp tnum" id="mtr-${m.id}" inputmode="decimal" placeholder="Новое значение"><span class="unit">${m.unit}</span></div></div>`;
  }).join('');
  const btn = model.metersSubmitted
    ? `<div class="m-sent" style="justify-content:center;margin-top:14px">${I.check} Показания отправлены</div>`
    : `<button class="btn-navy" data-action="submit-meters">Отправить показания</button>`;
  return `<div class="apphead"><button class="back" data-action="tab" data-tab="home">${I.back}</button><h2>Показания счётчиков</h2></div>${rows}${btn}`;
}

function screenPayments() {
  const c = model.charges;
  const lines = c.charges.map(x => `<div class="payline"><span class="pl">${x[0]}</span><span class="pv tnum">${money(x[1])}</span></div>`).join('');
  const hist = c.history.map(h => `<div class="histitem"><div><div class="hm">${h.month}</div><div class="hs">${I.check} Оплачено</div></div><div class="ha tnum">${money(h.amount)}</div></div>`).join('');
  const payBtn = c.debt.paid
    ? `<button class="btn-amber" style="width:100%;margin:14px 0 4px;text-align:center" disabled>Начисления за сентябрь оплачены</button>`
    : `<button class="btn-amber" style="width:100%;margin:14px 0 4px;text-align:center" data-action="pay-now">Оплатить ${money(c.total)}</button>`;
  return `<div class="apphead"><button class="back" data-action="tab" data-tab="home">${I.back}</button><h2>Платежи</h2></div>
    <div class="card paycard"><div class="pmonth">Начислено за ${c.period}</div>${lines}
      <div class="paytotal"><span>Итого</span><span class="tv tnum">${money(c.total)}</span></div></div>
    ${payBtn}<div class="sec-title" style="margin-top:18px">История платежей</div>${hist}`;
}

function screenRequests() {
  const list = model.requests.map(r => {
    const st = { new: ['Новая', 'new'], progress: ['В работе', 'prog'], done: ['Выполнено', 'done'] }[r.status];
    const msg = r.adminMsg ? `<div class="rmsg">${I.msg}<span>${r.adminMsg}</span></div>` : '';
    return `<div class="req"><div style="min-width:0">
      <div class="rt">${r.title}</div>
      <div class="rm">№${r.id} · ${r.date} · ${r.catLabel}</div>${msg}</div>
      <span class="badge ${st[1]}">${st[0]}</span></div>`;
  }).join('');
  return `<div class="apphead"><h2>Заявки</h2><div class="grow"></div>
    <button class="iconbtn" style="background:var(--navy);border:none;color:#fff" data-action="new-request">${I.plus}</button></div>${list}`;
}

function screenNewRequest() {
  const chips = Object.entries(CATS).map(([k, c]) => `
    <button class="chip ${ui.newReq.cat === k ? 'sel' : ''}" data-action="pick-cat" data-cat="${k}">${c.icon}${c.label}</button>`).join('');
  const att = ui.newReq.photo
    ? `<div class="attach on">${I.check} Фото прикреплено (демо)</div>`
    : `<button class="attach" data-action="attach-photo">${I.plus} Прикрепить фото</button>`;
  return `<div class="apphead"><button class="back" data-action="cancel-request">${I.back}</button><h2>Новая заявка</h2></div>
    <div class="field-lbl">Что случилось?</div><div class="chips">${chips}</div>
    <div class="field-lbl">Опишите проблему</div>
    <textarea class="inp" id="req-desc" placeholder="Например: прорвало трубу в ванной, вода уходит под пол…">${ui.newReq.desc}</textarea>
    ${att}<div style="height:14px"></div>
    <button class="btn-navy" data-action="submit-request">Отправить заявку</button>
    <div class="plabel" style="margin-top:12px">Заявка уйдёт диспетчеру УК. Ответ придёт в чат MAX.</div>`;
}

function currentScreen() {
  switch (ui.tab) {
    case 'meters': return screenMeters();
    case 'payments': return screenPayments();
    case 'requests': return screenRequests();
    case 'new': return screenNewRequest();
    default: return screenHome();
  }
}

function render() {
  if (!model.overview) return;
  const nav = [['home', I.home, 'Главная'], ['meters', I.gauge, 'Счётчики'], ['payments', I.card, 'Платежи'], ['requests', I.pencil, 'Заявки']];
  const active = ui.tab === 'new' ? 'requests' : ui.tab;
  const navHtml = nav.map(n => `<button class="${active === n[0] ? 'active' : ''}" data-action="tab" data-tab="${n[0]}">${n[1]}<span>${n[2]}</span></button>`).join('');
  $('#stage').innerHTML = `
    <div class="phone-wrap"><div class="phone">
      <div class="statusbar"><span>9:41</span><div class="dots">${I.wifi}${I.battery}</div></div>
      <div class="maxbar"><span class="mx"><b>MAX</b> Умный дом</span><span>· вход через бота</span></div>
      <div class="screen">${currentScreen()}</div>
      <div class="bnav">${navHtml}</div>
    </div></div>`;
}

function captureDesc() { const t = $('#req-desc'); if (t) ui.newReq.desc = t.value; }

/* ---------- actions ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  try {
    switch (a) {
      case 'tab': ui.tab = b.dataset.tab; render(); break;
      case 'go-pay': ui.tab = 'payments'; render(); break;
      case 'new-request': ui.newReq = { cat: 'avaria', desc: '', photo: false }; ui.tab = 'new'; render(); break;
      case 'cancel-request': ui.tab = 'requests'; render(); break;
      case 'pick-cat': captureDesc(); ui.newReq.cat = b.dataset.cat; render(); break;
      case 'attach-photo': captureDesc(); ui.newReq.photo = true; render(); toast('Фото прикреплено'); break;
      case 'submit-request': {
        captureDesc();
        const desc = ui.newReq.desc.trim();
        if (!desc) { toast('Опишите проблему', true); break; }
        const { request } = await api.createRequest(ui.newReq.cat, desc);
        await loadAll(); ui.tab = 'requests'; render();
        toast('Заявка №' + request.id + ' создана');
        break;
      }
      case 'submit-meters': {
        const readings = [];
        for (const m of model.meters) {
          const inp = $('#mtr-' + m.id); if (!inp || inp.value.trim() === '') continue;
          readings.push({ meterId: m.id, value: inp.value.trim() });
        }
        if (!readings.length) { toast('Введите хотя бы одно значение', true); break; }
        await api.submitMeters(readings);
        await loadAll(); render();
        toast('Показания отправлены');
        break;
      }
      case 'pay-now': await api.pay(); await loadAll(); render(); toast('Оплата прошла успешно'); break;
      case 'noop': break;
    }
  } catch (err) { toast(err.message || 'Ошибка', true); }
});

/* ---------- live ---------- */
function setConn(on) { const c = $('#conn'); c.className = 'conn' + (on ? ' on' : ''); c.innerHTML = '<span class="d"></span>' + (on ? 'обновления в реальном времени' : 'переподключение…'); }

async function start() {
  try {
    const launchParams = await getLaunchParams();
    await api.auth(launchParams);           // вход через MAX (или DEV-режим)
    await loadAll();
    render();
    const es = subscribe(async () => { await loadAll(); render(); });
    es.onopen = () => setConn(true);
    es.onerror = () => setConn(false);
    setConn(true);
  } catch (err) {
    $('#stage').innerHTML = `<div class="empty" style="margin:60px auto">${I.warn}<p>Не удалось загрузить данные.<br>${err.message}</p></div>`;
  }
}
start();
