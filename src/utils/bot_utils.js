import { ChannelType, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { client } from '../streakbot.js';

import { COUNTRIES, COUNTRY_LOOKUP } from '../data/game/countries_data.js';
import { mapNames, maps, mapAliases } from '../data/game/maps_data.js';

import { loadJsonFile, saveJsonFile } from './json_utils.js';
import { initializeResources, getCountryFromCoordinates, getWorldGuessrEmbedUrl, fetchMapLocations, takeScreenshot } from './web_utils.js';

export let quizzesByChannel = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOLO_PB_STREAK_PATH = path.join(__dirname, '../data/user/solo_pb_streak.json');
const SOLO_LB_STREAK_PATH = path.join(__dirname, '../data/user/solo_lb_streak.json');
const MULTI_PB_STREAK_PATH = path.join(__dirname, '../data/user/multi_pb_streak.json');
const MULTI_LB_STREAK_PATH = path.join(__dirname, '../data/user/multi_lb_streak.json');

const SERVER_CONFIG_PATH = path.join(__dirname, '../data/user/server_config.json');

export let pbStreaksSolo = loadJsonFile(SOLO_PB_STREAK_PATH, {});
export let lbStreaksSolo = loadJsonFile(SOLO_LB_STREAK_PATH, {});
export let pbStreaksMulti = loadJsonFile(MULTI_PB_STREAK_PATH, {});
export let lbStreaksMulti = loadJsonFile(MULTI_LB_STREAK_PATH, {});
export let serverConfig = loadJsonFile(SERVER_CONFIG_PATH, {});

export const getCreateQuizId = (action) => serverConfig[action.guild.id]?.createQuizId; // Channel to send sendPrivateMessageOffer
export const getQuizId = (action) => serverConfig[action.guild.id]?.quizId; // Main quiz channel
export const getAdminId = (action) => serverConfig[action.guild.id]?.adminId; // Channel to make sendPrivateMessageOffer

function getDay(date = null) {
  const targetDate = date ? new Date(date) : new Date();
  return targetDate.toISOString().split('T')[0];
}

export function setClient(client) {
  global.client = client;
}

function userList(users) {
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

export async function newLoc(channel, quizId, mapName = null, userId = null) {
  if (!isQuizChannel(channel, quizId)) {
    await channel.send("Quizzes can only be played in the designated channel or its threads.");
    return;
  }

  try {
    let selectedMapName = null;

    if (mapName) {
      selectedMapName = resolveMapName(mapName);
      if (!selectedMapName) {
        // TODO: Check if map exists still, just play it w/ no leaderboard
        await channel.send(`Map "${mapName}" not found.\nAvailable maps: ${mapNames.join(', ')}`);
        return;
      }
    } else {
      selectedMapName = mapNames[Math.floor(Math.random() * mapNames.length)];
    }

    const channelData = quizzesByChannel[channel.id] || {};
    quizzesByChannel[channel.id] = {
      solo: {
        averageTime: channelData.solo?.averageTime || 0,
        currentStreak: channelData.solo?.currentStreak || 0
      },
      multi: {
        averageTime: channelData.multi?.averageTime || 0,
        currentStreak: channelData.multi?.currentStreak || 0
      },
      startTime: null,
      solved: false,
      mapName: selectedMapName,
      lastParticipant: channelData.lastParticipant || null,
      participants: channelData.participants || [],
      location: null,
      country: null,
      subdivision: null
    };

    const loadingMessage = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌍 Loading Quiz...')
          .setDescription('Preparing your challenge, please wait...')
          .setColor('#3498db')
      ]
    });

    const mapLocations = await fetchMapLocations(selectedMapName);

    // Adding a bunch of checks in case !stop is used
    if (quizzesByChannel[channel.id].solved) return;
    if (!mapLocations || mapLocations.length === 0) {
      await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
      await channel.send("Could not fetch locations for this map.");
      return;
    }

    const locationIndex = Math.floor(Math.random() * mapLocations.length);
    const location = mapLocations[locationIndex];
    quizzesByChannel[channel.id].location = location;

    if (quizzesByChannel[channel.id].solved) return;
    const embedUrl = getWorldGuessrEmbedUrl(location);
    if (!embedUrl) {
      await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
      await channel.send("Error generating quiz location.");
      return;
    }

    let locationInfo;
    while (!locationInfo || !locationInfo.country) {
      if (quizzesByChannel[channel.id].solved) return;
      locationInfo = await getCountryFromCoordinates(location.lat, location.lng);

      if (!locationInfo || !locationInfo.country) {
        await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
        await channel.send("Error fetching country for the location. Deleting it from the map and retrying...");
        mapCache[maps[selectedMapName]].splice(locationIndex, 1);
        newLoc(channel, quizId, mapName, userId);
        return;
      }
    }

    if (quizzesByChannel[channel.id].solved) return;
    const screenshotBuffer = await takeScreenshot(embedUrl, channel.id);

    quizzesByChannel[channel.id].country = locationInfo.country;
    quizzesByChannel[channel.id].subdivision = locationInfo.subdivision;

    const attachment = new AttachmentBuilder(screenshotBuffer, { name: 'quiz_location.jpg' });

    const embed = new EmbedBuilder()
      .setTitle(`🌍 Country streak – ${selectedMapName}`)
      .setDescription('In which country is this location? Use `!g <country>` to guess!')
      .setImage('attachment://quiz_location.jpg')
      .setColor('#3498db')
      .setFooter({ text: `Map: ${selectedMapName} | Current Streak: ${quizzesByChannel[channel.id].multi.currentStreak}` });

    if (quizzesByChannel[channel.id].solved) return;
    await channel.send({ embeds: [embed], files: [attachment] });
    quizzesByChannel[channel.id].startTime = Date.now();

    await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));

    console.log(`New quiz started in channel ${channel.id}. Map: ${selectedMapName}, Answer: ${locationInfo.country}`);
    console.log(JSON.stringify(locationInfo.address, null, 2));

  } catch (error) {
    console.log(quizzesByChannel[channel.id]);
    console.error(`Error starting quiz: ${error}`);
    await channel.send("An error occurred while creating the quiz. Please do !stop, and try again.");
  }
}

