import { initializeResources } from '../web/browser.js';
import { preloadAllMaps } from '../web/loader.js';

import { serverConfig } from '../bot/game.js';
import { initializeThreadCleanup } from '../bot/inactivity.js';

import { client } from '../streakbot.js';

export async function botStart() {
  console.log(`Logged in as ${client.user.tag}!`);
  initializeThreadCleanup();
  try {
    initializeResources().then();
  } catch (error) {
    console.error("Error initializing resources:", error);
  }
  const allQuizIds = Object.values(serverConfig).map(config => config.quizId);
  for (const quizId of allQuizIds) await preloadAllMaps(quizId);
}