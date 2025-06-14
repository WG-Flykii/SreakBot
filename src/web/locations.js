import axios from 'axios';

import { mapToSlug, mapNames } from '../data/game/maps_data.js';

const locationCache = {};
export const mapCache = {};

export async function getCountryFromCoordinates(lat, lng) {
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

  if (locationCache[cacheKey]) {
    return locationCache[cacheKey];
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'GeoBot/1.0',
        'Accept-Language': 'en'
      }
    });

    const address = response.data?.address;
    let country = address?.country;
    let subdivision =
      address?.state ||
      address?.province ||
      address?.region ||
      address?.territory ||
      address?.state_district ||
      address?.county ||
      address?.administrative ||
      address?.municipality ||
      address?.district ||
      address?.city_district || // Ahead of city for microstates
      address?.suburb ||
      address?.city ||
      address?.town ||
      address?.village ||
      address?.locality ||
      address?.borough ||
      address?.neighbourhood ||
      address?.hamlet ||
      address?.ISO3166_2_lvl4 ||
      address?.ISO3166_2_lvl6 ||
      address?.political ||
      'Unknown subdivision';

    if (country === 'United States') {
      if (subdivision.toLowerCase().includes('us virgin islands')) country = 'us virgin islands';
      else if (subdivision.toLowerCase().includes('puerto rico')) country = 'puerto rico';
      else if (subdivision.toLowerCase().includes('guam')) country = 'guam';
      else if (subdivision.toLowerCase().includes('american samoa')) country = 'american samoa';
      else if (subdivision.toLowerCase().includes('northern mariana islands')) country = 'northern mariana islands';
    }

    if (subdivision?.toLowerCase() === 'greenland') country = 'greenland';

    const result = {
      country: country?.toLowerCase() || 'Unknown location',
      subdivision: subdivision || 'Unknown subdivision',
      address
    };

    if (result.country === 'Unknown location') return null;

    locationCache[cacheKey] = result;
    return result;
  } catch (error) {
    console.error('Error with Nominatim API:', error);
    return { country, subdivision, address };
  }
}

export async function fetchMapLocations(mapName, saveStreaks = true) {
  const slug = mapToSlug(mapName);
  const url = `https://api.worldguessr.com/mapLocations/${slug}`;
  console.log(`Fetching map locations for ${mapName} at ${url}`);

  if (mapCache[slug]) return [mapName, mapCache[slug]];

  const res = await fetch(url);
  if (!res.ok) return [null, null];

  const data = await res.json();
  if (!data.ready || !Array.isArray(data.locations)) {
    throw new Error(`Map "${mapName}" is not ready or contains no locations.`);
  }

  if (saveStreaks) mapCache[slug] = data.locations;
  return [data.name, data.locations];
}

export async function preloadLocationCache() {
  console.log("Preloading known locations...");

  for (const mapName of mapNames) {
    try {
      const [,locations] = await fetchMapLocations(mapName);
      for (let i = locations.length-1; i >= 0; i--) {
        if (i >= locations.length) break; // To handle concurrent bad loc deletions
        const location = locations[i];
        const cacheKey = `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
        if (!locationCache[cacheKey]) {
          try {
            const locationInfo = await getCountryFromCoordinates(location.lat, location.lng);
            if (!locationInfo || !locationInfo.country) {
              console.log(`Unknown location for coordinates ${location.lat}, ${location.lng}. Deleting from map ${mapName}.`);
              mapCache[mapToSlug(mapName)].splice(i, 1);
              continue;
            }
          } catch (e) {
            console.error(`Error preloading cache for ${cacheKey}:`, e);
          }
        }
      }
    } catch (e) {
      console.error(`Error loading map ${mapName}:`, e);
    }
  }

  console.log(`Location cache preloaded with ${Object.keys(locationCache).length} entries`);
}