import sharp from 'sharp';

import { getBrowser } from './browser.js';

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

export async function takeScreenshot(url, channelId = 0) {
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
      }, { timeout: 7000 });
    } catch (e) {
      console.log("No canvas found, attempting to capture anyway");
    }

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