/** Локально: 1 — «На модерацию» сразу публикует без очереди в /admin/moderation. */
export function isInstructorEventAutoApproveEnabled(): boolean {
  return process.env.SKIINSTRUCT_AUTO_APPROVE_EVENTS === "1";
}
