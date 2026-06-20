const counterId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() || "";

/** Пиксель для пользователей без JavaScript (рекомендация Яндекс.Метрики). */
export function YandexMetrikaNoscript() {
  if (!counterId) return null;

  return (
    <noscript>
      <div>
        <img
          src={`https://mc.yandex.ru/watch/${counterId}`}
          style={{ position: "absolute", left: "-9999px" }}
          alt=""
        />
      </div>
    </noscript>
  );
}
