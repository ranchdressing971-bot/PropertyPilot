import type { UploadGeoContext } from "./types";

/**
 * Capture phone GPS (+ compass heading when available) at upload start.
 * Used to narrow candidate addresses before OpenAI reads mailbox numbers.
 */
export async function captureUploadGeo(): Promise<UploadGeoContext | null> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return null;
  }

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 120_000 }
    );
  });

  if (!position) return null;

  const heading = await readDeviceHeading();

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    heading,
    accuracyM: position.coords.accuracy,
  };
}

async function readDeviceHeading(): Promise<number | undefined> {
  if (typeof window === "undefined") return undefined;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("deviceorientation", onOrient);
      resolve(undefined);
    }, 2500);

    function onOrient(e: DeviceOrientationEvent) {
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      const deg =
        ios ??
        (e.alpha != null && Number.isFinite(e.alpha) ? (360 - e.alpha) % 360 : undefined);

      if (deg != null && Number.isFinite(deg)) {
        clearTimeout(timeout);
        window.removeEventListener("deviceorientation", onOrient);
        resolve(deg);
      }
    }

    window.addEventListener("deviceorientation", onOrient);
  });
}
