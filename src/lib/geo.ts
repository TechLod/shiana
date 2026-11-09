import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';

export interface Coords {
  latitude: number;
  longitude: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Straight-line distance in meters between two points. */
export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Adds a `distance` (meters) to every item that has coordinates. */
export function withDistance<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  from: Coords | null,
): (T & { distance?: number })[] {
  return items.map((item) => {
    if (from && item.latitude !== null && item.longitude !== null) {
      return {
        ...item,
        distance: distanceMeters(from, { latitude: item.latitude, longitude: item.longitude }),
      };
    }
    return { ...item };
  });
}

/** Opens Google Maps (app or browser) with directions to a point. */
export async function openDirections(latitude: number, longitude: number): Promise<void> {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open maps', 'Check that Google Maps or a web browser is installed.');
  }
}

/** Turns an address into coordinates. Falls back to the given coordinates. */
export async function resolveCoords(address: string, fallback: Coords | null): Promise<Coords | null> {
  if (address.trim()) {
    try {
      const found = await Location.geocodeAsync(address.trim());
      if (found[0]) return { latitude: found[0].latitude, longitude: found[0].longitude };
    } catch {
      // Geocoding can fail offline. Use the fallback below.
    }
  }
  return fallback;
}

type LocationStatus = 'loading' | 'granted' | 'denied' | 'unavailable';

/** Finds the user's position and city. */
export function useLocation(): {
  coords: Coords | null;
  city: string;
  status: LocationStatus;
  refresh: () => Promise<void>;
} {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<LocationStatus>('loading');

  const refresh = useCallback(async () => {
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const here: Coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setCoords(here);
      setStatus('granted');

      const [place] = await Location.reverseGeocodeAsync(here).catch(
        () => [] as Location.LocationGeocodedAddress[],
      );
      setCity(place?.city ?? place?.subregion ?? place?.region ?? '');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { coords, city, status, refresh };
}

/** The city name for a point, or null if it cannot be found. */
export async function cityFromCoords(point: Coords): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync(point);
    return place?.city ?? place?.subregion ?? place?.region ?? null;
  } catch {
    return null;
  }
}
