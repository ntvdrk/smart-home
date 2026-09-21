// Интеграция с чат-ботом MAX через Bot API.
// База: https://platform-api.max.ru, авторизация — заголовок Authorization: <token>.
// Док: https://dev.max.ru/docs/chatbots/bots-coding/prepare
// Без токена (MAX_BOT_TOKEN) бот работает в режиме заглушки: сообщения пишутся в консоль,
// чтобы решение целиком запускалось локально для проверки (тестовые данные).

const BOT_TOKEN = process.env.MAX_BOT_TOKEN || '';
const API = process.env.MAX_API_BASE || 'https://platform-api.max.ru';
const MINIAPP_URL = process.env.MINIAPP_URL || '';

const enabled = Boolean(BOT_TOKEN);

async function api(pathAndQuery, { method = 'GET', body } = {}) {
  const res = await fetch(API + pathAndQuery, {
    method,
    headers: {
      Authorization: BOT_TOKEN,               // MAX ожидает токен в заголовке Authorization
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`MAX API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Отправить личное сообщение жителю (уведомление о статусе заявки и т.п.)
export async function sendMessage(target, text) {
  if (!enabled) {
    console.log(`[bot:mock] → жителю (${target}): ${text}`);
    return { mocked: true };
  }
  // target — user_id (или chat_id) диалога жителя с ботом.
  const q = new URLSearchParams(String(target).startsWith('chat:') ? { chat_id: String(target).slice(5) } : { user_id: String(target) });
  return api(`/messages?${q.toString()}`, { method: 'POST', body: { text } });
}

// Long polling: получаем обновления и обрабатываем команду /start,
// предлагая кнопку открытия мини-приложения.
let polling = false;
export function startBot() {
  if (!enabled) {
    console.log('[bot] MAX_BOT_TOKEN не задан — бот в режиме заглушки (сообщения идут в консоль).');
    return;
  }
  polling = true;
  console.log('[bot] запущен long polling MAX Bot API');
  loop().catch(err => console.error('[bot] loop error', err));
}

async function loop() {
  let marker;
  while (polling) {
    try {
      const q = new URLSearchParams({ timeout: '30' });
      if (marker) q.set('marker', String(marker));
      const data = await api(`/updates?${q.toString()}`);
      for (const u of data.updates || []) {
        marker = u.marker ?? marker;
        await handleUpdate(u);
      }
      if (data.marker) marker = data.marker;
    } catch (err) {
      console.error('[bot] update error, пауза 3с:', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function handleUpdate(u) {
  const text = u.message?.body?.text || u.message?.text || '';
  const userId = u.message?.sender?.user_id ?? u.user_id ?? u.message?.recipient?.chat_id;
  if (!userId) return;
  if (text.startsWith('/start')) {
    const keyboard = MINIAPP_URL
      ? { inline_keyboard: [[{ type: 'link', text: 'Открыть «Умный дом»', url: MINIAPP_URL }]] }
      : undefined;
    await api(`/messages?user_id=${userId}`, {
      method: 'POST',
      body: { text: 'Добро пожаловать в «Умный дом». Откройте мини-приложение, чтобы подать заявку, передать показания и оплатить ЖКУ.', ...(keyboard ? { attachments: [{ type: 'inline_keyboard', payload: keyboard }] } : {}) },
    });
  }
}

export const botEnabled = () => enabled;
