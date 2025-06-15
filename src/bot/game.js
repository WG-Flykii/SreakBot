import { EmbedBuilder } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';

import { saveOverallStats } from './stats.js';

import { COUNTRIES } from '../data/game/countries_data.js';
import { mapToSlug, mapNames } from '../data/game/maps_data.js';

import { resolveMapName, normalizeCountry, checkCountryGuess } from '../utils/game_utils.js';
import { userList, getQuizId, isQuizChannel, compareStreaks } from '../utils/bot_utils.js';
import { loadJsonFile, saveJsonFile } from '../utils/json_utils.js';
import { formatTime } from '../utils/general_utils.js';

import { fetchMapLocations, mapCache } from '../web/locations.js'
import { loadLoc, preloadMap } from '../web/loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PB_STREAK_PATH = path.join(__dirname, '../data/user/pb_streak.json');
const LB_STREAK_PATH = path.join(__dirname, '../data/user/lb_streak.json');
export const USERLB_PATH = path.join(__dirname, '../data/user/userlb.json');
const SERVER_CONFIG_PATH = path.join(__dirname, '../data/user/server_config.json');

export let pbStreaks = loadJsonFile(PB_STREAK_PATH, {});
export let lbStreaks = loadJsonFile(LB_STREAK_PATH, {});
export let userLb = loadJsonFile(USERLB_PATH, {});
export let serverConfig = loadJsonFile(SERVER_CONFIG_PATH, {});

if (!pbStreaks['solo']) pbStreaks['solo'] = {};
if (!pbStreaks['multi']) pbStreaks['multi'] = {};
if (!lbStreaks['solo']) lbStreaks['solo'] = {};
if (!lbStreaks['multi']) lbStreaks['multi'] = {};
if (!userLb['solo']) userLb['solo'] = {};
if (!userLb['multi']) userLb['multi'] = {};


export let quizzes = {};
export let locs = {};

const locRetries = 3;

