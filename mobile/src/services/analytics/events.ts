export const eventDefinitions = {
  invite_link_opened: {},
  invite_exchange_attempt: {},
  invite_exchange_success: {},
  invite_exchange_fail: {},
  reminder_opened: {},
  review_prompt_opened: {},
  review_submitted: {},
  google_review_clicked: {},
  notification_received_foreground: {},
  notification_opened: {},
  notification_opened_from_quit: {},
} as const;

export type EventName = keyof typeof eventDefinitions;
