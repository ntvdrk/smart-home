// Тестовые (демо) данные. В материалах явно указано: интеграции с ГИС ЖКХ / MAX
// смоделированы, данные подготовлены заранее и обезличены.

export const CATS = {
  avaria:  { label: 'Авария' },
  musor:   { label: 'Вывоз мусора' },
  svet:    { label: 'Освещение' },
  domofon: { label: 'Домофон' },
  lift:    { label: 'Лифт' },
  other:   { label: 'Прочее' },
};

export const SPECIALTIES = ['Сантехник','Электрик','Разнорабочий','Лифтёр','Мастер по домофонам','Клининг'];
export const SLOTS = [
  'Сегодня, 14:00–16:00','Сегодня, 16:00–18:00',
  'Завтра, 10:00–12:00','Завтра, 12:00–14:00','22 сентября, 09:00–11:00',
];

export function seedData() {
  const userId = 'u-anna';
  return {
    period: 'сентябрь 2026',
    today: '17 сентября',
    users: {
      [userId]: {
        id: userId,
        maxUserId: null,           // заполняется при валидном входе из MAX
        name: 'Анна',
        full: 'Анна Соколова',
        house: 'ул. Ленина, 24',
        apt: 'кв. 56',
        addr: 'ул. Ленина, 24, кв. 56',
      },
    },
    debt: { amount: 2340, due: '25 сентября', paid: false },
    charges: [
      ['Содержание жилья', 1240], ['Отопление', 1850], ['Холодное водоснабжение', 320],
      ['Горячее водоснабжение', 480], ['Электроэнергия', 560], ['Взнос на капремонт', 210],
    ],
    total: 4660,
    paymentHistory: [
      { month: 'Август 2026', amount: 4510 },
      { month: 'Июль 2026', amount: 4480 },
      { month: 'Июнь 2026', amount: 4320 },
    ],
    meters: [
      { id: 'cold', name: 'Холодная вода',  prev: 482,  unit: 'м³',    tint: 'blue' },
      { id: 'hot',  name: 'Горячая вода',   prev: 214,  unit: 'м³',    tint: 'warm' },
      { id: 'el',   name: 'Электричество',  prev: 6154, unit: 'кВт·ч', tint: 'amber' },
      { id: 'gas',  name: 'Газ',            prev: 1032, unit: 'м³',    tint: 'green' },
    ],
    readings: [],                  // {id, userId, meterId, prev, cur, consumption, date}
    metersSubmitted: false,
    requests: [
      { id: 214, userId, title: 'Течь в подъезде на 3 этаже', cat: 'avaria', status: 'done',
        date: '15 сентября', desc: 'Из стояка холодной воды на 3 этаже течёт вода, лужа на площадке.',
        specialist: 'Игорь П.', specialty: 'Сантехник', slot: '15 сентября, 11:00–13:00',
        resolution: 'Течь в подъезде устранена',
        adminMsg: 'Заявка выполнена. Стояк перекрыт, соединение заменено.' },
      { id: 215, userId, title: 'Не работает домофон', cat: 'domofon', status: 'progress',
        date: '16 сентября', desc: 'Не открывается дверь по ключу, трубка в квартире молчит.',
        specialist: 'Сергей М.', specialty: 'Мастер по домофонам', slot: 'Сегодня, 14:00–16:00',
        resolution: '', adminMsg: 'Мастер Сергей М. придёт сегодня, 14:00–16:00.' },
      { id: 216, userId, title: 'Перегорела лампа на лестничной клетке', cat: 'svet', status: 'new',
        date: '17 сентября', desc: 'На лестничной клетке между 4 и 5 этажом не горит свет.',
        specialist: '', specialty: '', slot: '', resolution: '', adminMsg: '' },
    ],
    notifications: [],             // «сообщения жителю» (в реальном MAX — сообщения от бота)
    counters: { request: 216, reading: 0, notification: 0 },
  };
}

// Лента «Ближайшие события» для главного экрана жителя — выводится из данных.
export function deriveEvents(db, userId) {
  const items = [];
  if (!db.metersSubmitted) {
    items.push({ kind: 'warn', title: 'Передайте показания за сентябрь', sub: 'Осталось 3 дня' });
  }
  const mine = db.requests.filter(r => r.userId === userId);
  for (const r of mine.filter(r => r.status === 'progress' && r.slot)) {
    items.push({ kind: 'info', title: 'Мастер придёт ' + r.slot.toLowerCase(), sub: `Заявка №${r.id} · ${r.title}` });
  }
  for (const r of mine.filter(r => r.status === 'done')) {
    items.push({ kind: 'ok', title: `Заявка №${r.id} выполнена`, sub: r.resolution || r.title });
  }
  return items.slice(0, 4);
}
