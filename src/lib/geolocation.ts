import type { PhotoLocation } from './types';

function getCurrentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ja`,
      { headers: { 'User-Agent': 'AnimaSnap/1.0' } }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const addr = data.address;
    const parts = [
      addr?.state,
      addr?.city || addr?.town || addr?.village,
      addr?.neighbourhood || addr?.suburb,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('') : undefined;
  } catch {
    return undefined;
  }
}

export async function captureLocation(): Promise<PhotoLocation | null> {
  const pos = await getCurrentPosition();
  if (!pos) return null;
  const { latitude, longitude } = pos.coords;
  const placeName = await reverseGeocode(latitude, longitude);
  return { latitude, longitude, placeName };
}
