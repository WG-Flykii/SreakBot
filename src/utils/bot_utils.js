import { ChannelType, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { client } from '../streakbot.js';

import { COUNTRIES, COUNTRY_LOOKUP } from '../data/game/countries_data.js';
import { mapToSlug, mapNames, mapAliases } from '../data/game/maps_data.js';

import { loadJsonFile, saveJsonFile } from './json_utils.js';
import { initializeResources, getCountryFromCoordinates, getWorldGuessrEmbedUrl, fetchMapLocations, takeScreenshot, mapCache } from './web_utils.js';

export let quizzes = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOLO_PB_STREAK_PATH = path.join(__dirname, '../data/user/solo_pb_streak.json');
const SOLO_LB_STREAK_PATH = path.join(__dirname, '../data/user/solo_lb_streak.json');
const SOLO_USERLB_PATH = path.join(__dirname, '../data/user/solo_userlb.json');
const MULTI_PB_STREAK_PATH = path.join(__dirname, '../data/user/multi_pb_streak.json');
const MULTI_LB_STREAK_PATH = path.join(__dirname, '../data/user/multi_lb_streak.json');
const MULTI_USERLB_PATH = path.join(__dirname, '../data/user/multi_userlb.json');

const SERVER_CONFIG_PATH = path.join(__dirname, '../data/user/server_config.json');

export let pbStreaksSolo = loadJsonFile(SOLO_PB_STREAK_PATH, {});
export let lbStreaksSolo = loadJsonFile(SOLO_LB_STREAK_PATH, {});
export let pbStreaksMulti = loadJsonFile(MULTI_PB_STREAK_PATH, {});
export let lbStreaksMulti = loadJsonFile(MULTI_LB_STREAK_PATH, {});
let userLbSolo = loadJsonFile(SOLO_USERLB_PATH, {});
let userLbMulti = loadJsonFile(MULTI_USERLB_PATH, {});
export let serverConfig = loadJsonFile(SERVER_CONFIG_PATH, {});

export const getPrefix = (action) => serverConfig[action.guild.id]?.prefix;
export const getCreateQuizId = (action) => serverConfig[action.guild.id]?.createQuizId; // Channel to send sendPrivateMessageOffer
export const getQuizId = (action) => serverConfig[action.guild.id]?.quizId; // Main quiz channel
export const getAdminId = (action) => serverConfig[action.guild.id]?.adminId; // Channel to make sendPrivateMessageOffer

export const availableMapsEmbed = () => new EmbedBuilder()
  .setTitle('Available Maps')
  .setDescription(mapNames.join('\n'))
  .setColor('#3498db');

const locRetries = 3;
const preloadLocs = 4;

function getDay(date = null) {
  const targetDate = date ? new Date(date) : new Date();
  return targetDate.toISOString().split('T')[0];
}

function capFirst(str) {
  return str[0].toUpperCase() + str.slice(1);
}

export function setClient(client) {
  global.client = client;
}

function userList(users) {
  if (users.length === 0) return 'none';
  return users.map(user => `<@${user}>`).join(', ');
}

export function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((milliseconds % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function findObjectIndex(obj, key) {
  return Object.keys(obj).findIndex(k => k === key);
}

export function resolveMapName(input) {
  if (!input) return null;
  return mapAliases[input.toLowerCase()] || null;
}

export function normalizeCountry(countryName) {
  const lookupKey = countryName.toLowerCase();
  if (COUNTRY_LOOKUP[lookupKey]) {
    return COUNTRY_LOOKUP[lookupKey];
  }

  for (const key of Object.keys(COUNTRY_LOOKUP)) {
    if (lookupKey.includes(key) || key.includes(lookupKey)) {
      return COUNTRY_LOOKUP[key];
    }
  }

  return null;
}

export function checkCountryGuess(guess, correctCountry) {
  if (!guess || !correctCountry) return false;

  const normalizedGuess = guess.toLowerCase();
  const normalizedCorrect = correctCountry.toLowerCase();

  if (normalizedGuess === normalizedCorrect) return true;

  const countryKey = normalizeCountry(normalizedCorrect);

  if (countryKey && COUNTRIES[countryKey]) {
    return COUNTRIES[countryKey].aliases.some(alias =>
      alias.toLowerCase() === normalizedGuess
    );
  }

  return normalizedGuess === normalizedCorrect;
}

export function isQuizChannel(channel, quizId) {
  if (channel.id === quizId) return true;
  if (channel.isThread() && channel.parentId === quizId) return true;
  return false;
}

export async function loadLoc(locations, channel, reload = false) {
  let quiz = {};
  try {
    if (reload) quiz = quizzes[channel.id].locs[0];
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
    if (!quizzes[channel.id]) return;
    const screenshotBuffer = await takeScreenshot(embedUrl, channel.id);
    console.log('Screenshot took', Date.now()-start);

    quiz.image = new AttachmentBuilder(screenshotBuffer, { name: 'quiz_location.jpg' });
  } catch (error) {
    console.log(`Quiz error in channel ${channel.id}:`, error);
  }
  
  if (!quizzes[channel.id]) return;
  if (reload) quizzes[channel.id].locs[0] = quiz;
  else quizzes[channel.id].locs.push(quiz);
}

export async function newLoc(channel, quizId, mapName = null, userId = null, reload = false) {
  if (!isQuizChannel(channel, quizId)) {
    await channel.send("Quizzes can only be played in the designated channel or its threads.");
    return;
  }

  if (reload && !(quizzes[channel.id] && quizzes[channel.id].locs)) return;

  let loadingMessage;
  let saveStreaks = true;
  //try {
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
      processed: false,
      locs: channelData.locs || [],
      mapName: channelData.mapName,
      mapLocations: channelData.mapLocations,
      saveStreaks: channelData.saveStreaks,
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

    if (reload) {
      // This needs to be blocking
      await loadLoc(quizzes[channel.id].mapLocations, channel, true).then();
    } else {
      if (isFirst) {
        // To not block, use then
        Promise.all(Array.from(
          { length: preloadLocs },
          () => loadLoc(quizzes[channel.id].mapLocations, channel)
        )).then();
      } else {
        quizzes[channel.id].locs.shift();
        loadLoc(quizzes[channel.id].mapLocations, channel).then();
      }

      while (quizzes[channel.id].locs.length === 0) {
        if (!quizzes[channel.id]) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const currentLoc = quizzes[channel.id].locs[0];
    quizzes[channel.id].processed = true;

    const embed = new EmbedBuilder()
      .setTitle(`🌍 Country streak – ${quizzes[channel.id].mapName}`)
      .setDescription('In which country is this location? Use `!g <country>` to guess!\n*Use `!reload` in case the location doesn\'t load fully.*')
      .setImage('attachment://quiz_location.jpg')
      .setColor('#3498db')
      .setFooter({ text: `Map: ${quizzes[channel.id].mapName} | Current Streak: ${quizzes[channel.id].multi.streak}` });

    if (!quizzes[channel.id]) return;
    await channel.send({ embeds: [embed], files: [currentLoc.image] });
    await loadingMessage.delete();
    quizzes[channel.id].loadTime = Date.now();

    console.log(`New quiz started in channel ${channel.id}. Map: ${quizzes[channel.id].mapName}, Answer: ${currentLoc.country}`);
    console.log(JSON.stringify(currentLoc.address, null, 2));

    quizzes[channel.id].retries = 0;
  /*} catch (error) {
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
    newLoc(channel, quizId, mapName, userId);
  }*/
}

function compareStreaks(a, b) {
  if (a.streak !== b.streak) {
    return b.streak - a.streak;
  }
  return a.averageTime - b.averageTime;
}

// If a guess is right, give info and call newLoc
// If a guess is wrong, end the game and give info
export async function handleGuess(message, guess) {
  if (!guess) return;
  if (!quizzes[message.channel.id]
    || !quizzes[message.channel.id].processed) return;

  const currentLoc = quizzes[message.channel.id].locs[0];
  const channelId = message.channel.id;
  quizzes[channelId].processed = false;
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

    if (!pbStreaksSolo[userId]) {
      pbStreaksSolo[userId] = {};
    }
    if (!pbStreaksMulti[userId]) {
      pbStreaksMulti[userId] = {};
    }
    if (!lbStreaksSolo[mapName]) {
      lbStreaksSolo[mapName] = {};
    }
    if (!lbStreaksMulti[mapName]) {
      lbStreaksMulti[mapName] = {};
    }

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
      const lbKeySolo = pbStreaksSolo[userId][mapName]?.date || -1;
      let lbKeysMulti = quiz.participants.map(p => pbStreaksMulti[p][mapName]?.date || -1);

      const oldLbEntrySolo = lbStreaksSolo[mapName][lbKeySolo];
      if (lbKeySolo === -1) {
        console.log(soloEntry);
        lbStreaksSolo[mapName][now] = soloEntry;
      } else if (compareStreaks(quiz.solo, oldLbEntrySolo) < 0) {
        delete lbStreaksSolo[mapName][lbKeySolo];
        lbStreaksSolo[mapName][now] = soloEntry;
      }

      // TODO: effficient insertion with binary search
      lbStreaksSolo[mapName] = Object.fromEntries(
        Object.entries(lbStreaksSolo[mapName])
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
          lbStreaksMulti[mapName][now] = multiEntry;
          lbKeysMulti = lbKeysMulti.filter(k => k !== -1);
          save = true;
        } else save = false;

        let deletions = [];
        for (const key of lbKeysMulti) {
          if (deletions.includes(key)) continue;
          // Check if it's better than the current PB
          let canDelete = true;
          const pbEntry = lbStreaksMulti[mapName][key]; // Current place on LB
          if (compareStreaks(quiz.multi, pbEntry) < 0) {
            save = true;
            // Only try to delete if it's better than old PB
            // Check if it's somebody's PB, if so don't delete
            for (const p of pbEntry.participants) {
              if (quiz.participants.includes(p)) continue;
              if (pbStreaksMulti[p][mapName].date === key) {
                canDelete = false; break;
              }
            }
            if (canDelete) deletions.push(key);
          }
        }

        if (save) {
          for (const key of deletions) {
            delete lbStreaksMulti[mapName][key];
          }
          lbStreaksMulti[mapName][now] = multiEntry;
        }

        lbStreaksMulti[mapName] = Object.fromEntries(
          Object.entries(lbStreaksMulti[mapName])
            .sort(([,a], [,b]) => compareStreaks(a, b))
        );
        saveJsonFile(MULTI_LB_STREAK_PATH, lbStreaksMulti);
      }

      if (
        !pbStreaksSolo[userId][mapName]
        || compareStreaks(quiz.solo, pbStreaksSolo[userId][mapName]) < 0
      ) {
        pbStreaksSolo[userId][mapName] = {
          ...pbStreaksSolo[userId][mapName],
          ...soloEntry
        };
      }

      if (quiz.participants.length > 1) {
        for (const p of quiz.participants) {
          if (
            !pbStreaksMulti[p][mapName]
            || compareStreaks(quiz.multi, pbStreaksMulti[p][mapName]) < 0
          ) {
            pbStreaksMulti[p][mapName] = multiEntry;
          }
        }
        saveJsonFile(MULTI_PB_STREAK_PATH, pbStreaksMulti);
      }

      if (!pbStreaksSolo[userId][mapName].locsPlayed) {
        pbStreaksSolo[userId][mapName].locsPlayed = 0;
        pbStreaksSolo[userId][mapName].totalTime = 0;
        pbStreaksSolo[userId][mapName].totalCorrect = 0;
        userLbSolo[userId].locsPlayed = 0;
        userLbSolo[userId].totalTime = 0;
        userLbSolo[userId].totalCorrect = 0;
      }
      pbStreaksSolo[userId][mapName].locsPlayed++;
      pbStreaksSolo[userId][mapName].totalTime += quizTime;
      pbStreaksSolo[userId][mapName].totalCorrect++;
      userLbSolo[userId].locsPlayed++;
      userLbSolo[userId].totalTime += quizTime;
      userLbSolo[userId].totalCorrect++;
      userLbSolo[userId].mapsPlayed = Object.keys(pbStreaksSolo[userId]).length;

      saveOverallStats(userId)

      saveJsonFile(SOLO_PB_STREAK_PATH, pbStreaksSolo);
      saveJsonFile(SOLO_LB_STREAK_PATH, lbStreaksSolo);
      saveJsonFile(SOLO_USERLB_PATH, userLbSolo);
      saveJsonFile(MULTI_USERLB_PATH, userLbMulti);
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
    await newLoc(message.channel, quizId, quiz.mapName, message.author.id);
  } else {
    const participantsList = userList(quiz.participants);

    if (quizzes[channelId].saveStreaks) {
      if (!pbStreaksSolo[userId][mapName]) {
        pbStreaksSolo[userId][mapName] = {};
      }
      if (!pbStreaksSolo[userId][mapName].locsPlayed) {
        pbStreaksSolo[userId][mapName].locsPlayed = 0;
        pbStreaksSolo[userId][mapName].totalTime = 0;
        pbStreaksSolo[userId][mapName].totalCorrect = 0;
        userLbSolo[userId].locsPlayed = 0;
        userLbSolo[userId].totalTime = 0;
        userLbSolo[userId].totalCorrect = 0;
      }
      pbStreaksSolo[userId][mapName].locsPlayed++;
      pbStreaksSolo[userId][mapName].totalTime += quizTime;
      userLbSolo[userId].locsPlayed++;
      userLbSolo[userId].totalTime += quizTime;
      userLbSolo[userId].mapsPlayed = Object.keys(pbStreaksSolo[userId]).length;
    }
    saveJsonFile(SOLO_PB_STREAK_PATH, pbStreaksSolo);

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

export async function createPrivateThread(interaction, userId) {
  try {
    if (interaction.deferred || interaction.replied) {
      console.log('Interaction already acknowledged');
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const quizChannel = await client.channels.fetch(getQuizId(interaction));
    if (!quizChannel) {
      return interaction.editReply({ content: 'Quiz channel not found!', flags: MessageFlags.Ephemeral });
    }

    const threadName = `🏁 Private Quiz - ${interaction.user.username}`;
    const thread = await quizChannel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      reason: `Private session for ${interaction.user.username}`
    });

    await thread.members.add(userId);
    const announcementChannel = await client.channels.fetch(getAdminId(interaction));

    if (announcementChannel && announcementChannel.isTextBased()) {
      await announcementChannel.send(`🧵 A new private thread was created by <@${userId}>!\nJoin it here: <https://discord.com/channels/${interaction.guild.id}/${thread.id}>`);
    }

    scheduleThreadInactivityCheck(thread.id);

    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌍 Welcome to Your Private Session!')
          .setDescription('This is a private thread where you can play without interruptions. You can invite others using `!invite <@user>`.')
          .addFields(
            { name: 'Starting a Game', value: 'Use `!play <map>` to begin', inline: false },
            { name: 'Inviting Others', value: 'Use `!invite <@user>` to add friends', inline: false },
            { name: 'Kicking Users', value: 'Use `!kick <@user>` kick the user', inline: false }
          )
          .setColor('#3498db')
      ]
    });

    return interaction.editReply({
      content: `Your private quiz thread has been created! [Join thread](https://discord.com/channels/${interaction.guild.id}/${thread.id})`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('Error creating thread:', error);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: 'There was an error creating your private thread. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    } else {
      return interaction.editReply({
        content: 'There was an error creating your private thread. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
}

export function scheduleThreadInactivityCheck(threadId) {
  setTimeout(async () => {
    try {
      const thread = await client.channels.fetch(threadId);
      if (thread && thread.isThread() && !thread.archived) {
        const lastMessage = await thread.messages.fetch({ limit: 1 });
        const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
        const now = Date.now();
        const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

        if (hoursInactive >= 24) {
          await thread.delete(`Thread inactive for over 24h`);
          console.log(`Deleted inactive thread: ${thread.name}`);
        } else {
          scheduleThreadInactivityCheck(threadId);
        }
      }
    } catch (err) {
      console.error(`Error checking or deleting thread ${threadId}:`, err);
    }
  }, 24 * 60 * 60 * 1000);
}

export async function checkAllQuizThreadsForInactivity() {
  try {
    const quizChannels = await Promise.all(
      Array.from(serverConfig).map(async ([serverId, config]) => {
        const server = await client.guilds.fetch(serverId);
        return await server.channels.fetch(config.quizId);
      })
    );

    quizChannels.forEach(async (quizChannel) => {
      const threads = await quizChannel.threads.fetchActive();
      threads.threads.forEach(async (thread) => {
        try {
          if (thread.isThread() && !thread.archived) {
            const lastMessage = await thread.messages.fetch({ limit: 1 });
            const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
            const now = Date.now();
            const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

            if (hoursInactive >= 24) {
              await thread.delete(`Thread inactive for over 24h`);
              console.log(`Deleted inactive thread: ${thread.name}`);
            } else {
              scheduleThreadInactivityCheck(thread.id);
            }
          }
        } catch (err) {
          console.error(`Error checking thread ${thread.id}:`, err);
        }
      });

      const archivedThreads = await quizChannel.threads.fetchArchived();

      archivedThreads.threads.forEach(async (thread) => {
        try {
          const lastMessage = await thread.messages.fetch({ limit: 1 });
          const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
          const now = Date.now();
          const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

          if (hoursInactive >= 24) {
            await thread.delete(`Thread inactive for over 24h`);
            console.log(`Deleted inactive thread: ${thread.name}`);
          }
        } catch (err) {
          console.error(`Error checking archived thread ${thread.id}:`, err);
        }
      });
    });
  } catch (error) {
    console.error('Error checking all quiz threads:', error);
  }
}

export function initializeThreadCleanup() {
  checkAllQuizThreadsForInactivity();
  setInterval(() => {
    checkAllQuizThreadsForInactivity();
  }, 6 * 60 * 60 * 1000);
}

export async function showLeaderboard(interaction, inputName, type) {
  // TODO: Greatly shorten code by having a navigationi template
  const places = 10;
  const mapName = resolveMapName(inputName);

  if (!mapName) {
    await interaction.reply({ content: `Map "${inputName}" not found.`, embeds: [availableMapsEmbed()] });
    return;
  }

  let mapLb;
  if (type === 'solo'){
    mapLb = Object.values(lbStreaksSolo[mapName]) || [];
  } else if (type === 'multi') {
    mapLb = Object.values(lbStreaksMulti[mapName]) || [];
  } else if (type === 'combined') {
    const mapLbSolo = Object.values(lbStreaksSolo[mapName]) || [];
    const mapLbMulti = Object.values(lbStreaksMulti[mapName]) || [];
    mapLb = mapLbSolo.concat(mapLbMulti);
  }

  if (mapLb.length === 0) {
    await interaction.reply(`No ${type} leaderboard data for map "${mapName}" yet. Be the first to set a record!`);
    return;
  }

  if (type === 'combined') {
    mapLb = mapLb.sort((a, b) => compareStreaks(a, b));
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${mapName} - ${capFirst(type)} leaderboard`)
    .setColor('#f1c40f')
  
  let page = 1;
  let leaderboard;
  const navigation = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('lb_left')
        .setLabel('<')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('lb_right')
        .setLabel('>')
        .setStyle(ButtonStyle.Primary)
    );
    
  async function updateLb() {
    navigation.components[0].setDisabled(false);
    navigation.components[1].setDisabled(false);
    if (page === 1) {
      navigation.components[0].setDisabled(true);
    }
    if (places * page >= mapLb.length) {
      navigation.components[1].setDisabled(true);
    }

    let description = "";
    mapLb.slice(places * (page - 1), places * page).forEach((entry, index) => {
      const realIndex = places * (page - 1) + index;
      const medal = realIndex === 0 ? '🥇' : realIndex === 1 ? '🥈' : realIndex === 2 ? '🥉' : `${realIndex + 1}.`;
      const time = formatTime(entry.averageTime);
      const streakData = `Streak: ${entry.streak} | Average Time: ${time} | Date: ${getDay(entry.date)}`;
      if (type === 'solo') {
        description += `${medal} **<@${entry.participants[0]}>** - ${streakData}\n`;
      } else {
        description += `${medal} ${userList(entry.participants)}\n`;
        description += streakData + '\n\n';
      }
    });
    embed.setDescription(description);
    embed.setFooter({ text: `Page ${page} of ${Math.ceil(mapLb.length / places)}` });

    if (!leaderboard) {
      leaderboard = await interaction.reply({ embeds: [embed], components: [navigation] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [navigation] });
    }
  }

  await updateLb();

  const collector = leaderboard.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 300000
  });
  
  collector.on('collect', async (i) => {
    if (i.customId === 'lb_left') page -= 1;
    else page += 1;
    await i.deferUpdate();
    await updateLb();
  });

  collector.on('end', async () => {
    navigation.components[0].setDisabled(true);
    navigation.components[1].setDisabled(true);
    await interaction.editReply({ components: [navigation] });
  });
}

export async function showPersonalStats(interaction, user, type) {
  const maps = 10;

  let userStats, lbStreaks;
  if (type === 'multi') {
    userStats = pbStreaksMulti[user.id] || {};
    lbStreaks = lbStreaksMulti || {};
  } else {
    userStats = pbStreaksSolo[user.id] || {};
    lbStreaks = lbStreaksSolo || {};
  }

  if (type === 'overall') {
    userStats = Object.entries(userStats).filter(stats => stats[1].locsPlayed !== undefined);
  } else {
    for (const [mapName, stats] of Object.entries(userStats)) {
      let position = -1;
      if (lbStreaks[mapName]) {
        const userPos = findObjectIndex(
          lbStreaks[mapName],
          String(stats.date)
        );
        if (userPos >= 0) {
          position = userPos + 1;
        }
      }
      userStats[mapName]['position'] = position;
    }

    userStats = Object.entries(userStats).sort(([,a], [,b]) => {
      if (a.position === -1 && b.position === -1) {
        return a.averageTime - b.averageTime;
      }
      if (a.position === -1) return 1;
      if (b.position === -1) return -1;
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return a.averageTime - b.averageTime;
    });
  }

  if (userStats.length === 0) {
    if (type === 'overall') {
      return interaction.reply(`${user.username} doesn't have any recorded guesses yet.`);
    }
    return interaction.reply(`${user.username} doesn't have a ${type} streak yet.`);
  }

  let embeds = [];
  let embed = new EmbedBuilder()
    .setTitle(`📊 ${capFirst(type)} stats for ${(await client.users.fetch(user.id)).username}`)
    .setColor('#9b59b6');
  
  if (type === 'overall') {
    let overall = "**Overall Stats**\n";
    const userLbStats = userLbSolo[user.id]
    const accuracy = (userLbStats.locsPlayed === 0) ? 0 : (userLbStats.totalCorrect / userLbStats.locsPlayed * 100).toFixed(2);
    overall += `Locations Played: ${userLbStats.locsPlayed} | Accuracy: ${accuracy}% | Average Time: ${formatTime(userLbStats.totalTime / userLbStats.locsPlayed)}\n`;
    overall += `Rank Sum: ${userLbStats.totalRank} | Streak Sum: ${userLbStats.totalStreak} | Maps Played: ${userLbStats.mapsPlayed}\n\n`;
    embed.setDescription(overall);
    embeds.push(embed);
    embed = new EmbedBuilder().setColor('#9b59b6');
  }
  
  let page = 1;
  let stats;
  const navigation = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('pb_left')
        .setLabel('<')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('pb_right')
        .setLabel('>')
        .setStyle(ButtonStyle.Primary)
    );

  async function updatePb() {
    navigation.components[0].setDisabled(false);
    navigation.components[1].setDisabled(false);
    if (page === 1) {
      navigation.components[0].setDisabled(true);
    }
    if (maps * page >= Object.keys(userStats).length) {
      navigation.components[1].setDisabled(true);
    }

    let description = "";
    for (const [mapName, stats] of userStats.slice(maps * (page - 1), maps * page)) {
      const formattedTime = formatTime(stats.averageTime);
      const positionString = stats.position === -1 ? 'not ranked' : `#${stats.position}`;
      description += `**${mapName}**\n`;
      if (type === 'multi') {
        description += `Participants: ${userList(stats.participants)}\n`;
      }
      if (type === 'overall') {
        const accuracy = (stats.totalCorrect / stats.locsPlayed * 100).toFixed(2);
        description += `Locations Played: ${stats.locsPlayed} | Accuracy: ${accuracy}% | Average Time: ${formatTime(stats.totalTime / stats.locsPlayed)}\n\n`;
      } else {
        description += `Rank: ${positionString} | Best Streak: ${stats.streak} | Time: ${formattedTime} | Date: ${getDay(stats.date)}\n\n`;
      }
    }

    embed.setDescription(description);
    embed.setFooter({ text: `Page ${page} of ${Math.ceil(Object.keys(userStats).length / maps)}` });
    embeds.push(embed);

    if (!stats) {
      stats = await interaction.reply({ embeds, components: [navigation] });
    } else {
      await interaction.editReply({ embeds, components: [navigation] });
    }
    embeds.pop();
  }

  await updatePb();

  const collector = stats.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 300000
  });
  
  collector.on('collect', async (i) => {
    if (i.customId === 'pb_left') page -= 1;
    else page += 1;
    await i.deferUpdate();
    await updatePb();
  });

  collector.on('end', async () => {
    navigation.components[0].setDisabled(true);
    navigation.components[1].setDisabled(true);
    await interaction.editReply({ components: [navigation] });
  });
}

export async function showUserLb(interaction, type, sort) {
  const places = 10;
  const embed = new EmbedBuilder()
    .setTitle(`Total ${capFirst(sort)} Leaderboard - ${capFirst(type)}`)
    .setColor('#f1c40f');
  
  let page = 1;
  let leaderboard;
  const navigation = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('userLb_left')
        .setLabel('<')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('userLb_right')
        .setLabel('>')
        .setStyle(ButtonStyle.Primary)
    );
  
  let userLb = Object.entries(type === 'solo' ? userLbSolo : userLbMulti);
  if (sort === 'streak') {
    userLb.sort(([,a], [,b]) => {
      if (a.totalStreak !== b.totalStreak) {
        return b.totalStreak - a.totalStreak;
      }
      return b.mapsPlayed - b.mapsPlayed;
    });
  } else {
    userLb = userLb.filter(entry => entry[1].mapsPlayed === mapNames.length);
    userLb.sort(([,a], [,b]) => {
      if (a.totalRank !== b.totalRank) {
        return a.totalRank - b.totalRank;
      }
      return b.totalStreak - b.totalStreak;
    });
  }

  if (userLb.length === 0) {
    if (sort === 'rank') {
      return interaction.reply(`No one has played all ${mapNames.length} maps yet in ${type} mode. Be the first!`);
    }
    return interaction.reply(`No one has played in ${type} mode yet. Be the first!`);
  }

  async function updateLb() {
    navigation.components[0].setDisabled(false);
    navigation.components[1].setDisabled(false);
    if (page === 1) {
      navigation.components[0].setDisabled(true);
    }
    if (places * page >= userLb.length) {
      navigation.components[1].setDisabled(true);
    }

    let description = sort === 'rank' ? `You must play all maps in ${type} mode to be on this leaderboard.\n\n` : '';
    userLb.slice(places * (page - 1), places * page).forEach((entry, index) => {
      const realIndex = places * (page - 1) + index;
      const medal = realIndex === 0 ? '🥇' : realIndex === 1 ? '🥈' : realIndex === 2 ? '🥉' : `${realIndex + 1}.`;
      let streakData;
      if (sort === 'rank') {
        streakData = `Rank Sum: ${entry[1].totalRank} | Streak Sum: ${entry[1].totalStreak}`;
      } else {
        streakData = `Streak Sum: ${entry[1].totalStreak} | Maps Played: ${entry[1].mapsPlayed}`;
      }
      description += `${medal} **<@${entry[0]}>** - ${streakData}\n`;
    });

    embed.setDescription(description);
    embed.setFooter({ text: `Page ${page} of ${Math.ceil(Object.keys(userLb).length / places)}` });

    if (!leaderboard) {
      leaderboard = await interaction.reply({ embeds: [embed], components: [navigation] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [navigation] });
    }
  }

  await updateLb();

  const collector = leaderboard.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 300000
  });
  
  collector.on('collect', async (i) => {
    if (i.customId === 'userLb_left') page -= 1;
    else page += 1;
    await i.deferUpdate();
    await updateLb();
  });

  collector.on('end', async () => {
    navigation.components[0].setDisabled(true);
    navigation.components[1].setDisabled(true);
    await interaction.editReply({ components: [navigation] });
  });
}

