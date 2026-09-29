import { I } from './icons.js';
import { api, subscribe } from './api.js';
import { getLaunchParams } from './bridge.js';

// Категории заявки (UI). backendCat — ближайший ключ каталога категорий на бэкенде
// (см. backend/src/seed.js CATS), чтобы заявка сохранялась и попадала в статистику диспетчера.
const CATS = {
  santeh:  { label: 'Сантехника',      icon: I.drop,     backendCat: 'avaria' },
  elektr:  { label: 'Электрика',       icon: I.bolt,     backendCat: 'svet' },
  domofon: { label: 'Домофон',         icon: I.door,     backendCat: 'domofon' },
  obshee:  { label: 'Общее имущество', icon: I.elevator, backendCat: 'lift' },
  other:   { label: 'Другое',          icon: I.dots,     backendCat: 'other' },
};
// Демо-каталог специалистов (в MVP бэкенд не хранит именной каталог с рейтингом —
// диспетчер назначает мастера свободным текстом при взятии заявки в работу).
const SPECIALISTS = [
  { id: 'igor',   name: 'Игорь Петров',   role: 'Сантехник', rating: 4.9 },
  { id: 'sergey', name: 'Сергей Волков',  role: 'Сантехник', rating: 4.7 },
  { id: 'any',    name: 'Любой доступный', role: 'Назначим быстрее всего', rating: null },
];
const SLOT_OPTIONS = ['Сегодня', 'Завтра', 'Как можно быстрее'];
const METER_ICON = { cold: I.drop, hot: I.fire, el: I.bolt, gas: I.gas };
const TINT = { blue: '--tint-blue', warm: '--tint-warm', amber: '--o-bg', green: '--g-bg' };

const model = { overview: null, charges: null, meters: null, requests: [], notifications: [], notifCount: 0 };
const ui = { tab: 'home', selectedRequestId: null, notifOpen: false, loading: true, startError: null, newReq: { cat: 'santeh', desc: '', specialist: 'any', slot: SLOT_OPTIONS[0] } };

