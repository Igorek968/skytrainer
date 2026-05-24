/** В Docker отключите частый опрос: NEXT_PUBLIC_DISABLE_DEV_POLL=1 (см. docker-compose.yml). */
export const disableDevPoll = process.env.NEXT_PUBLIC_DISABLE_DEV_POLL === "1";

/** Интервал React Query в dev; false — не опрашивать. */
export function devPollInterval(ms: number): number | false {
  return disableDevPoll ? false : ms;
}
