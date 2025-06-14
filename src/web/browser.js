import puppeteer from 'puppeteer';

import { preloadLocationCache } from './locations.js';

let browserPool = null;
let isInitializingBrowser = false;
const MAX_BROWSER_AGE = 30 * 60 * 1000; // 30 mins
let browserStartTime = null;

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