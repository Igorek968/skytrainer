import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  QUALITY_CLAIM_WINDOW_HOURS,
} from "@/lib/legal-config";

/** Краткое описание отмены клиентом (синхронизировано с refund-policy.ts и офертой п. 5.6). */
export function clientCancelRefundSummary(): string {
  return `более ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — 100%; от ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — ${CANCEL_CLIENT_PARTIAL_PERCENT}%; менее ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч — без возврата`;
}

/** Порог уведомления инструктором об отмене (штраф / полный возврат клиенту). */
export function instructorCancelNoticeSummary(): string {
  return `не позднее ${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч до занятия`;
}

/** Опоздание инструктора — полный возврат после ETA + grace. */
export function instructorLateRefundSummary(): string {
  return `опоздание более ${INSTRUCTOR_LATE_GRACE_MINUTES} мин от заявленного ETA — полный возврат по кнопке в заказе`;
}

/** Отмена события клиентом. */
export function eventCancelRefundSummary(): string {
  return `за ${EVENT_CANCEL_FULL_REFUND_HOURS} ч и более до начала — 100%; позже можно отменить без возврата`;
}

/** Штраф инструктору при неявке или поздней отмене. */
export function instructorNoShowPenaltySummary(): string {
  return `${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}% от суммы заявки удерживается платформой из будущих выплат инструктору`;
}

/** Претензия по качеству после завершённого урока. */
export function qualityClaimRefundSummary(): string {
  return `в течение ${QUALITY_CLAIM_WINDOW_HOURS} ч после занятия — автоматический расчёт по категории (см. /returns п. 2.5)`;
}