function initials(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

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
  model.notifications = notif.notifications; model.notifCount = notif.notifications.length;
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
  const notifPanel = ui.notifOpen ? `
    <div class="notif-panel">
      <div class="notif-head"><span>Уведомления</span><button data-action="close-notif">${I.back}</button></div>
      ${model.notifications.length
        ? model.notifications.map(n => `<div class="notif-item"><div class="ni-ic">${I.msg}</div>
            <div><div class="ni-text">${n.text}</div><div class="ni-date">${n.date}</div></div></div>`).join('')
        : `<div class="notif-empty">Пока нет уведомлений</div>`}
    </div>` : '';
  return `
    <div class="apphead" style="padding-bottom:6px;position:relative"><div class="grow"></div>
      <button class="iconbtn" data-action="toggle-notif">${bellDot}${I.bell}</button>${notifPanel}</div>
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
    return `<div class="req" style="cursor:pointer" data-action="open-request" data-id="${r.id}"><div style="min-width:0">
      <div class="rt">${r.title}</div>
      <div class="rm">№${r.id} · ${r.date} · ${r.catLabel}</div>${msg}</div>
      <span class="badge ${st[1]}">${st[0]}</span></div>`;
  }).join('');
  return `<div class="apphead"><h2>Заявки</h2><div class="grow"></div>
    <button class="iconbtn" style="background:var(--navy);border:none;color:#fff" data-action="new-request">${I.plus}</button></div>${list}`;
}

function timelineHtml(r) {
  const steps = [
    { label: 'Заявка принята', sub: r.date, state: 'done' },
    { label: 'Специалист назначен', sub: r.specialist || '', state: r.specialist ? 'done' : 'pending' },
    { label: 'В пути', sub: r.status === 'progress' && r.slot ? 'Ожидается к ' + r.slot : '', state: r.status === 'progress' ? 'active' : r.status === 'done' ? 'done' : 'pending' },
    { label: 'Выполнена', sub: r.status === 'done' ? (r.resolution || '') : '', state: r.status === 'done' ? 'done' : 'pending' },
  ];
  return steps.map(s => `<div class="tl-item ${s.state}">
    <div class="tl-dot">${s.state === 'done' ? I.check : ''}</div>
    <div class="tl-text"><div class="tl-label">${s.label}</div>${s.sub ? `<div class="tl-sub">${s.sub}</div>` : ''}</div></div>`).join('');
}

function screenRequestDetail() {
  const r = model.requests.find(x => x.id === ui.selectedRequestId);
  if (!r) return screenRequests();
  const known = SPECIALISTS.find(s => r.specialist && r.specialist.startsWith(s.name.split(' ')[0]));
  const rating = known?.rating || (r.specialist ? 4.8 : null);
  const specHtml = r.specialist ? `
    <div class="spec-row">
      <div class="spec-avatar">${initials(r.specialist)}</div>
      <div class="spec-info"><div class="spec-name">${r.specialist}</div>
        <div class="spec-role">${r.specialty || ''}${rating ? ' · ' + I.star + ' ' + rating : ''}</div></div>
      <button class="spec-call" data-action="demo-call">${I.phone}</button>
    </div>` : '';
  return `<div class="apphead"><button class="back" data-action="tab" data-tab="requests">${I.back}</button><h2>Заявка №${r.id}</h2></div>
    <div class="card" style="padding:16px 18px;margin-bottom:12px">
      <div class="rt" style="font-size:16px">${r.title}</div>
      <div class="rm" style="margin-top:5px">${r.apt || ''} · ${r.catLabel}</div>
    </div>
    <div class="card" style="padding:16px 18px 12px;margin-bottom:12px"><div class="timeline">${timelineHtml(r)}</div></div>
    ${specHtml}
    <div class="detail-actions">
      <button class="btn-ghost" data-action="demo-chat">Написать в чат</button>
      <button class="btn-danger-outline" data-action="demo-complain">${I.flag}Пожаловаться</button>
    </div>`;
}

function screenNewRequest() {
  const catChips = Object.entries(CATS).map(([k, c]) => `
    <button class="chip ${ui.newReq.cat === k ? 'sel' : ''}" data-action="pick-cat" data-cat="${k}">${c.icon}${c.label}</button>`).join('');
  const specCards = SPECIALISTS.map(s => `
    <button class="spec-card ${ui.newReq.specialist === s.id ? 'sel' : ''}" data-action="pick-spec" data-spec="${s.id}">
      <div class="spec-avatar ${s.id === 'any' ? 'any' : ''}">${s.id === 'any' ? '?' : initials(s.name)}</div>
      <div class="spec-info"><div class="spec-name">${s.name}</div><div class="spec-role">${s.role}</div></div>
      ${s.rating ? `<span class="spec-rating">${I.star}${s.rating}</span>` : ''}
    </button>`).join('');
  const slotChips = SLOT_OPTIONS.map(s => `
    <button class="chip ${ui.newReq.slot === s ? 'sel' : ''}" data-action="pick-slot" data-slot="${s}">${s}</button>`).join('');
  return `<div class="apphead"><button class="back" data-action="cancel-request">${I.back}</button><h2>Новая заявка</h2></div>
    <div class="field-lbl" style="margin-top:2px">Что случилось?</div>
    <textarea class="inp" id="req-desc" placeholder="Опишите проблему подробно">${ui.newReq.desc}</textarea>
    <div class="field-lbl">Тип проблемы</div><div class="chips">${catChips}</div>
    <div class="field-lbl">Выберите специалиста</div><div class="spec-list">${specCards}</div>
    <div class="field-lbl">Когда вам удобно?</div><div class="chips slot-row">${slotChips}</div>
    <div class="notice-green">Работы по заявкам ЖКУ бесплатны — тариф уже включён в квитанцию. Если специалист требует оплату наличными, укажите это в заявке или пожалуйтесь после визита.</div>
    <button class="btn-navy" data-action="submit-request" style="margin-top:14px">Отправить заявку</button>`;
}

function skeletonPhone() {
  const bar = (w) => `<div class="sk-bar" style="width:${w}"></div>`;
  return `
    <div class="phone-wrap"><div class="phone">
      <div class="statusbar"><span>9:41</span><div class="dots">${I.wifi}${I.battery}</div></div>
      <div class="maxbar"><span class="mx"><b>MAX</b> Умный дом</span><span>· вход через бота</span></div>
      <div class="screen">
        <div class="apphead" style="padding-bottom:6px"><div class="grow"></div><div class="sk-circle"></div></div>
        <div class="sk-card" style="height:70px">${bar('40%')}${bar('70%')}</div>
        <div class="sk-card" style="height:96px;margin-top:12px">${bar('50%')}${bar('30%')}</div>
        <div class="tiles" style="margin-top:14px">
          <div class="sk-tile"></div><div class="sk-tile"></div><div class="sk-tile"></div>
        </div>
        <div class="sk-card" style="height:56px">${bar('60%')}</div>
      </div>
      <div class="bnav"></div>
    </div></div>`;
}

function errorScreen(message) {
  return `<div class="empty" style="margin:60px auto">${I.warn}<p>Не удалось загрузить данные.<br>${message}</p>
    <button class="btn-navy" style="margin-top:16px;width:auto;padding:12px 22px" data-action="retry-start">Повторить</button></div>`;
}

function currentScreen() {
  switch (ui.tab) {
    case 'meters': return screenMeters();
    case 'payments': return screenPayments();
    case 'requests': return screenRequests();
    case 'new': return screenNewRequest();
    case 'request-detail': return screenRequestDetail();
    default: return screenHome();
  }
}

function render() {
  if (ui.startError) { $('#stage').innerHTML = errorScreen(ui.startError); return; }
  if (!model.overview) { $('#stage').innerHTML = skeletonPhone(); return; }
  const nav = [['home', I.home, 'Главная'], ['meters', I.gauge, 'Счётчики'], ['payments', I.card, 'Платежи'], ['requests', I.pencil, 'Заявки']];
  const active = (ui.tab === 'new' || ui.tab === 'request-detail') ? 'requests' : ui.tab;
  const navHtml = nav.map(n => `<button class="${active === n[0] ? 'active' : ''}" data-action="tab" data-tab="${n[0]}">${n[1]}<span>${n[2]}</span></button>`).join('');
  $('#stage').innerHTML = `
    <div class="phone-wrap"><div class="phone">
      <div class="statusbar"><span>9:41</span><div class="dots">${I.wifi}${I.battery}</div></div>
      <div class="maxbar"><span class="mx"><b>MAX</b> Умный дом</span><span>· вход через бота</span></div>
      <div class="screen"><div class="fade-in" key="${ui.tab}">${currentScreen()}</div></div>
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
      case 'new-request': ui.newReq = { cat: 'santeh', desc: '', specialist: 'any', slot: SLOT_OPTIONS[0] }; ui.tab = 'new'; render(); break;
      case 'cancel-request': ui.tab = 'requests'; render(); break;
      case 'open-request': ui.selectedRequestId = Number(b.dataset.id); ui.tab = 'request-detail'; render(); break;
      case 'pick-cat': captureDesc(); ui.newReq.cat = b.dataset.cat; render(); break;
      case 'pick-spec': captureDesc(); ui.newReq.specialist = b.dataset.spec; render(); break;
      case 'pick-slot': captureDesc(); ui.newReq.slot = b.dataset.slot; render(); break;
      case 'demo-chat': toast('Чат с диспетчером откроется в MAX'); break;
      case 'demo-complain': toast('Жалоба отправлена диспетчеру'); break;
      case 'demo-call': toast('Звонок специалисту (демо)'); break;
      case 'toggle-notif': ui.notifOpen = !ui.notifOpen; render(); break;
      case 'close-notif': ui.notifOpen = false; render(); break;
      case 'submit-request': {
        captureDesc();
        const desc = ui.newReq.desc.trim();
        if (!desc) { toast('Опишите проблему', true); break; }
        const specialist = SPECIALISTS.find(s => s.id === ui.newReq.specialist);
        const extra = [];
        if (specialist && specialist.id !== 'any') extra.push('Желаемый специалист: ' + specialist.name);
        extra.push('Когда удобно: ' + ui.newReq.slot);
        const fullDesc = desc + '\n\n' + extra.join('; ');
        const { request } = await api.createRequest(CATS[ui.newReq.cat].backendCat, fullDesc);
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
      case 'retry-start': start(); break;
    }
  } catch (err) { toast(err.message || 'Ошибка', true); }
});

/* ---------- live ---------- */
function setConn(on) { const c = $('#conn'); c.className = 'conn' + (on ? ' on' : ''); c.innerHTML = '<span class="d"></span>' + (on ? 'обновления в реальном времени' : 'переподключение…'); }

async function start() {
  ui.startError = null;
  render(); // показываем скелетон, пока грузим данные
  try {
    const launchParams = await getLaunchParams();
    await api.auth(launchParams);           // вход через MAX (или DEV-режим)
    await loadAll();
    render();
    const es = subscribe(async (name, data) => {
      try { await loadAll(); render(); }
      catch (err) { toast('Не удалось обновить данные: ' + (err.message || 'ошибка сети'), true); }
    });
    es.onopen = () => setConn(true);
    es.onerror = () => setConn(false);
    setConn(true);
  } catch (err) {
    ui.startError = err.message || 'Ошибка сети';
    render();
  }
}
start();
