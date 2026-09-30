# Техническая справка

Краткий обзор архитектуры и API проекта «Умный дом». Пользовательская инструкция и
запуск — в `README.md`.

## Статус

Готово и развёрнуто онлайн (Render). Реализовано:
- Заявки жителя: создание, статус-таймлайн, назначение специалиста и времени, сообщения,
  закрытие.
- Жалобы жителя: подача (тема + текст, привязка к заявке), ответ диспетчера.
- Счётчики: передача показаний с расчётом расхода; просмотр у диспетчера.
- Платежи: начисления, история, оплата.
- Живые обновления между ролями (SSE).
- Интеграция с MAX: MAX Bridge на клиенте, проверка подписи входа, бот (long polling +
  отправка сообщений жителю).
- Вход диспетчера по паролю; роли житель/диспетчер разведены.

## Как запустить

```bash
npm install && npm start        # http://localhost:3000  (житель)  /admin (диспетчер)
# или
docker compose up --build
```
Подробнее (DEV/MAX-режимы, переменные, деплой) — в `README.md`.

## Контракт API

Общее:
- `POST /api/auth {launchParams}` — вход по подписи MAX; вне MAX — DEV/демо
  (если `ALLOW_DEMO_LOGIN=1`), иначе 401.
- `GET  /api/overview` — пользователь, задолженность, лента событий.
- `GET  /api/charges` · `POST /api/payments/pay` — начисления, история, оплата.
- `GET  /api/meters` · `POST /api/meters {readings:[{meterId,value}]}` — счётчики.
- `GET  /api/requests?scope=mine` · `POST /api/requests {cat,desc}` — заявки жителя.
- `GET  /api/complaints?scope=mine` · `POST /api/complaints {topic,text,requestId?}` — жалобы жителя.
- `GET  /api/notifications` — уведомления жителя.
- `GET  /api/dictionaries` — справочники (специальности, слоты, категории, темы жалоб).
- `GET  /api/events` — SSE: `request.created`, `request.updated`, `meters.submitted`,
  `payment.paid`, `complaint.created`, `complaint.updated`.

Диспетчер (требуют вход, заголовок `x-admin-token`):
- `POST /api/admin/login {password}` — вход, возвращает токен сессии.
- `GET  /api/requests?scope=all` · `PATCH /api/requests/:id {action:"dispatch"|"message"|"done", ...}`.
- `GET  /api/complaints?scope=all` · `PATCH /api/complaints/:id {reply}`.
- `GET  /api/admin/readings` — переданные показания.

## Специфика MAX

- Мини-приложение привязывается к чат-боту по HTTPS-URL (кабинет business.max.ru или
  через форму хакатона).
- Bot API: `https://platform-api.max.ru`, токен в заголовке `Authorization`. Официальный
  JS SDK бота: `@maxhub/max-bot-api`.
- Клиент получает стартовые данные через MAX Bridge (`https://st.max.ru/js/max-web-app.js`);
  проверка подписи — `backend/src/max/validate.js` (алгоритм dev.max.ru/docs/webapps/validation).
  `user_id` берётся только из провалидированных данных.
- Платформа MAX меняется — сверяйтесь с актуальной документацией dev.max.ru.

## Идеи для развития

- Полноценные учётные записи сотрудников УК (вместо общего пароля) и несколько домов/жителей.
- Замена файлового хранилища на СУБД (PostgreSQL) — контракт API не меняется.
- Перенос фронтенда на React + MAX UI (экраны из `frontend/public/*.js`).
- Реальные интеграции: ГИС ЖКХ (начисления по адресу), эквайринг для оплаты.
- Загрузка фото к заявке, push-уведомления, оценка качества выполнения.
