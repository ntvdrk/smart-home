// Обёртка над MAX Bridge.
// В реальном мини-приложении подключается официальная библиотека @maxhub/max-bridge (или скрипт MAX Bridge),
// и стартовые данные берутся оттуда. Здесь — совместимый способ получить WebAppData
// из окружения MAX, а при запуске вне MAX (локальная проверка) возвращается пустая строка,
// и бэкенд работает в DEV-режиме с демо-жителем.
export async function getLaunchParams() {
  // 1) официальный Bridge (когда подключён)
  if (window.WebApp?.initData) return window.WebApp.initData;
  // 2) fragment/query, как отдаёт MAX при открытии мини-приложения
  const fromHash = location.hash.match(/WebAppData=([^&]+)/)?.[1];
  const fromQuery = new URL(location.href).searchParams.get('WebAppData');
  return fromHash || fromQuery || '';
}

// Определяем платформу запуска (iOS/Android/desktop/web) — в реальном Bridge это bridge.getEnv().
export function platform() {
  return window.WebApp?.platform || 'web';
}
