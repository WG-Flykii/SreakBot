import axios from 'axios';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

import { mapToSlug, mapNames } from '../data/game/maps_data.js';

let browserPool = null;
let isInitializingBrowser = false;
const MAX_BROWSER_AGE = 10 * 60 * 1000; // 30 mins
let browserStartTime = null;
const locationCache = {};
export const mapCache = {};

// Initializes resources
export async function initializeResources() {
  try {
    await getBrowser();
    console.log("Initialized browser");

    if (typeof preloadLocationCache === 'function') {
      await preloadLocationCache();
      console.log("Preloaded location cache");
    } else {
      console.log("Function preloadLocationCache is unavailable, ignored");
    }

    console.log("Resources initialized and ready for fast quiz generation");
    return true;
  } catch (error) {
    console.error("Error initializing resources:", error);
    return false;
  }
}

export async function getBrowser() {
  if (isInitializingBrowser) {
    while (isInitializingBrowser) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return browserPool;
  }

  const expired = !browserPool || (Date.now() - browserStartTime > MAX_BROWSER_AGE);
  if (expired) {
    isInitializingBrowser = true;

    if (browserPool) {
      try {
        await browserPool.close();
        browserPage = null;
      } catch (err) {
        console.error("Error closing old browser:", err);
      }
    }

    try {
      browserPool = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions'
        ]
      });
      browserStartTime = Date.now();
      console.log("Browser launched.");
    } catch (err) {
      console.error("Failed to launch browser:", err);
      browserPool = null;
    }

    isInitializingBrowser = false;
  }

  return browserPool;
}

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

export function getWorldGuessrEmbedUrl(location) {
  if (!location) return null;

  const baseUrl = 'https://www.worldguessr.com/svEmbed';
  const params = new URLSearchParams({
    nm: 'true',
    npz: 'false',
    showRoadLabels: 'false',
    lat: location.lat,
    long: location.lng,
    showAnswer: 'false'
  });

  if (location.heading !== undefined) params.append('heading', location.heading);
  if (location.pitch !== undefined) params.append('pitch', location.pitch);
  if (location.zoom !== undefined) params.append('zoom', location.zoom);

  return `${baseUrl}?${params.toString()}`;
}

export async function fetchMapLocations(mapName) {
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

  mapCache[slug] = data.locations;
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
              mapCache[maps[mapName]].splice(i, 1);
              continue;
            }
            locationCache[cacheKey] = locationInfo;
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

export async function takeScreenshot(url, channelId) {
  let page;
  let newPageCreated = false;

  try {
    const browser = await getBrowser();

    page = await browser.newPage();
    newPageCreated = true;

    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1
    });

    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.evaluateOnNewDocument(() => {
      window._resourcesLoaded = false;
      window._canvasReady = false;

      const originalRequestAnimationFrame = window.requestAnimationFrame;
      window.requestAnimationFrame = function(callback) {
        window._canvasReady = true;
        return originalRequestAnimationFrame(callback);
      };
    });

    console.log(`Navigating to URL: ${url} for channel ${channelId}`);
    await page.goto(url, {
      waitUntil: 'load',
      timeout: 50000
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(650, 360, { steps: 2 });
    await page.mouse.up();

    try {
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas');
        return canvas && canvas.offsetWidth > 0;
      }, { timeout: 5000 });
    } catch (e) {
      console.log("No canvas found, attempting to capture anyway");
    }

    /*
    let canProceed = false;
    while (!canProceed && (Date.now() - loadTime < 3000)) {
      canProceed = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;

        try {
          const ctx = canvas.getContext('2d');
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

          let nonBlackPixels = 0;
          for (let i = 0; i < data.length; i += 30000) {
            if (data[i] > 20 || data[i+1] > 20 || data[i+2] > 20) nonBlackPixels++;
            if (nonBlackPixels > 3) return true;
          }

          return false;
        } catch(e) {
          return window._canvasReady;
        }
      });

      if (!canProceed) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }*/

    const screenshotBuffer = await page.screenshot({
      fullPage: false,
      clip: {
        x: 0,
        y: -3,
        width: 1280,
        height: 720
      }
    });

    const optimizedBuffer = await sharp(screenshotBuffer)
      .resize(1280, 715)
      .jpeg({ quality: 65 })
      .toBuffer();

    return optimizedBuffer;
  } catch (error) {
    console.error(`Error taking screenshot for channel ${channelId}: ${error.message}`);
    throw error;
  } finally {
    if (page && newPageCreated) {
      try {
        await page.close();
      } catch (err) {
        console.error("Error closing page:", err);
      }
    }
  }
}