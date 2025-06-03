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

const PB_STREAK_PATH = path.join(__dirname, '../data/user/pb_streak.json');
const LB_STREAK_PATH = path.join(__dirname, '../data/user/lb_streak.json');
const SERVER_CONFIG_PATH = path.join(__dirname, '../data/user/server_config.json');

export let personalBestStreaks = loadJsonFile(PB_STREAK_PATH, {});
export let leaderboardStreaks = loadJsonFile(LB_STREAK_PATH, {});
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

export function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((milliseconds % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
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

    const loadingMessage = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌍 Loading Quiz...')
          .setDescription('Preparing your challenge, please wait...')
          .setColor('#3498db')
      ]
    });

    const averageTime = quizzesByChannel[channel.id]?.averageTime || 0;
    const currentStreak = quizzesByChannel[channel.id]?.currentStreak || 0;

    quizzesByChannel[channel.id] = {
      message: null,
      startTime: null,
      averageTime: averageTime,
      solved: false,
      mapName: selectedMapName,
      currentStreak: currentStreak,
      participants: [],
      startedBy: userId,
      location: null,
      country: null
    };

    const mapLocations = await fetchMapLocations(selectedMapName);
    if (!mapLocations || mapLocations.length === 0) {
      await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
      await channel.send("Could not fetch locations for this map.");
      return;
    }

    const locationIndex = Math.floor(Math.random() * mapLocations.length);
    const location = mapLocations[locationIndex];
    quizzesByChannel[channel.id].location = location;

    const embedUrl = getWorldGuessrEmbedUrl(location);
    if (!embedUrl) {
      await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
      await channel.send("Error generating quiz location.");
      return;
    }

    let locationInfo;
    while (!locationInfo || !locationInfo.country) {
      locationInfo = await getCountryFromCoordinates(location.lat, location.lng);

      if (!locationInfo || !locationInfo.country) {
        await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
        await channel.send("Error fetching country for the location. Deleting it from the map and retrying...");
        mapCache[maps[selectedMapName]].splice(locationIndex, 1);
        newLoc(channel, quizId, mapName, userId);
        return;
      }
    }

    const screenshotBuffer = await takeScreenshot(embedUrl, channel.id);

    quizzesByChannel[channel.id].country = locationInfo.country;
    quizzesByChannel[channel.id].subdivision = locationInfo.subdivision;

    const attachment = new AttachmentBuilder(screenshotBuffer, { name: 'quiz_location.jpg' });

    const embed = new EmbedBuilder()
      .setTitle(`🌍 Country streak – ${selectedMapName}`)
      .setDescription('In which country is this location? Use `!g <country>` to guess!')
      .setImage('attachment://quiz_location.jpg')
      .setColor('#3498db')
      .setFooter({ text: `Map: ${selectedMapName} | Current Streak: ${currentStreak}` });

    const quizMessage = await channel.send({ embeds: [embed], files: [attachment] });
    quizzesByChannel[channel.id].message = quizMessage;
    quizzesByChannel[channel.id].startTime = Date.now();

    await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));

    console.log(`New quiz started in channel ${channel.id}. Map: ${selectedMapName}, Answer: ${locationInfo.country}`);
    console.log(JSON.stringify(locationInfo.address, null, 2));

  } catch (error) {
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

  if (!quiz.participants.some(p => p.id === message.author.id)) {
    quiz.participants.push({ id: message.author.id, username: message.author.username });
  }

  const correctCountry = quiz.country;
  if (!correctCountry) return;

  const countryInfo = COUNTRIES[correctCountry.toLowerCase()] ||
      COUNTRIES[normalizeCountry(correctCountry.toLowerCase())];

  const isCorrect = checkCountryGuess(guess, correctCountry);
  const { lat, lng } = quiz.location;

  if (isCorrect) {
    const userId = message.author.id;
    const username = message.author.username;
    const mapName = quiz.mapName;
    const quizTime = Date.now() - quiz.startTime;

    quiz.solved = true;
    quiz.currentStreak++;
    quiz.averageTime += (quizTime - quiz.averageTime) / quiz.currentStreak; // Math trick

    if (!personalBestStreaks[userId]) {
      personalBestStreaks[userId] = {};
    }

    if (!personalBestStreaks[userId][mapName]) {
      personalBestStreaks[userId][mapName] = {
        streak: quiz.currentStreak,
        averageTime: quiz.averageTime,
        lastUpdate: Date.now(),
        username: username
      };
    } else if (quiz.currentStreak > personalBestStreaks[userId][mapName].streak) {
      personalBestStreaks[userId][mapName] = {
        streak: quiz.currentStreak,
        averageTime: quiz.averageTime,
        lastUpdate: Date.now(),
        username: username
      };
    }

    if (!leaderboardStreaks[mapName]) {
      leaderboardStreaks[mapName] = [];
    }

    const userIndex = leaderboardStreaks[mapName].findIndex(entry => entry.userId === userId);

    const leaderboardEntry = {
      userId: userId,
      username: username,
      streak: quiz.currentStreak,
      averageTime: quiz.averageTime,
      lastUpdate: Date.now()
    };

    if (userIndex === -1) {
      leaderboardStreaks[mapName].push(leaderboardEntry);
    } else if (quiz.currentStreak > leaderboardStreaks[mapName][userIndex].streak) {
      leaderboardStreaks[mapName][userIndex] = leaderboardEntry;
    }

    leaderboardStreaks[mapName].sort((a, b) => {
      if (b.streak !== a.streak) {
        return b.streak - a.streak;
      }
      return a.averageTime - b.averageTime;
    });

    saveJsonFile(PB_STREAK_PATH, personalBestStreaks);
    saveJsonFile(LB_STREAK_PATH, leaderboardStreaks);

    const flag = countryInfo?.flag || '';

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${flag} Correct!`)
          .setDescription(`You guessed it right! The location is in **${correctCountry}**.`)
          .addFields(
            { name: 'Subdivision', value: `**${subdivision}**`, inline: true },
            { name: 'Time This Round', value: formatTime(quizTime), inline: true },
            { name: 'Average Time', value: formatTime(quiz.averageTime), inline: true },
            { name: 'Current Streak', value: `${quiz.currentStreak}`, inline: true },
            {
              name: "Exact Location",
              value: `[Click here to view on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#2ecc71')
      ]
    });

    quizzesByChannel[channelId] = {
      message: quiz.message,
      startTime: Date.now(),
      averageTime: quiz.averageTime,
      solved: true,
      mapName: quiz.mapName,
      currentStreak: quiz.currentStreak,
      participants: [],
      startedBy: quiz.startedBy,
      location: quiz.location,
      country: correctCountry,
      subdivision: quiz.subdivision
    };

    setTimeout(async () => {
      await newLoc(message.channel, quizId, quiz.mapName, message.author.id);
    }, 300);

  } else {
    const flag = countryInfo?.flag || '';

    const quizTime = Date.now() - quiz.startTime;
    const personalBest = personalBestStreaks[message.author.id]?.[quiz.mapName]?.streak || 0;

    const participantsList = quiz.participants.length > 0
      ? quiz.participants.map(p => p.username).join(', ')
      : 'None';

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Game Over!')
          .setDescription(`Wrong guess! The correct answer was **${correctCountry}** ${flag}.`)
          .addFields(
            { name: 'Subdivision', value: `**${subdivision}**`, inline: true },
            { name: 'Time This Round', value: formatTime(quizTime), inline: true },
            { name: 'Average Time', value: formatTime(quiz.averageTime), inline: true },
            { name: 'Final Streak', value: `${quiz.currentStreak}`, inline: true },
            { name: 'Personal Best', value: `${personalBest}`, inline: true },
            { name: 'Participants', value: participantsList, inline: false },
            {
              name: "Exact Location",
              value: `[Click here to view on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#e74c3c')
      ]
    });
    quizzesByChannel[channelId] = {
      message: null,
      startTime: Date.now(),
      solved: true,
      mapName: quiz.mapName,
      currentStreak: 0,
      participants: [],
      startedBy: quiz.startedBy,
      location: null,
      country: null,
      subdivision: null
    };
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

export async function showLeaderboard(channel, inputName) {
  const normalizedInput = inputName?.toLowerCase();

  let mapName = mapAliases[normalizedInput] || inputName;

  if (!mapName || !mapNames.includes(mapName)) {
    const similarMap = mapNames.find(m => m.toLowerCase() === normalizedInput);
    if (similarMap) {
      mapName = similarMap;
    } else {
      await channel.send(`Map "${inputName}" not found. Available maps: ${mapNames.join(', ')}`);
      return;
    }
  }

  const mapLeaderboard = leaderboardStreaks[mapName] || [];

  if (mapLeaderboard.length === 0) {
    await channel.send(`No leaderboard data for map "${mapName}" yet. Be the first to set a record!`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${mapName} - Leaderboard`)
    .setColor('#f1c40f')
    .setFooter({ text: `Updated: ${getDay()}` });

  const topPlayers = mapLeaderboard.slice(0, 10);

  let description = '';
  topPlayers.forEach((entry, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const time = formatTime(entry.averageTime);
    description += `${medal} **${entry.username}** - Streak: ${entry.streak} | Average Time: ${time} | Date: ${getDay(entry.lastUpdate)}\n`;
  });

  embed.setDescription(description);
  await channel.send({ embeds: [embed] });
}

export async function showPersonalStats(message) {
  let userId = message.author.id;
  let username = message.author.username;
  let targetUser = message.author;

  const content = message.content.trim();
  if (content.startsWith('!stats ')) {
    const mentionOrName = content.substring('!stats '.length).trim();

    if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
      userId = targetUser.id;
      username = targetUser.username;
    }
    else if (mentionOrName) {
      let found = false;

      for (const [id, maps] of Object.entries(personalBestStreaks)) {
        for (const mapData of Object.values(maps)) {
          if (mapData.username && mapData.username.toLowerCase() === mentionOrName.toLowerCase()) {
            userId = id;
            username = mapData.username;
            const user = client.users.cache.get(id);
            if (user) {
              targetUser = user;
            }
            found = true;
            break;
          }
        }

        if (found) break;
      }

      if (!found) {
        return message.reply(`User "${mentionOrName}" not found in stats database`);
      }
    }
  }

  const userStats = personalBestStreaks[userId] || {};

  if (Object.keys(userStats).length === 0) {
    return message.reply(`${username} doesn't have streak yet (noob)`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`📊 Stats for ${username}`)
    .setColor('#9b59b6');

  let description = '';
  for (const [mapName, stats] of Object.entries(userStats)) {
    const formattedTime = formatTime(stats.averageTime);

    let position = 'not ranked';
    if (leaderboardStreaks[mapName]) {
      const userPos = leaderboardStreaks[mapName].findIndex(entry => entry.userId === userId);
      if (userPos >= 0) {
        position = `#${userPos + 1}`;
      }
    }

    description += `**${mapName}**\n`;
    description += `Best Streak: ${stats.streak} | Time: ${formattedTime} | Rank: ${position} | Date: ${getDay(stats.lastUpdate)}\n\n`;
  }

  embed.setDescription(description);
  await message.reply({ embeds: [embed] });
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