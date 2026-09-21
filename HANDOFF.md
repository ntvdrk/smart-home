# Передача проекта в Claude Code

Этот файл — краткая вводная для продолжения работы над MVP в Claude Code (или другом
редакторе). Проект уже **запускается и работает целиком** локально.

## Что уже сделано

- Бэкенд (Node + Express): REST API, живые обновления (SSE), файловое хранилище,
  проверка подписи входа MAX, интеграция с Bot API (long polling + отправка сообщений,
  заглушка без токена). Проверено вручную — все эндпоинты отвечают.
- Фронтенд (статические ES-модули): мини-приложение жителя (Главная, Счётчики, Платежи,
  Заявки) и диспетчерская панель УК. Обе роли работают с общими данными, синхронизация
  через SSE.
- Docker: `Dockerfile`, `compose.yaml`, `.dockerignore`, `.env.example`.
- README по формату сдачи хакатона.

## Как запустить

```bash
npm install && npm start        # http://localhost:3000  и  /admin
# или
docker compose up --build
```

## Контракт API (уже реализован)

- `POST /api/auth {launchParams}` → вход по подписи MAX (или DEV-режим).
- `GET  /api/overview` → житель: пользователь, задолженность, лента событий.
- `GET  /api/charges` · `POST /api/payments/pay` → начисления, история, оплата.
- `GET  /api/meters` · `POST /api/meters {readings:[{meterId,value}]}` → счётчики.
- `GET  /api/requests?scope=mine|all` · `POST /api/requests {cat,desc}` → заявки.
- `PATCH /api/requests/:id {action:"dispatch"|"message"|"done", ...}` → действия диспетчера.
- `GET  /api/admin/readings` · `GET /api/notifications` · `GET /api/dictionaries`.
- `GET  /api/events` → SSE: `request.created`, `request.updated`, `meters.submitted`, `payment.paid`.

## Специфика MAX (для доработки под платформу)

- Мини-приложение привязывается к чат-боту по HTTPS-URL в кабинете business.max.ru.
- Официальный JS SDK бота: `@maxhub/max-bot-api`. Bot API: `https://platform-api.max.ru`,
  токен в заголовке `Authorization`.
- Клиент получает стартовые данные через MAX Bridge; проверка подписи — в
  `backend/src/max/validate.js` (алгоритм dev.max.ru/docs/webapps/validation).
- Перед сдачей сверяться с актуальной документацией dev.max.ru (API часто меняется).

## Что осталось (задачи для Claude Code)

1. **Реальный токен MAX.** Зарегистрировать бота, задать `MAX_BOT_TOKEN` и `MINIAPP_URL`
   в `.env`, проверить long polling и отправку сообщений жителю.
2. **Хостинг по HTTPS** мини-приложения (для проверки внутри MAX). Указать URL в кабинете.
3. **(Опционально) Переписать фронтенд на React + MAX UI.** API-контракт не меняется —
   переносятся только экраны из `frontend/public/*.js`.
4. **Роли и вход диспетчера** — сейчас упрощены; добавить авторизацию сотрудника УК.
5. **Презентация PDF** по структуре из задания (первый слайд — технические данные для проверки).
6. Тесты основных эндпоинтов и обработка ошибок сети на фронте.

## Первый промпт для Claude Code (пример)

> Это MVP мини-приложения в MAX для управления МКД. Прочитай README.md и HANDOFF.md.
> Проект запускается через `npm start`. Помоги: (1) подключить реальный токен бота MAX и
> проверить отправку уведомлений жителю; (2) добавить простую авторизацию диспетчера;
> (3) не менять контракт API. Объясняй шаги по-русски, я начинающий разработчик.
