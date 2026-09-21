// Валидация стартовых данных мини-приложения MAX (WebAppData).
// Алгоритм по документации: https://dev.max.ru/docs/webapps/validation
//   1) secret_key = HMAC-SHA256(key='WebAppData', message=BOT_TOKEN)
//   2) data_check_string = отсортированные по ключу пары "key=value", склеенные через "\n" (без hash)
//   3) sign = HMAC-SHA256(key=secret_key, message=data_check_string) -> hex
//   4) sign === hash  => данные подлинные
//
// ВАЖНО: user_id берётся ТОЛЬКО из провалидированной строки, никогда из тела запроса.
import crypto from 'node:crypto';

const BOT_TOKEN = process.env.MAX_BOT_TOKEN || '';
const MAX_AGE_SEC = Number(process.env.LAUNCH_MAX_AGE_SEC || 86400); // защита от replay

function hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

// launchParams — строка WebAppData (то, что клиент получает от MAX Bridge).
// Возвращает { ok, mode, reason?, identity? }
export function validateLaunchParams(launchParams) {
  // Режим разработки/проверки без токена: пропускаем демо-пользователя, помечаем mode:'dev'.
  if (!BOT_TOKEN) {
    return { ok: true, mode: 'dev', reason: 'no_token', identity: demoIdentity() };
  }
  if (!launchParams || typeof launchParams !== 'string') {
    return { ok: false, mode: 'max', reason: 'empty' };
  }

  const params = new URLSearchParams(launchParams);
  const hash = params.get('hash');
  if (!hash) return { ok: false, mode: 'max', reason: 'no_hash' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = hmac('WebAppData', BOT_TOKEN);
  const sign = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const valid = timingSafeEqual(sign, hash);
  if (!valid) return { ok: false, mode: 'max', reason: 'bad_signature' };

  const authDate = Number(params.get('auth_date') || 0);
  if (authDate && (Date.now() / 1000 - authDate) > MAX_AGE_SEC) {
    return { ok: false, mode: 'max', reason: 'expired' };
  }

  let user = {};
  try { user = JSON.parse(params.get('user') || '{}'); } catch { /* ignore */ }

  return {
    ok: true,
    mode: 'max',
    identity: {
      maxUserId: user.id ?? params.get('user_id') ?? null,
      chatId: params.get('chat_id') ?? user.id ?? null,
      name: user.first_name || user.name || 'Пользователь',
      startParam: params.get('start_param') || null,
    },
  };
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function demoIdentity() {
  return { maxUserId: 'demo', chatId: 'demo', name: 'Анна', startParam: null };
}

export const isProdAuth = () => Boolean(BOT_TOKEN);
