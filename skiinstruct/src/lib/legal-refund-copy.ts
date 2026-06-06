import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
} from "@/lib/legal-config";

/** Краткое описание порогов отмены клиентом (синхронизировано с refund-policy.ts). */
export function clientCancelRefundSummary(): string {
  return `более ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч до занятия — 100%; от ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — ${CANCEL_CLIENT_PARTIAL_PERCENT}%; менее ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч — без возврата`;
}

/** Порог уведомления инструктором об отмене (штраф / полный возврат клиенту). */
export function instructorCancelNoticeSummary(): string {
  return `не позднее ${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч до занятия`;
}

/** Опоздание инструктора — полный возврат после ETA + grace. */
export function instructorLateRefundSummary(): string {
  return `опоздание более ${INSTRUCTOR_LATE_GRACE_MINUTES} мин от заявленного ETA — полный возврат по кнопке в заказе`;
}

/** Отмена мероприятия клиентом. */
export function eventCancelRefundSummary(): string {
  return `за ${EVENT_CANCEL_FULL_REFUND_HOURS} ч и более до начала — 100%; позже — без возврата`;
}