// If a guess is right, give info and call newLoc
// If a guess is wrong, end the game and give info
export async function handleGuess(message, guess) {
  if (!guess) return;

  const channelId = message.channel.id;
  const quiz = quizzesByChannel[channelId];
  if (!quiz || quiz.solved) return;

  const subdivision = quiz.subdivision || 'Unknown subdivision';
  const quizId = getQuizId(message);

  if (!quiz.participants.some(p => p === message.author.id)) {
    quiz.participants.push(message.author.id);
  }

  const correctCountry = quiz.country;
  if (!correctCountry) return;

  const countryInfo = COUNTRIES[correctCountry.toLowerCase()] ||
    COUNTRIES[normalizeCountry(correctCountry.toLowerCase())];

  const isCorrect = checkCountryGuess(guess, correctCountry);
  const { lat, lng } = quiz.location;

  const now = Date.now();
  const quizTime = now - quiz.startTime;

  if (isCorrect) {
    const userId = message.author.id;
    const mapName = quiz.mapName;

    quiz.solved = true;

    quiz.multi.currentStreak++;
    if (userId !== quiz.lastParticipant) {
      quiz.solo.currentStreak = 1;
    } else {
      quiz.solo.currentStreak++;
    }
    quiz.lastParticipant = userId;

    quiz.solo.averageTime += (quizTime - quiz.solo.averageTime) / quiz.solo.currentStreak; // Math trick
    quiz.multi.averageTime += (quizTime - quiz.multi.averageTime) / quiz.multi.currentStreak; // Math trick

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

    const lbKeySolo = pbStreaksSolo[userId][mapName]?.date || -1;
    let lbKeysMulti = quiz.participants.map(p => pbStreaksMulti[p][mapName]?.date || -1);

    const lbEntrySolo = {
      userId: userId,
      streak: quiz.solo.currentStreak,
      averageTime: quiz.solo.averageTime,
      date: now
    };
    const lbEntryMulti = {
      participants: quiz.participants,
      streak: quiz.multi.currentStreak,
      averageTime: quiz.multi.averageTime,
      date: now
    }

    const oldLbEntrySolo = lbStreaksSolo[mapName][lbKeySolo];
    if (lbKeySolo === -1) {
      lbStreaksSolo[mapName][now] = lbEntrySolo;
    } else if (
      quiz.solo.currentStreak > oldLbEntrySolo.streak
      || (
        quiz.solo.currentStreak === oldLbEntrySolo.streak
        && quiz.solo.averageTime < oldLbEntrySolo.averageTime
      )
    ) {
      delete lbStreaksSolo[mapName][lbKeySolo];
      lbStreaksSolo[mapName][now] = lbEntrySolo;
    }

    // Goal: every entry must be at least one participants PB
    // and each participant's PB must appear
    // Algorithm: find indices where the new streak is a PB,
    // If it is at least one person's first streak: insert immediately and return
    // If it is somebody's PB:
    //   check if you can delete old PBs by checking that nobody else's PB is the old PB
    //   insert the new PB in order
    // If it is nobody's PB:
    //   do nothing

    let save;
    if (lbKeysMulti.includes(-1)) {
      lbStreaksMulti[mapName][now] = lbEntryMulti;
      lbKeysMulti = lbKeysMulti.filter(k => k !== -1);
      save = true;
    } else save = false;

    let deletions = [];
    for (const key of lbKeysMulti) {
      if (deletions.includes(key)) continue;
      // Check if it's better than the current PB
      let canDelete = true;
      const pbEntry = lbStreaksMulti[mapName][key]; // Current place on LB
      if (
        quiz.multi.currentStreak > pbEntry.streak
        || (
          quiz.multi.currentStreak === pbEntry.streak
          && quiz.multi.averageTime < pbEntry.averageTime
        )
      ) {
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
      lbStreaksMulti[mapName][now] = lbEntryMulti;
    }

    // TODO: effficient insertion with binary search
    lbStreaksSolo[mapName] = Object.fromEntries(
      Object.entries(lbStreaksSolo[mapName]).sort(([,a], [,b]) => {
        if (b.streak !== a.streak) {
          return b.streak - a.streak;
        }
        return a.averageTime - b.averageTime;
      })
    );
    lbStreaksMulti[mapName] = Object.fromEntries(
      Object.entries(lbStreaksMulti[mapName]).sort(([,a], [,b]) => {
        if (b.streak !== a.streak) {
          return b.streak - a.streak;
        }
        return a.averageTime - b.averageTime;
      })
    );

    if (
      !pbStreaksSolo[userId][mapName]
      || quiz.solo.currentStreak > pbStreaksSolo[userId][mapName].streak
      || (
        quiz.solo.currentStreak === pbStreaksSolo[userId][mapName].streak
        && quiz.solo.averageTime < pbStreaksSolo[userId][mapName].averageTime
      )
    ) {
      pbStreaksSolo[userId][mapName] = {
        streak: quiz.solo.currentStreak,
        averageTime: quiz.solo.averageTime,
        date: now,
      };
    }

    for (const p of quiz.participants) {
      if (
        !pbStreaksMulti[p][mapName]
        || quiz.multi.currentStreak > pbStreaksMulti[p][mapName].streak
        || (
          quiz.multi.currentStreak === pbStreaksMulti[p][mapName].streak
          && quiz.multi.averageTime < pbStreaksMulti[p][mapName].averageTime
        )
      ) {
        pbStreaksMulti[p][mapName] = {
          streak: quiz.multi.currentStreak,
          averageTime: quiz.multi.averageTime,
          participants: quiz.participants,
          date: now,
        };
      }
    }

    saveJsonFile(SOLO_PB_STREAK_PATH, pbStreaksSolo);
    saveJsonFile(SOLO_LB_STREAK_PATH, lbStreaksSolo);
    saveJsonFile(MULTI_PB_STREAK_PATH, pbStreaksMulti);
    saveJsonFile(MULTI_LB_STREAK_PATH, lbStreaksMulti);

    const flag = countryInfo?.flag || '';

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${flag} Correct!`)
          .setDescription(`You guessed it right! The location is in **${correctCountry}**.`)
          .addFields(
            { name: 'Subdivision', value: `${subdivision}`, inline: true },
            { name: 'Time This Round', value: formatTime(quizTime), inline: true },
            { name: 'Average Total Time', value: formatTime(quiz.multi.averageTime), inline: true },
            { name: 'Average Solo Time', value: formatTime(quiz.solo.averageTime), inline: true },
            { name: 'Total Streak', value: `${quiz.multi.currentStreak}`, inline: true },
            { name: 'Solo Streak', value: `${quiz.solo.currentStreak}`, inline: true },
            {
              name: "Exact Location",
              value: `[Click here to view on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#2ecc71')
      ]
    });

    quizzesByChannel[channelId] = {
      solo: quiz.solo,
      multi: quiz.multi,
      startTime: now,
      solved: true,
      mapName: quiz.mapName,
      lastParticipant: quiz.lastParticipant,
      participants: quiz.participants,
      location: quiz.location,
      country: correctCountry,
      subdivision: quiz.subdivision
    };

    setTimeout(async () => {
      await newLoc(message.channel, quizId, quiz.mapName, message.author.id);
    }, 300);
  } else {
    const flag = countryInfo?.flag || '';
    //const pb = pbStreaksSolo[message.author.id]?.[quiz.mapName]?.streak || 0;

    const participantsList = userList(quiz.participants);


    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Game Over!')
          .setDescription(`Wrong guess! The correct answer was **${correctCountry}** ${flag}.`)
          .addFields(
            { name: 'Subdivision', value: `${subdivision}`, inline: true },
            { name: 'Time This Round', value: formatTime(quizTime), inline: true },
            { name: 'Average Time', value: formatTime(quiz.multi.averageTime), inline: true },
            { name: 'Final Streak', value: `${quiz.multi.currentStreak}`, inline: true },
            { name: 'Participants', value: participantsList, inline: false },
            {
              name: "Exact Location",
              value: `[Click here to view on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#e74c3c')
      ]
    });
    quizzesByChannel[channelId] = { solved: false };
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
          const remainingTimeMs = (24 - hoursInactive) * 60 * 60 * 1000;
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
  const normalizedInput = inputName?.toLowerCase();
  let mapName = mapAliases[normalizedInput] || inputName;

  if (!mapName || !mapNames.includes(mapName)) {
    const similarMap = mapNames.find(m => m.toLowerCase() === normalizedInput);
    if (similarMap) {
      mapName = similarMap;
    } else {
      await interaction.reply(`Map "${inputName}" not found. Available maps: ${mapNames.join(', ')}`);
      return;
    }
  }

  if (type === 'solo') {
    const mapLb = lbStreaksSolo[mapName] || {};

    if (mapLb.length === 0) {
      await interaction.reply(`No solo leaderboard data for map "${mapName}" yet. Be the first to set a record!`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${mapName} - Solo leaderboard`)
      .setColor('#f1c40f')
      .setFooter({ text: `Updated: ${getDay()}` });

    const topPlayers = Object.values(mapLb).slice(0, 10);

    let description = '';
    topPlayers.forEach((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const time = formatTime(entry.averageTime);
      description += `${medal} **<@${entry.userId}>** - Streak: ${entry.streak} | Average Time: ${time} | Date: ${getDay(entry.date)}\n`;
    });

    embed.setDescription(description);
    await interaction.reply({ embeds: [embed] });
  } else if (type === 'multi') {
    const mapLb = lbStreaksMulti[mapName] || {};

    if (mapLb.length === 0) {
      await interaction.reply(`No multi leaderboard data for map "${mapName}" yet. Be the first to set a record!`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${mapName} - Multi leaderboard`)
      .setColor('#f1c40f')
      .setFooter({ text: `Updated: ${getDay()}` });

    const topPlayers = Object.values(mapLb).slice(0, 10);

    let description = '';
    topPlayers.forEach((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const time = formatTime(entry.averageTime);
      description += `${medal} ${userList(entry.participants)}\n`;
      description += `Streak: ${entry.streak} | Average Time: ${time} | Date: ${getDay(entry.date)}\n\n`;
    });

    embed.setDescription(description);
    await interaction.reply({ embeds: [embed] });
  }
}

export async function showPersonalStats(interaction, user, type) {
  if (type === 'solo') {
    const userStats = pbStreaksSolo[user.id] || [];

    if (userStats.length === 0) {
      return interaction.reply(`${user.username} doesn't have a solo streak yet.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 Solo stats for ${(await client.users.fetch(user.id)).username}`)
      .setColor('#9b59b6');

    let description = '';
    for (const [mapName, stats] of Object.entries(userStats)) {
      const formattedTime = formatTime(stats.averageTime);
      let position = 'not ranked';
      if (lbStreaksSolo[mapName]) {
        const userPos = findObjectIndex(
          lbStreaksSolo[mapName],
          String(pbStreaksSolo[user.id][mapName].date)
        );
        if (userPos >= 0) {
          position = `#${userPos + 1}`;
        }
      }

      description += `**${mapName}**\n`;
      description += `Best Streak: ${stats.streak} | Time: ${formattedTime} | Rank: ${position} | Date: ${getDay(stats.date)}\n\n`;
    }

    embed.setDescription(description);
    await interaction.reply({ embeds: [embed] });
  } else if (type === 'multi') {
    const userStats = pbStreaksMulti[user.id] || [];

    if (userStats.length === 0) {
      return interaction.reply(`${user.username} doesn't have a multi streak yet.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 Multi stats for ${(await client.users.fetch(user.id)).username}`)
      .setColor('#9b59b6');

    let description = '';
    for (const [mapName, stats] of Object.entries(userStats)) {
      const formattedTime = formatTime(stats.averageTime);
      let position = 'not ranked';
      if (lbStreaksMulti[mapName]) {
        const userPos = findObjectIndex(
          lbStreaksMulti[mapName],
          String(pbStreaksMulti[user.id][mapName].date)
        );
        if (userPos >= 0) {
          position = `#${userPos + 1}`;
        }
      }

      description += `**${mapName}**\n`
      description += `Participants: ${userList(stats.participants)}\n`;
      description += `Best Streak: ${stats.streak} | Time: ${formattedTime} | Rank: ${position} | Date: ${getDay(stats.date)}\n\n`;
    }

    embed.setDescription(description);
    await interaction.reply({ embeds: [embed] });
  }
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