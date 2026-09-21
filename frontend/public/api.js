// Клиент REST API + подписка на живые обновления (SSE).
const H = { 'Content-Type': 'application/json' };

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  auth: (launchParams) => j('/api/auth', { method: 'POST', headers: H, body: JSON.stringify({ launchParams }) }),
  overview: () => j('/api/overview'),
  charges: () => j('/api/charges'),
  pay: () => j('/api/payments/pay', { method: 'POST', headers: H }),
  meters: () => j('/api/meters'),
  submitMeters: (readings) => j('/api/meters', { method: 'POST', headers: H, body: JSON.stringify({ readings }) }),
  requests: (scope = 'mine') => j(`/api/requests?scope=${scope}`),
  createRequest: (cat, desc) => j('/api/requests', { method: 'POST', headers: H, body: JSON.stringify({ cat, desc }) }),
  patchRequest: (id, body) => j(`/api/requests/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) }),
  adminReadings: () => j('/api/admin/readings'),
  notifications: () => j('/api/notifications'),
  dictionaries: () => j('/api/dictionaries'),
};

// Живые обновления: возвращает EventSource. onEvent(name, data) вызывается на каждое событие.
export function subscribe(onEvent) {
  const es = new EventSource('/api/events');
  ['request.created', 'request.updated', 'meters.submitted', 'payment.paid']
    .forEach(name => es.addEventListener(name, e => onEvent(name, JSON.parse(e.data || '{}'))));
  return es;
}
