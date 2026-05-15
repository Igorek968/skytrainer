import type { Metadata } from "next";
import Link from "next/link";

const operator =
  process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() ||
  "оператор программного сервиса «Инструктор для тебя» (реквизиты и наименование юридического лица уточняются у администрации сервиса)";

export const metadata: Metadata = {
  title: "Публичная оферта",
  description: "Условия использования сервиса заказа занятий с инструктором",
};

export default function PublicOfferPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-12 text-sm leading-relaxed text-foreground">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/" className="text-accent underline underline-offset-2">
            ← На главную
          </Link>
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Публичная оферта</h1>
        <p className="mt-2 text-muted-foreground">
          Настоящий документ является офертой в смысле ст. 437 ГК РФ. Использование сервиса означает полное и безоговорочное
          принятие (акцепт) условий ниже.
        </p>
        <p className="mt-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Исполнитель по договору с пользователем: <span className="font-medium text-foreground">{operator}</span>.
          При необходимости задайте переменную окружения{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">NEXT_PUBLIC_LEGAL_ENTITY_NAME</code> для
          отображения полного наименования организации.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Термины</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Сервис</span> — интернет-сайт и программное обеспечение для
            размещения информации об инструкторах и оформления заявок на занятия.
          </li>
          <li>
            <span className="font-medium text-foreground">Пользователь / Заказчик</span> — физическое лицо, использующее
            Сервис для поиска инструктора и оформления заказа.
          </li>
          <li>
            <span className="font-medium text-foreground">Инструктор</span> — самозанятое лицо или иной исполнитель,
            размещающий в Сервисе предложение об оказании услуг по обучению катанию.
          </li>
          <li>
            <span className="font-medium text-foreground">Заказ</span> — заявка Заказчика на проведение занятия с
            выбранным Инструктором, зафиксированная в Сервисе.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Предмет оферты</h2>
        <p className="text-muted-foreground">
          Оператор предоставляет Заказчику доступ к функционалу Сервиса: просмотр профилей Инструкторов, параметров
          занятий, оформление Заказа, обмен сообщениями в рамках реализованных в Сервисе возможностей. Договор возмездного
          оказания услуг по обучению катанию заключается между Заказчиком и Инструктором; Сервис выступает посредником по
          техническому обеспечению взаимодействия, если иное прямо не предусмотрено функционалом (например, приём оплаты
          через платёжного провайдера).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Акцепт и изменения</h2>
        <p className="text-muted-foreground">
          Совершение действий по регистрации по email, входу в учётную запись, оформлению Заказа или иное активное
          использование Сервиса означает акцепт оферты. Оператор вправе изменять текст оферты; актуальная редакция
          публикуется по адресу <span className="font-mono text-xs">/oferta</span>. Существенные изменения рекомендуется
          отслеживать самостоятельно; продолжение использования после публикации новой редакции означает согласие с ней,
          если иное не предусмотрено законом.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Оформление заказа и оплата</h2>
        <p className="text-muted-foreground">
          Условия конкретного занятия (дата, время, место встречи, стоимость, способ оплаты) определяются информацией в
          Заказе и согласованием между Заказчиком и Инструктором в рамках Сервиса. При использовании онлайн-оплаты
          применяются правила платёжного оператора и банка-эмитента. Отмена и возвраты — в соответствии с правилами
          Сервиса, Инструктора и законодательством РФ о защите прав потребителей (для бытовых договоров с потребителем).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Обязанности сторон</h2>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Заказчик</span> предоставляет достоверные данные, соблюдает
          правила поведения на склоне и инструкции Инструктора, своевременно явился на встречу или уведомил об отмене в
          согласованном порядке.
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Инструктор</span> оказывает услуги добросовестно, в объёме,
          согласованном с Заказчиком, соблюдает требования безопасности.
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Оператор</span> обеспечивает работоспособность Сервиса в разумных
          пределах, не гарантирует бесперебойность и не отвечает за действия Инструкторов и Заказчиков вне предоставления
          программного доступа.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Персональные данные</h2>
        <p className="text-muted-foreground">
          Обработка персональных данных осуществляется в целях исполнения договора с пользователем и законодательству РФ.
          Объём и цели обработки определяются функционалом Сервиса (например, контактный телефон для связи по Заказу).
          Политика в отношении обработки ПДн может публиковаться отдельно по решению Оператора.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Ограничение ответственности</h2>
        <p className="text-muted-foreground">
          Сервис предоставляется «как есть». Оператор не несёт ответственности за вред, причинённый в результате занятий
          на склоне, за неявку Инструктора или Заказчика, за качество услуг Инструктора, за действия третьих лиц, а также
          за косвенные убытки и упущенную выгоду, в пределах, допускаемых законом.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Порядок разрешения споров</h2>
        <p className="text-muted-foreground">
          Споры подлежат урегулирению путём переговоров. При недостижении согласия — в судебном порядке по месту нахождения
          Оператора (после уточнения реквизитов) либо по нормам закона о защите прав потребителей для соответствующих
          категорий споров.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">9. Реквизиты и связь</h2>
        <p className="text-muted-foreground">
          Полные реквизиты Оператора, адрес электронной почты и телефон для обращений уточняются у администрации сервиса
          или публикуются в интерфейсе для администраторов. Для связи по вопросам работы Сервиса используйте контакты,
          указанные на сайте проекта.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Дата публикации редакции: 13.05.2026. Текст не является индивидуальной юридической консультацией; перед запуском в
        продакшен рекомендуется согласовать оферту с юристом.
      </p>
    </article>
  );
}
