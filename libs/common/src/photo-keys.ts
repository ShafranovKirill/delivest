export const PHOTO_KEYS = {
  PRODUCT_CARD: "product_card",
  PRODUCT_PREVIEW: "product_preview",
  PRODUCT_ORIGINAL: "product_original",
} as const;

export type PhotoKey = (typeof PHOTO_KEYS)[keyof typeof PHOTO_KEYS];
