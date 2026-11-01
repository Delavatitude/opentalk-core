import { PRODUCT_CONFIG } from "./productConfig.ts";

// Shared server-only sender configuration.
export const EMAIL_CONFIG = {
  from: PRODUCT_CONFIG.emailFrom,
  testFrom: PRODUCT_CONFIG.testEmailFrom,
  testTo: PRODUCT_CONFIG.testEmailTo,
};