export async function newLoc(channel, quizId, mapName = null, reload = false) {
  if (!isQuizChannel(channel)) {
    await channel.send("Quizzes can only be played in the designated channel or its threads.");
    return;
  }

  if (reload && !(quizzes[channel.id] && quizzes[channel.id].loadTime)) return;

  let loadingMessage;
  let saveStreaks = true;
  try {
    const isFirst = !quizzes[channel.id];
    const channelData = quizzes[channel.id] || {};
    quizzes[channel.id] = {
      solo: {
        averageTime: channelData.solo?.averageTime || 0,
        streak: channelData.solo?.streak || 0
      },
      multi: {
        averageTime: channelData.multi?.averageTime || 0,
        streak: channelData.multi?.streak || 0
      },
      loadTime: null,
      lastParticipant: channelData.lastParticipant || null,
      participants: channelData.participants || [],
      retries: channelData.retries || 0,
      mapName: channelData.mapName,
      mapLocations: channelData.mapLocations,
      saveStreaks: channelData.saveStreaks,
      lastMessage: null,
    };

    let selectedMapName = null;
    let mapLocations;
    if (isFirst) {
      if (mapName) {
        selectedMapName = resolveMapName(mapName);
        if (!selectedMapName) {
          await channel.send({ content: `Map "${mapName}" not found. Playing without saving streaks...` });
          selectedMapName = mapName;
          saveStreaks = false;
          [selectedMapName, mapLocations] = await fetchMapLocations(selectedMapName, false);
        } else [,mapLocations] = await fetchMapLocations(selectedMapName);
      } else {
        selectedMapName = mapNames[Math.floor(Math.random() * mapNames.length)];
        [,mapLocations] = await fetchMapLocations(selectedMapName);
      }
      quizzes[channel.id].mapName = selectedMapName;
      quizzes[channel.id].mapLocations = mapLocations;
      quizzes[channel.id].saveStreaks = saveStreaks;

      if (!mapLocations) {
        channel.send(`Map "${mapName}" does not exist, or error fetching locations.`);
        delete quizzes[channel.id];
        return;
      }
    }

    if (!quizzes[channel.id]) return;
    loadingMessage = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌍 Loading Quiz...')
          .setDescription('Preparing your challenge, please wait...')
          .setColor('#3498db')
      ]
    });

    if (!quizzes[channel.id]) return;

    mapName = quizzes[channel.id].mapName;
    if (reload) {
      // This needs to be blocking
      await loadLoc(channel.id, mapName, true).then();
    } else {
      if (!locs[channel.id]) locs[channel.id] = {}
      if (!locs[channel.id][mapName]) preloadMap(channel.id, mapName).then();
      else {
        locs[channel.id][mapName].shift();
        loadLoc(channel.id, mapName).then();
      }

      while (locs[channel.id][mapName].length === 0) {
        if (!quizzes[channel.id]) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const currentLoc = locs[channel.id][mapName][0];

    const embed = new EmbedBuilder()
      .setTitle(`🌍 Country streak – ${quizzes[channel.id].mapName}`)
      .setDescription('In which country is this location? Use `!g <country>` to guess!\n*Use `!reload` in case the location doesn\'t load fully.*')
      .setImage('attachment://quiz_location.jpg')
      .setColor('#3498db')
      .setFooter({ text: `Map: ${quizzes[channel.id].mapName} | Current Streak: ${quizzes[channel.id].multi.streak}` });

    if (!quizzes[channel.id]) return;
    quizzes[channel.id].lastMessage = { embeds: [embed], files: [currentLoc.image] }
    await channel.send(quizzes[channel.id].lastMessage);
    await loadingMessage.delete();

    if (!quizzes[channel.id]) return;
    quizzes[channel.id].loadTime = Date.now();

    console.log(`New quiz started in channel ${channel.id}. Map: ${quizzes[channel.id].mapName}, Answer: ${currentLoc.country}`);
    console.log(JSON.stringify(currentLoc.address, null, 2));

    quizzes[channel.id].retries = 0;
  } catch (error) {
    if (!quizzes[channel.id]) return;
    console.error(`Error starting quiz: ${error}`);
    quizzes[channel.id].retries++;
    if (quizzes[channel.id].retries > locRetries) {
      await channel.send(`Max retries reached. Stopping quiz.`);
      if (loadingMessage) await loadingMessage.delete();
      return;
    }
    await channel.send(`An error occurred while creating the quiz. Using ${quizzes[channel.id].retries} out of ${locRetries} retries.`);
    if (loadingMessage) await loadingMessage.delete();
    newLoc(channel, quizId, mapName);
  }
}

