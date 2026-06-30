/** GPS snapshot captured at upload time (phone geolocation). */
export interface UploadGeoContext {
  lat: number;
  lng: number;
  /** Degrees 0–360, if available from device */
  heading?: number;
  accuracyM?: number;
}

/** Optional per-frame geo (future: GPS track sync). */
export interface FrameGeo {
  index: number;
  timestamp: number;
  lat?: number;
  lng?: number;
  heading?: number;
}

export const ADDRESS_REVIEW_THRESHOLD = 70;
