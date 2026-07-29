import type { Metadata } from "next";
import Link from "next/link";

import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  formatLegalEditionDate,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  PAYOUT_MIN_WITHDRAWAL_RUB,
  PLATFORM_FEE_PERCENT,
  REFERRAL_COOKIE_MAX_AGE_DAYS,
  REFERRAL_MAX_ORDERS_PER_CLIENT,
  REFERRAL_REWARD_RUB,
} from "@/lib/legal-config";
import { LEGAL_AGENT, LEGAL_SITE_URL, legalRegisteredAddress } from "@/lib/legal-entity";
import { LegalRequisitesBlock } from "@/shared/legal/legal-requisites-block";
import { LEGAL_ROUTES } from "@/lib/legal";
import { pageMetadata, SEO_PAGES } from "@/lib/seo";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = pageMetadata(SEO_PAGES.oferta);

export default function PublicOfferPage() {
  return (
    <LegalDocLayout title="Договор бронирования услуг (публичная оферта) о предоставлении платных услуг">
      <p className="text-muted-foreground">
        Настоящий договор (публичная оферта) представляет собой предложение{" "}
        <strong>Исполнителя (Агента)</strong> — {LEGAL_AGENT.fullName} (ИНН {LEGAL_AGENT.inn}, ОГРН{" "}
        {LEGAL_AGENT.ogrn}) — заключать договоры на изложенных ниже условиях с неопределённым кругом дееспособных
        физических лиц.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Термины и определения</h2>
        <p className="text-muted-foreground">
          <strong>Заказчик/Клиент</strong> — дееспособное физическое лицо, достигшее совершеннолетнего возраста и
          имеющее законное право вступать в договорные отношения с Исполнителем и Инструктором.
          <br />
          <strong>Исполнитель / Агент</strong> — {LEGAL_AGENT.fullName} (ИНН {LEGAL_AGENT.inn}, ОГРН {LEGAL_AGENT.ogrn},
          КПП {LEGAL_AGENT.kpp}) — юридическое лицо, оператор Платформы. Оказывает Клиенту услуги по поиску
          Инструктора, бронированию и приёму оплаты; действует как посредник (агент) и не является исполнителем
          услуг обучения и тренировок.
          <br />
          <strong>Услуги Исполнителя (Услуги Агента)</strong> — информационное сопровождение, бронирование и продажа
          доступа к услугам Инструктора, приём оплаты через платёжный сервис, урегулирование расчётов и споров в
          пределах Оферты.
          <br />
          <strong>Инструктор</strong> — физическое лицо, зарегистрированное в качестве самозанятого (НПД) или
          индивидуального предпринимателя, обладающее специальными навыками и познаниями, необходимыми для оказания
          Клиенту услуг обучения и тренировок в направлениях, указанных в профиле на Сайте.
          <br />
          <strong>Услуга инструктора</strong> — непосредственное проведение занятия, сопровождение и консультирование
          Инструктором по методике (далее — занятие с инструктором). Договор на Услугу инструктора заключается{" "}
          <strong>непосредственно между Клиентом и Инструктором</strong>.
          <br />
          <strong>Бронирование услуг инструктора</strong> — предварительное резервирование Заказчиком определённой
          даты, времени и длительности оказания Услуг Инструктора с обязательством Заказчика прибыть или обеспечить
          прибытие третьих лиц в определённую дату и время на согласованное место встречи.
          <br />
          <strong>Услуга по бронированию</strong> — оказание Исполнителем платной услуги по резервированию
          определённой даты/времени/места встречи/длительности оказания Услуг Инструктора.
          <br />
          <strong>Комиссия Агента</strong> — вознаграждение Исполнителя в размере{" "}
          <strong>{PLATFORM_FEE_PERCENT}%</strong> от стоимости занятия (или стоимости участия в Мероприятии),
          удерживаемое Исполнителем из суммы, оплаченной Клиентом.
          <br />
          <strong>Мероприятие</strong> — групповое или индивидуальное событие (мастер-класс, выезд, тренировка с
          фиксированным временем), размещённое Инструктором в разделе «Мероприятия» на Сайте.
          <br />
          <strong>Гость</strong> — Заказчик, а также иное физическое лицо, указанное Заказчиком в качестве получателя
          Услуг, исключительно для личных, бытовых и иных нужд, не связанных с осуществлением предпринимательской
          деятельности.
          <br />
          <strong>Сайт/Платформа</strong> — совокупность связанных между собой веб-страниц по адресу{" "}
          <a className="text-accent underline" href={LEGAL_SITE_URL}>
            {LEGAL_SITE_URL}
          </a>
          . Сайт является <strong>информационной площадкой</strong> для поиска Инструкторов и Мероприятий.
          <br />
          <strong>Оферта</strong> — настоящее предложение заключить Договор на оказание Услуг по бронированию.
          <br />
          <strong>Акцепт оферты</strong> — принятие Оферты в порядке раздела 2.
          <br />
          Контакт Исполнителя:{" "}
          <a className="text-accent underline" href={`mailto:${LEGAL_AGENT.email}`}>
            {LEGAL_AGENT.email}
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Общие положения. Акцепт</h2>
        <p className="text-muted-foreground">
          2.1. Исполнитель предлагает любому совершеннолетнему дееспособному физическому лицу
          (Заказчик/Гость/Клиент) платные услуги по поиску и предварительному Бронированию услуг инструктора, а также
          приёму оплаты в интересах расчётов с Инструктором (за вычетом Комиссии Агента).
        </p>
        <p className="text-muted-foreground">
          2.2. Настоящий Договор в соответствии с п. 2 ст. 437 Гражданского кодекса Российской Федерации (далее — ГК
          РФ) является публичной офертой.
        </p>
        <p className="text-muted-foreground">
          2.3. Полным и безоговорочным принятием (акцептом) условий считается приобретение
          (оплата/использование) Заказчиком Услуги по бронированию (ст. 438 ГК РФ), а также нажатие кнопки
          «Оплатить», «Заказать» или «Записаться» и проставление отметки о согласии с условиями Оферты,{" "}
          <Link href={LEGAL_ROUTES.privacy} className="text-accent underline">
            Политикой обработки персональных данных
          </Link>{" "}
          и{" "}
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
            Правилами возврата
          </Link>
          .
        </p>
        <p className="text-muted-foreground">
          2.4. С момента акцепта между Заказчиком и Исполнителем считается заключённым Договор на Услуги Агента
          (бронирование и расчёты). Договор на Услугу инструктора считается заключённым с момента{" "}
          <strong>принятия заявки Инструктором</strong> на Сайте (для индивидуальных занятий) либо с момента
          подтверждения записи на Мероприятие в порядке раздела 8.
        </p>
        <p className="text-muted-foreground">
          2.5. Принимая Оферту, Клиент соглашается, что обучающие услуги оказывает выбранный Инструктор лично;
          сведения об исполнителе (имя, налоговый статус) отображаются при оформлении заказа.{" "}
          <strong>Чек (квитанция) на услугу обучения</strong> выставляет <strong>Инструктор</strong> (самозанятый или
          ИП). Подтверждение оплаты заказа через ЮKassa в объёме операций Агента направляет Исполнитель.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Предмет договора. Права и обязанности сторон</h2>
        <p className="text-muted-foreground">
          3.1. Исполнитель обязуется оказать Заказчику Услугу по бронированию (поиск/подбор Инструктора, резервирование
          времени, приём оплаты), а Заказчик обязуется принять и оплатить Услугу в соответствии с условиями
          настоящего Договора.
        </p>
        <p className="text-muted-foreground">
          3.2. Фактическим исполнителем услуг обучения и тренировок является <strong>Инструктор</strong>. Исполнитель
          (Агент) не оказывает такие услуги от своего имени, не руководит занятием на месте его проведения и не
          является стороной договора на обучение.
        </p>
        <p className="text-muted-foreground">
          3.3. Для заказа Услуги по бронированию Заказчик направляет Заявку через Сайт/Платформу Исполнителя.
        </p>
        <p className="text-muted-foreground">
          3.4. При оформлении Заявки Заказчик подтверждает свою дееспособность, финансовую состоятельность и сообщает
          персональные данные (ФИО), контактный телефон, количество Гостей, наличие несовершеннолетних среди Гостей,
          дату, время, продолжительность Услуг инструктора, количество необходимых инструкторов.
        </p>
        <p className="text-muted-foreground">
          3.5. Заказчик подтверждает достоверность указанных данных и принимает риски ошибок и недостоверности.
          Исполнитель не несёт ответственность за неисполнение обязательств по Договору в случае предоставления
          Заказчиком недостоверных данных.
        </p>
        <p className="text-muted-foreground">
          3.6. Заказчик вправе забронировать только Услуги того Инструктора, время которого не занято другими
          Клиентами. Исполнитель вправе отказать в бронировании при занятости Инструктора либо предложить иные
          дату/время (новая оферта / акцепт при согласии Заказчика).
        </p>
        <p className="text-muted-foreground">
          3.7. Совершая оформление Заявки, Заказчик подтверждает согласие с настоящим Договором и даёт согласие на
          обработку персональных данных Исполнителем.
        </p>
        <p className="text-muted-foreground">
          3.8. Исполнитель вправе в одностороннем порядке отказаться от подтверждения бронирования по независящим от
          него причинам (высокая загрузка, неблагоприятные погодные условия, аварии, действия государственных органов
          и т.п.).
        </p>
        <p className="font-medium text-foreground">Исполнитель (Агент) обязуется:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>обеспечить функционирование Сайта, возможность бронирования и оплаты через ЮKassa;</li>
          <li>передать заявку Инструктору и подтвердить Клиенту запись;</li>
          <li>
            организовать возврат в соответствии с{" "}
            <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
              Правилами возврата
            </Link>
            .
          </li>
        </ul>
        <p className="font-medium text-foreground">Инструктор обязуется:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>провести занятие в забронированное время;</li>
          <li>
            уведомить об отмене не позднее <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до начала; при нарушении
            срока — полный возврат клиенту и штраф{" "}
            <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки согласно{" "}
            <Link href={LEGAL_ROUTES.ofertaInstructor} className="text-accent underline">
              договору для инструктора
            </Link>
            ;
          </li>
          <li>иметь статус самозанятого или ИП и предоставлять Клиенту чек на услугу обучения.</li>
        </ul>
        <p className="font-medium text-foreground">Клиент обязуется:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>своевременно оплатить заказ;</li>
          <li>прибыть на занятие вовремя;</li>
          <li>соблюдать технику безопасности.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Сроки оказания Услуг по бронированию</h2>
        <p className="text-muted-foreground">
          4.1. Услуга по бронированию может быть оказана в день поступления Заявки при наличии свободного
          инструктора.
        </p>
        <p className="text-muted-foreground">
          4.2. Заказчик обязан прибыть на место встречи с Инструктором не позднее забронированного времени.
        </p>
        <p className="text-muted-foreground">
          4.3. Опоздание Заказчика более чем на 10 минут — Исполнитель вправе отказать в оказании услуг Инструктора.
        </p>
        <p className="text-muted-foreground">
          4.4. Опоздание Заказчика более чем на 30 минут признаётся предоставлением Услуг по бронированию в полном
          объёме.
        </p>
        <p className="text-muted-foreground">
          4.5. Исполнитель не несёт ответственность за несвоевременное прибытие Заказчика.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Стоимость, комиссия и порядок оплаты</h2>
        <p className="text-muted-foreground">
          5.1. Услуга по бронированию признаётся оказанной в момент заключения Договора с Исполнителем и оплаты
          Заказчиком и выражается в предоставлении бронирования на определённую дату/время.
        </p>
        <p className="text-muted-foreground">
          5.2. <strong>Занятия с инструктором.</strong> Итоговая стоимость, отображаемая Клиенту при оплате, включает:
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>вознаграждение Инструктору (указано в карточке занятия);</li>
          <li>
            Комиссию Агента в размере <strong>{PLATFORM_FEE_PERCENT}%</strong> от стоимости занятия — удерживается
            Исполнителем и включена в итоговую сумму к оплате.
          </li>
        </ul>
        <p className="text-muted-foreground">
          5.3. <strong>Мероприятия.</strong> Стоимость участия также включает Комиссию Агента{" "}
          <strong>{PLATFORM_FEE_PERCENT}%</strong> от цены участия; Инструктору перечисляется сумма за вычетом
          комиссии (раздел 8).
        </p>
        <p className="text-muted-foreground">
          5.4. Оплата производится Клиентом в российских рублях через сервис <strong>ЮKassa</strong> (банковская
          карта / иные способы, доступные в сервисе). Оплата считается произведённой после поступления средств на
          расчётный счёт Исполнителя: <strong>{LEGAL_AGENT.bankAccount}</strong> в {LEGAL_AGENT.bankName}, БИК{" "}
          {LEGAL_AGENT.bik}.
        </p>
        <p className="text-muted-foreground">
          5.5. После успешной оплаты Исполнитель направляет Клиенту подтверждение оплаты (в объёме, предусмотренном
          для операций Агента) и подтверждает бронирование. <strong>Чек на услугу обучения</strong> выставляет{" "}
          <strong>Инструктор</strong> (п. 2.5).
        </p>
        <p className="text-muted-foreground">
          5.6. Оплачивая стоимость, Заказчик подтверждает, что ознакомился с условиями настоящего Договора, согласен с
          ними и обязуется их выполнять.
        </p>
        <p className="text-muted-foreground">
          5.7. Заказчик вправе отказаться от исполнения Договора при условии оплаты Исполнителю фактически понесённых
          расходов, связанных с исполнением обязательств, с учётом таблицы возвратов ниже.
        </p>
        <p className="font-medium text-foreground">5.8. Порядок возврата при отказе Клиента от Услуг бронирования:</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-sm text-muted-foreground">
            <thead>
              <tr className="border-b border-border text-left text-foreground">
                <th className="py-2 pr-4 font-medium">Срок отмены до начала занятия</th>
                <th className="py-2 font-medium">Сумма возврата</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-4">Более {CANCEL_CLIENT_FULL_REFUND_HOURS} часов</td>
                <td className="py-2">
                  <strong className="text-foreground">100%</strong> (полный возврат)
                </td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-4">
                  От {CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до {CANCEL_CLIENT_FULL_REFUND_HOURS} часов
                </td>
                <td className="py-2">
                  <strong className="text-foreground">{CANCEL_CLIENT_PARTIAL_PERCENT}%</strong> от стоимости услуги
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Менее {CANCEL_CLIENT_PARTIAL_REFUND_HOURS} часов</td>
                <td className="py-2">
                  <strong className="text-foreground">Без возврата</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">
          До принятия заявки Инструктором, при истечении срока ожидания ответа, при технической отмене или если оплата
          не произведена — <strong>100%</strong>. Подробности и претензии по качеству — в{" "}
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
            Правилах возврата
          </Link>
          .
        </p>
        <p className="text-muted-foreground">
          5.9. Отмена по инициативе Инструктора — полный возврат Клиенту. Отмена менее чем за{" "}
          <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> или неявка — полный возврат Клиенту и штраф{" "}
          <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> с Инструктора в пользу платформы.
        </p>
        <p className="text-muted-foreground">
          5.10. Отмена по инициативе Исполнителя (технический сбой, мошенничество) — возврат в полном объёме. Опоздание
          Инструктора более <strong>{INSTRUCTOR_LATE_GRACE_MINUTES} мин</strong> от ETA — право Клиента на полный
          возврат в интерфейсе заказа.
        </p>
        <p className="text-muted-foreground">
          5.11. Срок возврата — до 10 (десяти) рабочих дней с момента подтверждения отмены (через ЮKassa на ту же
          карту).
        </p>
        <p className="text-muted-foreground">
          5.12. Клиент вправе использовать реферальный баланс для оплаты заказа (раздел 9).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Ответственность</h2>
        <p className="text-muted-foreground">
          6.1. Исполнитель не несёт ответственность за качество услуг Инструктора, но содействует в разрешении споров
          (связь сторон, возврат в случаях Оферты и Правил возврата).
        </p>
        <p className="text-muted-foreground">
          6.2. Исполнитель не гарантирует: полное соответствие услуг описанию в профиле, наличие у Инструктора всех
          лицензий и разрешений, безопасность занятий, отсутствие вреда здоровью.
        </p>
        <p className="text-muted-foreground">
          6.3. Сайт — информационная площадка. Исполнитель не организует занятие на месте и не выступает организатором
          активного отдыха.
        </p>
        <p className="text-muted-foreground">
          6.4. Занятия спортом связаны с <strong>повышенным риском травм</strong>. Клиент осознаёт риски и принимает их
          на себя. <strong>Исполнитель не несёт ответственности</strong> за травмы, вред здоровью, гибель, повреждение
          имущества и иные последствия при оказании Услуг Инструктора или участии в Мероприятии, за исключением
          случаев, прямо предусмотренных императивными нормами законодательства РФ.
        </p>
        <p className="text-muted-foreground">
          6.5. Ответственность за качество, безопасность и содержание занятия несёт <strong>Инструктор</strong>. У
          Инструкторов требуется действующее страхование гражданской ответственности (
          <Link href={LEGAL_ROUTES.ofertaInstructor} className="text-accent underline">
            договор для инструктора
          </Link>
          ); наличие страхования не переводит ответственность на Исполнителя.
        </p>
        <p className="text-muted-foreground">
          6.6. Исполнитель не несёт ответственность за действия (бездействие) третьих лиц и обстоятельства вне сферы
          его компетенции.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Отзывы, споры, изменения</h2>
        <p className="text-muted-foreground">
          7.1. Клиент вправе оставлять отзывы об Инструкторах после завершения услуги. Отзывы должны быть
          достоверными, без нецензурной лексики, оскорблений и данных о третьих лицах. Исполнитель вправе модерировать
          и удалять отзывы при нарушении правил.
        </p>
        <p className="text-muted-foreground">
          7.2. Претензии направляются Исполнителю письменно в течение 24 часов после возникновения спорной ситуации.
          Срок рассмотрения — 30 дней, если иное не установлено законом. Неурегулированные споры рассматриваются по
          месту нахождения Исполнителя ({legalRegisteredAddress()}), если иное не установлено законом.
        </p>
        <p className="text-muted-foreground">
          7.3. Исполнитель вправе в одностороннем порядке изменять Оферту с публикацией на Сайте. Вопросы, не
          урегулированные Договором, разрешаются по законодательству РФ.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Мероприятия</h2>
        <p className="text-muted-foreground">
          8.1. Мероприятие создаётся Инструктором с указанием даты, времени, места, стоимости и лимита мест.
        </p>
        <p className="text-muted-foreground">
          8.2. Запись оформляется на Сайте с согласием с настоящей Офертой и Политикой ПДн. Для платных мероприятий
          оплата может производиться после проведения (подтверждение участия, списание через ЮKassa) — как указано при
          записи.
        </p>
        <p className="text-muted-foreground">
          8.3. Отмена записи клиентом: за <strong>{EVENT_CANCEL_FULL_REFUND_HOURS} ч и более</strong> до начала —
          полный возврат (если оплата проведена); менее чем за{" "}
          <strong>{EVENT_CANCEL_FULL_REFUND_HOURS} ч</strong> — без возврата.
        </p>
        <p className="text-muted-foreground">
          8.4. Отмена Мероприятия Инструктором — полный возврат оплатившим участникам. Неявка Инструктора — полный
          возврат клиенту и штраф <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> с Инструктора.
        </p>
        <p className="text-muted-foreground">
          8.5. Комиссия Агента по мероприятиям — <strong>{PLATFORM_FEE_PERCENT}%</strong> от стоимости участия каждого
          оплатившего клиента; доля Инструктора — <strong>{100 - PLATFORM_FEE_PERCENT}%</strong>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">9. Реферальная программа</h2>
        <p className="text-muted-foreground">
          9.1. Пользователи могут участвовать в реферальной программе (ссылка с параметром{" "}
          <code className="text-foreground">?ref=</code>). Сведения о коде сохраняются в cookie{" "}
          <strong>{REFERRAL_COOKIE_MAX_AGE_DAYS}</strong> дней.
        </p>
        <p className="text-muted-foreground">
          9.2. Вознаграждение пригласившему — <strong>{REFERRAL_REWARD_RUB} ₽</strong> за каждый из первых{" "}
          <strong>{REFERRAL_MAX_ORDERS_PER_CLIENT}</strong> завершённых оплаченных заказов приглашённого Клиента.
          Вывод баланса — от <strong>{PAYOUT_MIN_WITHDRAWAL_RUB} ₽</strong>.
        </p>
        <p className="text-muted-foreground">
          9.3. Исполнитель вправе изменять или прекращать программу с публикацией на Сайте. Налоговые обязательства по
          выплатам несёт получатель вознаграждения.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">10. Форс-мажор</h2>
        <p className="text-muted-foreground">
          Исполнитель не несёт ответственность за вред жизни, здоровью или имуществу Заказчика/Гостя вследствие
          обстоятельств непреодолимой силы, в том числе: стихийные бедствия, беспорядки, гражданские войны, специальные
          военные операции, забастовки, решения органов власти, аварийные ситуации и т.п.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">11. Реквизиты Исполнителя (Агента)</h2>
        <LegalRequisitesBlock />
        <p className="text-muted-foreground">
          Для Инструкторов действует{" "}
          <Link href={LEGAL_ROUTES.ofertaInstructor} className="text-accent underline">
            договор (публичная оферта) для инструктора
          </Link>
          .
        </p>
      </section>

      <p className="text-xs text-muted-foreground">Редакция от {formatLegalEditionDate()}.</p>
    </LegalDocLayout>
  );
}
