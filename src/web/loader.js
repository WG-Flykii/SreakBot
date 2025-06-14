import { AttachmentBuilder } from 'discord.js';

import { quizzes, locs } from '../bot/game.js';
import { getCountryFromCoordinates, fetchMapLocations } from '../web/locations.js';
import { getWorldGuessrEmbedUrl, takeScreenshot } from '../web/worldguessr.js';
import { mapNames } from '../data/game/maps_data.js';

const preloadLocs = 4;

export async function loadLoc(channelId, mapName, reload = false, locations = null) {
  let quiz = {};
  if (!locations) locations = quizzes[channelId].mapLocations;
  try {
    if (reload) quiz = locs[channelId][mapName][0];
    else {
      let locationIndex = Math.floor(Math.random() * locations.length);
      let location = locations[locationIndex];
      quiz.location = location;

      let locationInfo;
      locationInfo = await getCountryFromCoordinates(location.lat, location.lng);
      quiz.country = locationInfo.country;
      quiz.subdivision = locationInfo.subdivision;
    }

    const embedUrl = getWorldGuessrEmbedUrl(quiz.location);
    const start = Date.now();
    if (!locations && !quizzes[channelId]) return;
    const screenshotBuffer = await takeScreenshot(embedUrl, channelId);
    console.log('Screenshot took', Date.now()-start);

    quiz.image = new AttachmentBuilder(screenshotBuffer, { name: 'quiz_location.jpg' });
  } catch (error) {
    console.log(`Quiz error in channel ${channelId}:`, error);
  }
  
  if (!locations && !quizzes[channelId]) return;
  if (reload) locs[channelId][mapName][0] = quiz;
  else locs[channelId][mapName].push(quiz);
}

export async function preloadAllMaps(channelId) {
  for (const mapName of mapNames) {
    const [,mapLocations] = await fetchMapLocations(mapName);
    console.log(`Preloading locs for map ${mapName} in channel ${channelId}`);
    await preloadMap(channelId, mapName, mapLocations);
  }
}

export async function preloadMap(channelId, mapName, locations = null) {
  if (!locs[channelId]) locs[channelId] = {};
  if (locs[channelId][mapName]) return;

  locs[channelId][mapName] = [];
  return Promise.all(Array.from(
    { length: preloadLocs },
    () => loadLoc(channelId, mapName, false, locations)
  ));
}