async function saveOverallStats(userId) {
  for (const type of ['solo', 'multi']) {
    const pbStreaks = type === 'solo' ? pbStreaksSolo : pbStreaksMulti;
    const lbStreaks = type === 'solo' ? lbStreaksSolo : lbStreaksMulti;
    const streaks = pbStreaks[userId];
    if (!streaks) return;
    let totalRank = 0, totalStreak = 0;
    let locsPlayed = 0, totalTime = 0, totalCorrect = 0;
    for (const [mapName, stats] of Object.entries(streaks)) {
      totalRank += 1 + findObjectIndex(
        lbStreaks[mapName],
        String(stats.date)
      );
      totalStreak += stats.streak;
      locsPlayed += stats.locsPlayed || 0;
      totalTime += stats.totalTime || 0;
      totalCorrect += stats.totalCorrect || 0;
    }
    if (totalStreak === 0) return;
    let entry = {
      totalRank,
      totalStreak,
      mapsPlayed: Object.keys(streaks).length
    };
    if (type === 'solo') {
      if (!userLbSolo[userId]) userLbSolo[userId] = {};
      userLbSolo[userId].locsPlayed = locsPlayed;
      userLbSolo[userId].totalTime = totalTime;
      userLbSolo[userId].totalCorrect = totalCorrect;
      userLbSolo[userId] = entry;
    } else {
      if (!userLbMulti[userId]) userLbMulti[userId] = {};
      userLbMulti[userId] = entry;
    }
  }
}

