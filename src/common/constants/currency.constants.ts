export const BASE_CURRENCY = 'USD';
export const ALLOWED_CURRENCIES = ['USD'] as const;
export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];