// If a guess is right, give info and call newLoc
// If a guess is wrong, end the game and give info
export async function handleGuess(message, guess) {
  if (!guess) return;
  if (
    !quizzes[message.channel.id]
    || !quizzes[message.channel.id].loadTime
  ) return;

  const channelId = message.channel.id;
  const currentLoc = locs[channelId][quizzes[channelId].mapName][0];
  quizzes[channelId].loadTime = null;
  const quiz = quizzes[channelId];
  if (!quizzes[channelId]) return;

  const userId = message.author.id;
  const subdivision = currentLoc.subdivision || 'Unknown subdivision';
  const quizId = getQuizId(message);
  const mapName = quiz.mapName;

  const correctCountry = currentLoc.country;
  if (!correctCountry) return;

  const countryInfo = COUNTRIES[correctCountry.toLowerCase()] ||
    COUNTRIES[normalizeCountry(correctCountry.toLowerCase())];
  const flag = countryInfo?.flag || '';

  const isCorrect = checkCountryGuess(guess, correctCountry);
  const { lat, lng } = currentLoc.location;

  const now = Date.now();
  const quizTime = now - quiz.loadTime;

  if (quizzes[channelId].saveStreaks) {
    if (!pbStreaks['solo'][userId]) pbStreaks['solo'][userId] = {};
    if (!pbStreaks['multi'][userId]) pbStreaks['multi'][userId] = {};
    if (!lbStreaks['solo'][mapName]) lbStreaks['solo'][mapName] = {};
    if (!lbStreaks['multi'][mapName]) lbStreaks['multi'][mapName] = {};

    if (!pbStreaks['solo'][userId][mapName]) {
      pbStreaks['solo'][userId][mapName] = {};
    }
    if (!pbStreaks['solo'][userId][mapName].locsPlayed) {
      pbStreaks['solo'][userId][mapName].locsPlayed = 0;
      pbStreaks['solo'][userId][mapName].totalTime = 0;
      pbStreaks['solo'][userId][mapName].totalCorrect = 0;
    }
  }

  if (isCorrect) {
    if (!quiz.participants.some(p => p === message.author.id)) {
      quiz.participants.push(message.author.id);
    }

    quiz.multi.streak++;
    if (userId !== quiz.lastParticipant) {
      quiz.solo.streak = 1;
    } else {
      quiz.solo.streak++;
    }
    quiz.lastParticipant = userId;

    quiz.solo.averageTime += (quizTime - quiz.solo.averageTime) / quiz.solo.streak; // Math trick
    quiz.multi.averageTime += (quizTime - quiz.multi.averageTime) / quiz.multi.streak; // Math trick

    if (quizzes[channelId].saveStreaks) {
      const soloEntry = {
        streak: quiz.solo.streak,
        averageTime: quiz.solo.averageTime,
        participants: [userId],
        date: now
      };
      const multiEntry = {
        streak: quiz.multi.streak,
        averageTime: quiz.multi.averageTime,
        participants: quiz.participants,
        date: now
      }

      // Must update LBs first, as it uses old dates from old PBs as keys for LB entries
      const lbKeySolo = pbStreaks['solo'][userId][mapName]?.date || -1;
      let lbKeysMulti = quiz.participants.map(p => pbStreaks['multi'][p][mapName]?.date || -1);

      const oldLbEntrySolo = lbStreaks['solo'][mapName][lbKeySolo];
      if (lbKeySolo === -1) {
        console.log(soloEntry);
        lbStreaks['solo'][mapName][now] = soloEntry;
      } else if (compareStreaks(quiz.solo, oldLbEntrySolo) < 0) {
        delete lbStreaks['solo'][mapName][lbKeySolo];
        lbStreaks['solo'][mapName][now] = soloEntry;
      }

      // TODO: effficient insertion with binary search
      lbStreaks['solo'][mapName] = Object.fromEntries(
        Object.entries(lbStreaks['solo'][mapName])
          .sort(([,a], [,b]) => compareStreaks(a, b))
      );

      // Goal: every entry must be at least one participants PB
      // and each participant's PB must appear
      // Algorithm: find indices where the new streak is a PB,
      // If it is at least one person's first streak: insert immediately and return
      // If it is somebody's PB:
      //   check if you can delete old PBs by checking that nobody else's PB is the old PB
      //   insert the new PB in order
      // If it is nobody's PB:
      //   do nothing

      if (quiz.participants.length > 1) {
        let save;
        if (lbKeysMulti.includes(-1)) {
          lbStreaks['multi'][mapName][now] = multiEntry;
          lbKeysMulti = lbKeysMulti.filter(k => k !== -1);
          save = true;
        } else save = false;

        let deletions = [];
        for (const key of lbKeysMulti) {
          if (deletions.includes(key)) continue;
          // Check if it's better than the current PB
          let canDelete = true;
          const pbEntry = lbStreaks['multi'][mapName][key]; // Current place on LB
          if (compareStreaks(quiz.multi, pbEntry) < 0) {
            save = true;
            // Only try to delete if it's better than old PB
            // Check if it's somebody's PB, if so don't delete
            for (const p of pbEntry.participants) {
              if (quiz.participants.includes(p)) continue;
              if (pbStreaks['multi'][p][mapName].date === key) {
                canDelete = false; break;
              }
            }
            if (canDelete) deletions.push(key);
          }
        }

        if (save) {
          for (const key of deletions) {
            delete lbStreaks['multi'][mapName][key];
          }
          lbStreaks['multi'][mapName][now] = multiEntry;
        }

        lbStreaks['multi'][mapName] = Object.fromEntries(
          Object.entries(lbStreaks['multi'][mapName])
            .sort(([,a], [,b]) => compareStreaks(a, b))
        );
      }

      if (
        !pbStreaks['solo'][userId][mapName]
        || compareStreaks(quiz.solo, pbStreaks['solo'][userId][mapName]) < 0
      ) {
        pbStreaks['solo'][userId][mapName] = {
          ...pbStreaks['solo'][userId][mapName],
          ...soloEntry
        };
      }

      if (quiz.participants.length > 1) {
        for (const p of quiz.participants) {
          if (
            !pbStreaks['multi'][p][mapName]
            || compareStreaks(quiz.multi, pbStreaks['multi'][p][mapName]) < 0
          ) {
            pbStreaks['multi'][p][mapName] = multiEntry;
          }
        }
      }

      pbStreaks['solo'][userId][mapName].locsPlayed++;
      pbStreaks['solo'][userId][mapName].totalTime += quizTime;
      pbStreaks['solo'][userId][mapName].totalCorrect++;

      saveOverallStats(userId);

      saveJsonFile(PB_STREAK_PATH, pbStreaks);
      saveJsonFile(LB_STREAK_PATH, lbStreaks);
      saveJsonFile(USERLB_PATH, userLb);
    }

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${flag} Correct!`)
          .setDescription(`You guessed it right! The location is in **${correctCountry}**.`)
          .addFields(
            { name: 'Subdivision', value: `${subdivision}`, inline: true },
            { name: 'Time This Round', value: formatTime(quizTime), inline: true },
            { name: 'Average Time', value: formatTime(quiz.multi.averageTime), inline: true },
            { name: 'Average Solo Time', value: formatTime(quiz.solo.averageTime), inline: true },
            { name: 'Total Streak', value: `${quiz.multi.streak}`, inline: true },
            { name: 'Solo Streak', value: `${quiz.solo.streak}`, inline: true },
            {
              name: "Exact Location",
              value: `[Click here to view on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#2ecc71')
      ]
    });

    // To check when stopped
    if (!quizzes[channelId]) return;
    await newLoc(message.channel, quizId, quiz.mapName);
  } else {
    const participantsList = userList(quiz.participants);

    if (quizzes[channelId].saveStreaks) {
      pbStreaks['solo'][userId][mapName].locsPlayed++;
      pbStreaks['solo'][userId][mapName].totalTime += quizTime;
    }

    saveOverallStats(userId);

    saveJsonFile(PB_STREAK_PATH, pbStreaks);
    saveJsonFile(USERLB_PATH, userLb);

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Game Over!')
          .setDescription(`Wrong guess! The correct answer was **${correctCountry}** ${flag}.`)
          .addFields(
            { name: 'Subdivision', value: `${subdivision}`, inline: true },
            { name: 'Time This Round', value: formatTime(quizTime), inline: true },
            { name: 'Average Time', value: formatTime(quiz.multi.averageTime), inline: true },
            { name: 'Total Streak', value: `${quiz.multi.streak}`, inline: true },
            { name: 'Participants', value: participantsList, inline: true },
            {
              name: "Exact Location",
              value: `[Click here to view on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#e74c3c')
      ]
    });

    if (!quizzes[channelId].saveStreaks) {
      delete mapCache[mapToSlug(quizzes[channelId].mapName)];
      await message.channel.send('Streaks not saved - not an official map.');
    }
    delete quizzes[channelId];
  }
}