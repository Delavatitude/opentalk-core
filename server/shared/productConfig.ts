// Server-only product defaults, configured with environment variables.
import {env} from "../env.ts";

export const PRODUCT_CONFIG = {
  name: env("BOOKING_BRAND_NAME")?.trim() || "OpenTalk",
  mark: env("BOOKING_BRAND_MARK")?.trim() || "OPEN / TALK",
  hostName: env("BOOKING_HOST_NAME")?.trim() || "your team",
  defaultTimezone: env("BOOKING_DEFAULT_TIMEZONE")?.trim() || "UTC",
  calendarSource: env("BOOKING_CALENDAR_SOURCE")?.trim() || "opentalk",
  smsSender: (env("BOOKING_SMS_SENDER")?.trim() || "OPENTALK").slice(0, 11),
  emailFrom: env("RESEND_FROM")?.trim() || "OpenTalk <booking@example.com>",
  testEmailFrom: env("BOOKING_TEST_EMAIL_FROM")?.trim() || "onboarding@resend.dev",
  testEmailTo: env("BOOKING_TEST_EMAIL_TO")?.trim() || "",
};
