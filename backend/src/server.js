import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store } from './db.js';
import { CATS, SPECIALTIES, SLOTS, deriveEvents } from './seed.js';
import { validateLaunchParams, isProdAuth } from './max/validate.js';
import { sendMessage, startBot, botEnabled } from './max/bot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', '..', 'frontend', 'public');
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json());

// --- текущий пользователь (для MVP один демо-житель) ---
function currentUser(req) {
  const id = req.get('x-user-id') || 'u-anna';
  return store.data.users[id] || store.data.users['u-anna'];
}

// ================= SSE (живые обновления) =================
const clients = new Set();
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('retry: 3000\n\n');
  clients.add(res);
  const hb = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(hb); clients.delete(res); });
});
function broadcast(event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

// ================= AUTH (вход из MAX) =================
// Клиент мини-приложения присылает WebAppData, полученную от MAX Bridge.
app.post('/api/auth', (req, res) => {
  const { launchParams } = req.body || {};
  const result = validateLaunchParams(launchParams);
  if (!result.ok) return res.status(401).json({ ok: false, reason: result.reason });

  const user = store.data.users['u-anna'];
  if (result.identity?.maxUserId && result.identity.maxUserId !== 'demo') {
    user.maxUserId = result.identity.maxUserId; // связываем аккаунт MAX с жителем
    store.save();
  }
  res.json({ ok: true, mode: result.mode, prodAuth: isProdAuth(), user });
});

// ================= RESIDENT: overview =================
app.get('/api/overview', (req, res) => {
  const db = store.data;
  const user = currentUser(req);
  res.json({
    user, period: db.period, today: db.today,
    debt: db.debt,
    events: deriveEvents(db, user.id),
    botEnabled: botEnabled(),
  });
});

// ================= PAYMENTS =================
app.get('/api/charges', (req, res) => {
  const db = store.data;
  const history = (db.debt.paid ? [{ month: 'Сентябрь 2026', amount: db.total }] : []).concat(db.paymentHistory);
  res.json({ period: db.period, charges: db.charges, total: db.total, debt: db.debt, history });
});

app.post('/api/payments/pay', (req, res) => {
  const db = store.data;
  if (!db.debt.paid) {
    db.debt.paid = true;
    store.save();
    broadcast('payment.paid', { total: db.total });
  }
  res.json({ ok: true, debt: db.debt });
});

// ================= METERS =================
app.get('/api/meters', (req, res) => {
  const db = store.data;
  const meters = db.meters.map(m => {
    const r = db.readings.find(x => x.meterId === m.id);
    return { ...m, cur: r ? r.cur : null, consumption: r ? r.consumption : null };
  });
  res.json({ meters, submitted: db.metersSubmitted, period: db.period });
});

app.post('/api/meters', (req, res) => {
  const db = store.data;
  const user = currentUser(req);
  const input = Array.isArray(req.body?.readings) ? req.body.readings : [];
  const saved = [];
  for (const it of input) {
    const m = db.meters.find(x => x.id === it.meterId);
    if (!m) continue;
    const v = parseFloat(String(it.value).replace(',', '.'));
    if (Number.isNaN(v)) return res.status(400).json({ ok: false, error: `Некорректное значение для «${m.name}»` });
    if (v < m.prev) return res.status(400).json({ ok: false, error: `«${m.name}»: новое значение меньше предыдущего (${m.prev})` });
    const consumption = +(v - m.prev).toFixed(v % 1 ? 2 : 0);
    saved.push({ id: store.nextId('reading'), userId: user.id, meterId: m.id, prev: m.prev, cur: v, consumption, date: db.today });
  }
  if (!saved.length) return res.status(400).json({ ok: false, error: 'Введите хотя бы одно значение' });
  db.readings = saved;
  db.metersSubmitted = true;
  store.save();
  broadcast('meters.submitted', { count: saved.length });
  res.json({ ok: true, readings: saved });
});

// admin: список показаний
app.get('/api/admin/readings', (req, res) => {
  const db = store.data;
  const readings = db.readings.map(r => {
    const m = db.meters.find(x => x.id === r.meterId);
    const u = db.users[r.userId];
    return { ...r, name: m?.name, unit: m?.unit, tint: m?.tint, house: u?.house, apt: u?.apt };
  });
  res.json({ readings, period: db.period });
});

// ================= REQUESTS =================
app.get('/api/requests', (req, res) => {
  const db = store.data;
  const scope = req.query.scope || 'mine';
  const user = currentUser(req);
  let list = db.requests;
  if (scope !== 'all') list = list.filter(r => r.userId === user.id);
  const withMeta = list.map(r => ({ ...r, catLabel: CATS[r.cat]?.label || r.cat, house: db.users[r.userId]?.house, apt: db.users[r.userId]?.apt, resident: db.users[r.userId]?.full }));
  res.json({ requests: withMeta.sort((a, b) => b.id - a.id) });
});

// житель создаёт заявку
app.post('/api/requests', (req, res) => {
  const db = store.data;
  const user = currentUser(req);
  const cat = CATS[req.body?.cat] ? req.body.cat : 'other';
  const desc = String(req.body?.desc || '').trim();
  if (!desc) return res.status(400).json({ ok: false, error: 'Опишите проблему' });
  const id = store.nextId('request');
  const title = desc.length > 46 ? desc.slice(0, 46).trim() + '…' : desc;
  const r = { id, userId: user.id, title, cat, status: 'new', date: db.today, desc, specialist: '', specialty: '', slot: '', resolution: '', adminMsg: '' };
  db.requests.push(r);
  store.save();
  broadcast('request.created', { id });
  res.json({ ok: true, request: r });
});

// диспетчер: назначение / сообщение / выполнение
app.patch('/api/requests/:id', async (req, res) => {
  const db = store.data;
  const r = db.requests.find(x => x.id === Number(req.params.id));
  if (!r) return res.status(404).json({ ok: false, error: 'Заявка не найдена' });
  const { action } = req.body || {};
  const target = db.users[r.userId]?.maxUserId || db.users[r.userId]?.id;

  if (action === 'dispatch') {
    const name = String(req.body.name || '').trim();
    const specialty = SPECIALTIES.includes(req.body.specialty) ? req.body.specialty : SPECIALTIES[0];
    const slot = SLOTS.includes(req.body.slot) ? req.body.slot : SLOTS[0];
    if (!name) return res.status(400).json({ ok: false, error: 'Укажите имя мастера' });
    r.status = 'progress'; r.specialist = name; r.specialty = specialty; r.slot = slot;
    r.adminMsg = `Мастер ${name} (${specialty.toLowerCase()}) придёт ${slot.toLowerCase()}.`;
    await notify(db, r, r.adminMsg, target);
  } else if (action === 'message') {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'Введите сообщение' });
    r.adminMsg = text;
    await notify(db, r, text, target);
  } else if (action === 'done') {
    r.status = 'done';
    r.resolution = req.body.resolution?.trim() || (r.specialist ? `Выполнено мастером ${r.specialist}` : 'Выполнено');
    r.adminMsg = 'Заявка выполнена. Спасибо за обращение!';
    await notify(db, r, r.adminMsg, target);
  } else {
    return res.status(400).json({ ok: false, error: 'Неизвестное действие' });
  }
  store.save();
  broadcast('request.updated', { id: r.id, status: r.status });
  res.json({ ok: true, request: r });
});

async function notify(db, r, text, target) {
  db.notifications.push({ id: store.nextId('notification'), userId: r.userId, requestId: r.id, text, date: db.today });
  try { await sendMessage(target, `[Заявка №${r.id}] ${text}`); }
  catch (e) { console.error('[notify] ошибка отправки в MAX:', e.message); }
}

app.get('/api/notifications', (req, res) => {
  const db = store.data;
  const user = currentUser(req);
  res.json({ notifications: db.notifications.filter(n => n.userId === user.id).reverse() });
});

// справочники для админки
app.get('/api/dictionaries', (req, res) => {
  res.json({ specialties: SPECIALTIES, slots: SLOTS, categories: CATS });
});

// ================= STATIC FRONTEND =================
app.use(express.static(PUBLIC_DIR));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (житель: /   диспетчер: /admin)`);
  console.log(`[server] режим входа: ${isProdAuth() ? 'MAX (проверка подписи)' : 'DEV (демо-пользователь)'}`);
  startBot();
});
