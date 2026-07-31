import type { UploadGeoContext } from "./types";

/**
 * Capture phone GPS (+ compass heading when available) at upload start.
 * Optionally samples a short watchPosition track while frames extract so
 * community fingerprints can store an approximate route + soft boundary.
 */
export async function captureUploadGeo(opts?: {
  /** Keep sampling GPS for this many ms (default 0 = single fix). */
  trackMs?: number;
}): Promise<UploadGeoContext | null> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return null;
  }

  const trackMs = Math.max(0, opts?.trackMs ?? 0);
  const route: NonNullable<UploadGeoContext["route"]> = [];

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 120_000 }
    );
  });

  if (!position) return null;

  const heading = await readDeviceHeading();
  const first = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyM: position.coords.accuracy,
    heading,
    t: Date.now(),
  };
  route.push(first);

  if (trackMs > 0) {
    await sampleRoute(route, trackMs);
  }

  const last = route[route.length - 1] ?? first;
  return {
    lat: last.lat,
    lng: last.lng,
    heading: last.heading ?? heading,
    accuracyM: last.accuracyM ?? position.coords.accuracy,
    route: route.length > 1 ? route : undefined,
  };
}

function sampleRoute(
  route: NonNullable<UploadGeoContext["route"]>,
  trackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve();
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const pt = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyM: p.coords.accuracy,
          t: Date.now(),
        };
        const prev = route[route.length - 1];
        // Dedupe near-identical samples
        if (
          !prev ||
          Math.abs(prev.lat - pt.lat) > 0.00002 ||
          Math.abs(prev.lng - pt.lng) > 0.00002
        ) {
          route.push(pt);
        }
      },
      () => {
        /* ignore watch errors — keep first fix */
      },
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 8_000 }
    );

    window.setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      resolve();
    }, trackMs);
  });
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
