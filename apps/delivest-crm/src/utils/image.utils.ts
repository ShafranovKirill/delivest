import { PHOTO_KEYS, type PhotoKey } from "@delivest/common";

export const ImageHelper = {
  endpoint: import.meta.env.VITE_STORAGE_ENDPOINT_PUBLIC,
  bucket: import.meta.env.VITE_STORAGE_BUCKET_NAME,

  generatePublicUrl(fileKey: string | null | undefined): string | null {
    if (!fileKey || !this.endpoint || !this.bucket) {
      return null;
    }
    const base = this.endpoint.replace(/\/$/, "");
    return `${base}/${this.bucket}/${fileKey}`;
  },

  getProductPhotoUrl(
    photos: Record<string, string> | null | undefined,
    type: PhotoKey = PHOTO_KEYS.PRODUCT_CARD,
  ): string | null {
    if (!photos) return null;

    const fileKey = photos[type];
    return this.generatePublicUrl(fileKey);
  },
};
