// Клиент REST API + подписка на живые обновления (SSE).
const H = { 'Content-Type': 'application/json' };

// Токен диспетчера (устанавливается admin.js после входа). Добавляется в админ-запросы.
let ADMIN_TOKEN = null;
export function setAdminToken(t) { ADMIN_TOKEN = t || null; }
function adminHeaders() { return ADMIN_TOKEN ? { ...H, 'x-admin-token': ADMIN_TOKEN } : { ...H }; }

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
  return data;
}

export const api = {
  auth: (launchParams) => j('/api/auth', { method: 'POST', headers: H, body: JSON.stringify({ launchParams }) }),
  overview: () => j('/api/overview'),
  charges: () => j('/api/charges'),
  pay: () => j('/api/payments/pay', { method: 'POST', headers: H }),
  meters: () => j('/api/meters'),
  submitMeters: (readings) => j('/api/meters', { method: 'POST', headers: H, body: JSON.stringify({ readings }) }),
  requests: (scope = 'mine') => j(`/api/requests?scope=${scope}`, { headers: adminHeaders() }),
  createRequest: (cat, desc) => j('/api/requests', { method: 'POST', headers: H, body: JSON.stringify({ cat, desc }) }),
  patchRequest: (id, body) => j(`/api/requests/${id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(body) }),
  complaints: (scope = 'mine') => j(`/api/complaints?scope=${scope}`, { headers: adminHeaders() }),
  createComplaint: (topic, text, requestId = null) => j('/api/complaints', { method: 'POST', headers: H, body: JSON.stringify({ topic, text, requestId }) }),
  replyComplaint: (id, reply) => j(`/api/complaints/${id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ reply }) }),
  adminReadings: () => j('/api/admin/readings', { headers: adminHeaders() }),
  adminLogin: (password) => j('/api/admin/login', { method: 'POST', headers: H, body: JSON.stringify({ password }) }),
  notifications: () => j('/api/notifications'),
  dictionaries: () => j('/api/dictionaries'),
};

// Живые обновления: возвращает EventSource. onEvent(name, data) вызывается на каждое событие.
export function subscribe(onEvent) {
  const es = new EventSource('/api/events');
  ['request.created', 'request.updated', 'meters.submitted', 'payment.paid', 'complaint.created', 'complaint.updated']
    .forEach(name => es.addEventListener(name, e => onEvent(name, JSON.parse(e.data || '{}'))));
  return es;
}