export async function refreshUserLb() {
  for (const userId of Object.keys(pbStreaksSolo)) {
    await saveOverallStats(userId);
  }
  saveJsonFile(SOLO_USERLB_PATH, userLbSolo);
  saveJsonFile(MULTI_USERLB_PATH, userLbMulti);
}

export async function checkQuizChannel(interaction) {
  if (!getQuizId(interaction)) {
    await interaction.reply({ content: `The server has not been set up yet for StreakBot.`, flags: MessageFlags.Ephemeral});
    return false;
  }

  const channel = await client.channels.fetch(getQuizId(interaction));
  if (interaction.channel !== channel) {
    await interaction.reply({ content: `This command can only be used within the quiz channel <#${getQuizId(interaction)}>.`, flags: MessageFlags.Ephemeral});
    return false;
  }

  return true;
}

export async function checkAdminChannel(interaction) {
  if (!getAdminId(interaction)) {
    await interaction.reply({ content: `The server has not been set up yet for StreakBot.`, flags: MessageFlags.Ephemeral});
    return false;
  }

  const member = interaction.member;
  const channel = await client.channels.fetch(getAdminId(interaction));

  if (interaction.channel !== channel) {
    if (channel.permissionsFor(member).has('SendMessages')) {
      await interaction.reply({ content: `This command can only be used within the admin channel <#${getAdminId(interaction)}>.`, flags: MessageFlags.Ephemeral});
    } else {
      await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral});
    }
    return false;
  }

  return true;
}

export async function sendPrivateMessageOffer(createQuizId) {
  try {
    const channel = await client.channels.fetch(createQuizId);
    if (!channel) {
      console.error('Quiz channel not found');
      return;
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_private_thread')
          .setLabel('Create Private Quiz Thread')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮')
      );

    const embed = new EmbedBuilder()
      .setTitle('🌍 Start Your Private Session')
      .setDescription(
        '**Play uninterrupted, at your own pace.**\nCreate a private thread just for you — perfect for solo challenges or games with friends.'
      )
      .addFields(
        {
          name: '👥 Multiplayer Control',
          value: 'Use `!invite <@user>` to invite friends, and `!kick <@user>` to remove them from your thread.'
        }
      )
      .setColor('#3498db')
      .setFooter({ text: 'Private threads auto-clean after inactivity.' });

    await channel.send({
      embeds: [embed],
      components: [row]
    });


    console.log('Private thread creation message sent');
  } catch (error) {
    console.error('Error sending private message offer:', error);
  }
}

export async function botStart() {
  console.log(`Logged in as ${client.user.tag}!`);
  initializeThreadCleanup();
  try {
    await initializeResources();
  } catch (error) {
    console.error("Erreur lors de l'initialisation des ressources:", error);
  }
}
