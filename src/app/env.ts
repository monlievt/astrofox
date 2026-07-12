// @ts-nocheck
const APP_NAME = 'Astrofox';
const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0');
const USER_AGENT = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

export const env = {
  APP_NAME,
  APP_VERSION,
  USER_AGENT,
};

export default env;
