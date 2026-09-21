import { I } from './icons.js';
import { api, subscribe } from './api.js';

const CAT_ICON = { avaria: I.drop, musor: I.trash, svet: I.bulb, domofon: I.door, lift: I.elevator, other: I.dots };
const TINT = { blue: '--tint-blue', warm: '--tint-warm', amber: '--o-bg', green: '--g-bg' };
const STATUS = { new: ['Новая', 'new'], progress: ['В работе', 'prog'], done: ['Выполнено', 'done'] };

const model = { requests: [], readings: [], dict: { specialties: [], slots: [] } };
const ui = { tab: 'requests', filter: 'all', selectedId: null };

const $ = s => document.querySelector(s);
let toastT;
function toast(msg, err) {
  const t = $('#toast'); t.className = err ? 'err' : '';
  t.innerHTML = (err ? I.warn : I.check) + '<span>' + msg + '</span>';
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

async function load() {
  const [reqs, reads, dict] = await Promise.all([api.requests('all'), api.adminReadings(), api.dictionaries()]);
  model.requests = reqs.requests; model.readings = reads.readings; model.dict = dict;
}

function counts() {
  const c = { all: model.requests.length, new: 0, progress: 0, done: 0 };
  model.requests.forEach(r => c[r.status]++);
  return c;
}

function list() {
  const c = counts();
  const filters = [['all', 'Все'], ['new', 'Новые'], ['progress', 'В работе'], ['done', 'Выполнено']];
  const fHtml = filters.map(f => `<button class="${ui.filter === f[0] ? 'active' : ''}" data-action="filter" data-f="${f[0]}">${f[1]} · ${c[f[0]]}</button>`).join('');
  let rows = model.requests.slice().sort((a, b) => {
    const ord = { new: 0, progress: 1, done: 2 };
    return ord[a.status] !== ord[b.status] ? ord[a.status] - ord[b.status] : b.id - a.id;
  });
  if (ui.filter !== 'all') rows = rows.filter(r => r.status === ui.filter);
  const rowsHtml = rows.length ? rows.map(r => {
    const st = STATUS[r.status];
    const asg = r.specialist ? `· ${r.specialty} ${r.specialist}` : '· не назначен';
    return `<div class="arow" data-action="open" data-id="${r.id}">
      <div class="cat">${CAT_ICON[r.cat] || I.dots}</div>
      <div class="amain"><div class="att">${r.title}</div>
        <div class="ameta"><span>№${r.id}</span><span>·</span><span>${r.house}, ${r.apt}</span><span>${asg}</span></div></div>
      <div class="aend"><span class="badge ${st[1]}">${st[0]}</span><span class="chev">${I.chev}</span></div></div>`;
  }).join('') : `<div class="empty">${I.folder}<p>Нет заявок в этом фильтре</p></div>`;
  return `
    <div class="stat-row">
      <div class="stat acc"><div class="sv tnum">${c.new}</div><div class="sl">Новые заявки</div></div>
      <div class="stat"><div class="sv tnum">${c.progress}</div><div class="sl">В работе</div></div>
      <div class="stat"><div class="sv tnum">${c.done}</div><div class="sl">Выполнено</div></div>
    </div>
    <div class="afilter">${fHtml}</div>${rowsHtml}`;
}

function detail() {
  const r = model.requests.find(x => x.id === ui.selectedId);
  if (!r) return list();
  const st = STATUS[r.status];
  const specOpts = model.dict.specialties.map(s => `<option ${r.specialty === s ? 'selected' : ''}>${s}</option>`).join('');
  const slotOpts = model.dict.slots.map(s => `<option ${r.slot === s ? 'selected' : ''}>${s}</option>`).join('');
  let form = '';
  if (r.status === 'new') {
    form = `<div class="dcard"><div class="form-title">Назначить специалиста</div>
      <div class="frow">
        <div><div class="k" style="font-size:11.5px;color:var(--muted);margin-bottom:6px">Специальность</div>
          <select class="sel" id="f-specialty">${specOpts}</select></div>
        <div><div class="k" style="font-size:11.5px;color:var(--muted);margin-bottom:6px">Имя мастера</div>
          <input class="inp" id="f-name" placeholder="Например, Игорь П." style="border-radius:11px;padding:11px 12px" value="${r.specialist || ''}"></div>
      </div>
      <div class="frow"><div><div class="k" style="font-size:11.5px;color:var(--muted);margin-bottom:6px">Время визита</div>
        <select class="sel" id="f-slot">${slotOpts}</select></div></div>
      <div class="abtns"><button class="btn-primary" data-action="dispatch" data-id="${r.id}">Взять в работу и уведомить жителя</button></div></div>`;
  } else if (r.status === 'progress') {
    form = `<div class="dcard"><div class="form-title">Выполнение</div>
      <div class="dgrid" style="border-top:none;margin-top:0;padding-top:0">
        <div><div class="k">Специалист</div><div class="v">${r.specialty} ${r.specialist}</div></div>
        <div><div class="k">Время визита</div><div class="v">${r.slot}</div></div></div>
      <div class="field-lbl" style="margin-left:0">Сообщение жителю</div>
      <textarea class="inp" id="f-msg" placeholder="Например: мастер задержится на 30 минут" style="min-height:70px"></textarea>
      <div class="abtns" style="margin-top:12px">
        <button class="btn-primary" data-action="send" data-id="${r.id}">Отправить сообщение</button>
        <button class="btn-ok" data-action="done" data-id="${r.id}">Отметить выполненной</button></div></div>`;
  } else {
    form = `<div class="msg-sent">${I.check}<div><b>Заявка закрыта.</b> ${r.resolution ? r.resolution + '. ' : ''}Житель получил уведомление в MAX.</div></div>`;
  }
  const msgBlock = r.adminMsg ? `<div class="msg-sent">${I.msg}<div><b>Отправлено жителю:</b> ${r.adminMsg}</div></div>` : '';
  return `<button class="aback" data-action="back">${I.back} Все заявки</button>
    <div class="dcard">
      <div class="dtop"><div class="cat">${CAT_ICON[r.cat] || I.dots}</div>
        <div style="flex:1"><h3>${r.title}</h3><div class="dsub">№${r.id} · создана ${r.date}</div></div>
        <span class="badge ${st[1]}">${st[0]}</span></div>
      <div class="ddesc">${r.desc}</div>
      <div class="dgrid">
        <div><div class="k">Адрес</div><div class="v">${r.house}, ${r.apt}</div></div>
        <div><div class="k">Заявитель</div><div class="v">${r.resident}</div></div>
        <div><div class="k">Категория</div><div class="v">${r.catLabel}</div></div>
        <div><div class="k">Канал</div><div class="v">MAX · чат-бот</div></div></div>
      ${msgBlock}
    </div>${form}`;
}

function readingsView() {
  if (!model.readings.length) {
    return `<div class="empty">${I.gauge}<p>Показания за сентябрь ещё не переданы.<br>Передайте их в мини-приложении жителя.</p></div>`;
  }
  const rows = model.readings.map(r => `
    <div class="mread"><div class="ml"><div class="mi" style="background:var(${TINT[r.tint] || '--surface-alt'})">${{ cold: I.drop, hot: I.fire, el: I.bolt, gas: I.gas }[r.meterId] || I.gauge}</div>
      <div><div style="font-weight:600;font-size:14px">${r.name}</div>
      <div style="font-size:12px;color:var(--muted)">${r.house}, ${r.apt} · ${r.date}</div></div></div>
      <div class="mv"><div class="cur tnum">${r.cur} ${r.unit}</div>
      <div class="con tnum">расход ${r.consumption} ${r.unit}</div></div></div>`).join('');
  return `<div class="stat-row" style="grid-template-columns:1fr">
    <div class="stat"><div class="sv tnum">${model.readings.length}/4</div><div class="sl">Счётчиков передано за сентябрь</div></div></div>${rows}`;
}

function render() {
  const c = counts();
  const tabs = [['requests', 'Заявки', c.new], ['readings', 'Показания', null]];
  const tHtml = tabs.map(t => `<button class="${ui.tab === t[0] ? 'active' : ''}" data-action="atab" data-t="${t[0]}">${t[1]}${t[2] ? `<span class="cnt">${t[2]}</span>` : ''}</button>`).join('');
  const body = ui.tab === 'readings' ? readingsView() : (ui.selectedId ? detail() : list());
  $('#stage').innerHTML = `<div class="admin">
    <div class="ahead"><div class="amark">${I.wrench}</div>
      <div class="grow"><h2>Диспетчерская УК</h2><p>«Ленинский-24» · оператор Марина</p></div>
      <div class="live"><span class="pulse"></span>Онлайн</div></div>
    <div class="atabs">${tHtml}</div>
    <div class="abody">${body}</div></div>`;
}

/* ---------- actions ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action, id = b.dataset.id ? +b.dataset.id : null;
  try {
    switch (a) {
      case 'atab': ui.tab = b.dataset.t; ui.selectedId = null; render(); break;
      case 'filter': ui.filter = b.dataset.f; render(); break;
      case 'open': ui.selectedId = id; render(); break;
      case 'back': ui.selectedId = null; render(); break;
      case 'dispatch': {
        const name = ($('#f-name') || {}).value?.trim();
        const specialty = ($('#f-specialty') || {}).value;
        const slot = ($('#f-slot') || {}).value;
        if (!name) { toast('Укажите имя мастера', true); break; }
        await api.patchRequest(id, { action: 'dispatch', name, specialty, slot });
        await load(); render();
        toast('Житель уведомлён: мастер придёт ' + slot.toLowerCase());
        break;
      }
      case 'send': {
        const text = ($('#f-msg') || {}).value?.trim();
        if (!text) { toast('Введите сообщение', true); break; }
        await api.patchRequest(id, { action: 'message', text });
        await load(); render();
        toast('Сообщение отправлено жителю');
        break;
      }
      case 'done': {
        await api.patchRequest(id, { action: 'done' });
        await load(); render();
        toast('Заявка №' + id + ' закрыта');
        break;
      }
    }
  } catch (err) { toast(err.message || 'Ошибка', true); }
});

/* ---------- live ---------- */
function setConn(on) { const c = $('#conn'); c.className = 'conn' + (on ? ' on' : ''); c.innerHTML = '<span class="d"></span>' + (on ? 'обновления в реальном времени' : 'переподключение…'); }

async function start() {
  try {
    await load(); render();
    const es = subscribe(async () => { await load(); render(); });
    es.onopen = () => setConn(true);
    es.onerror = () => setConn(false);
    setConn(true);
  } catch (err) {
    $('#stage').innerHTML = `<div class="empty" style="margin:60px auto">${I.warn}<p>Не удалось загрузить данные.<br>${err.message}</p></div>`;
  }
}
start();
