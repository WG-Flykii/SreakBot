import { EmbedBuilder } from 'discord.js';

import { pbStreaks, lbStreaks, userLb, USERLB_PATH } from './game.js';

import { mapNames } from '../data/game/maps_data.js';

import { saveJsonFile } from '../utils/json_utils.js';
import { resolveMapName } from '../utils/game_utils.js';
import { getDay, capitalizeFirst, formatTime, findObjectIndex } from '../utils/general_utils.js';
import { userList, availableMapsEmbed, navEmbed, compareStreaks } from '../utils/bot_utils.js';

import { client } from '../streakbot.js';

export async function saveOverallStats(userId) {
  for (const type of ['solo', 'multi']) {
    const streaks = pbStreaks[userId];
    if (!streaks) return;
    let totalRank = 0, totalStreak = 0;
    let locsPlayed = 0, totalTime = 0, totalCorrect = 0;
    for (const [mapName, stats] of Object.entries(streaks)) {
      totalRank += 1 + findObjectIndex(
        lbStreaks[type][mapName],
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
      entry.locsPlayed = locsPlayed;
      entry.totalTime = totalTime;
      entry.totalCorrect = totalCorrect;
    }
    userLb[type][userId] = entry;
  }
}

export async function refreshUserLb() {
  for (const userId of Object.keys(pbStreaks['solo'])) {
    await saveOverallStats(userId);
  }
  saveJsonFile(USERLB_PATH, userLb);
}

export async function showLeaderboard(interaction, inputName, type) {
  const places = 10;
  const mapName = resolveMapName(inputName);

  if (!mapName) {
    await interaction.reply({ content: `Map "${inputName}" not found.`, embeds: [availableMapsEmbed()] });
    return;
  }

  let mapLb;
  if (type === 'combined') {
    const mapLbSolo = Object.values(lbStreaks['solo'][mapName]) || [];
    const mapLbMulti = Object.values(lbStreaks['multi'][mapName]) || [];
    mapLb = mapLbSolo.concat(mapLbMulti).sort((a, b) => compareStreaks(a, b));
  } else {
    mapLb = Object.values(lbStreaks[type][mapName]);
  }

  if (mapLb.length === 0) {
    await interaction.reply(`No ${type} leaderboard data for map "${mapName}" yet. Be the first to set a record!`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${mapName} - ${capitalizeFirst(type)} leaderboard`)
    .setColor('#f1c40f')
  
  const items = mapLb.map((entry, index) => {
    let item = "";
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const time = formatTime(entry.averageTime);
    const streakData = `Streak: ${entry.streak} | Average Time: ${time} | Date: ${getDay(entry.date)}`;
    if (type === 'solo') {
      item += `${medal} **<@${entry.participants[0]}>** - ${streakData}\n`;
    } else {
      item += `${medal} ${userList(entry.participants)}\n`;
      item += streakData + '\n\n';
    }
    return item;
  });

  await navEmbed([embed], items, 10, interaction);
}

export async function showPersonalStats(interaction, user, type) {
  let items;
  let embeds = [
    new EmbedBuilder()
      .setTitle(`📊 ${capitalizeFirst(type)} stats for ${(await client.users.fetch(user.id)).username}`)
      .setColor('#9b59b6')
  ];

  if (type === 'overall') {
    let userStats = Object.entries(pbStreaks['solo'][user.id]) || [];
    userStats = userStats.filter(stats => stats[1].locsPlayed !== undefined);
    if (userStats.length === 0) {
      return interaction.reply(`${user.username} doesn't have any recorded guesses yet.`);
    }

    let overall = "**Overall Stats**\n";
    const userLbStats = userLb['solo'][user.id]
    const accuracy = (userLbStats.locsPlayed === 0) ? 0 : (userLbStats.totalCorrect / userLbStats.locsPlayed * 100).toFixed(2);
    overall += `Locations Played: ${userLbStats.locsPlayed} | Accuracy: ${accuracy}% | Average Time: ${formatTime(userLbStats.totalTime / userLbStats.locsPlayed)}\n`;
    overall += `Rank Sum: ${userLbStats.totalRank} | Streak Sum: ${userLbStats.totalStreak} | Maps Played: ${userLbStats.mapsPlayed}\n\n`;
    embeds[0].setDescription(overall);
    embeds.push(new EmbedBuilder().setColor('#9b59b6'));

    items = userStats.map(([mapName, stats]) => {
      let item = "";
      item += `**${mapName}**\n`;
      const accuracy = (stats.totalCorrect / stats.locsPlayed * 100).toFixed(2);
      item += `Locations Played: ${stats.locsPlayed} | Accuracy: ${accuracy}% | Average Time: ${formatTime(stats.totalTime / stats.locsPlayed)}\n\n`;
      return item;
    });
  } else {
    let userStats = Object.entries(pbStreaks[type][user.id]) || [];
    if (userStats.length === 0) {
      return interaction.reply(`${user.username} doesn't have a ${type} streak yet.`);
    }

    for (const [mapName, stats] of userStats) {
      let position = -1;
      if (lbStreaks[type][mapName]) {
        const userPos = findObjectIndex(
          lbStreaks[type][mapName],
          String(stats.date)
        );
        if (userPos >= 0) {
          position = userPos + 1;
        }
      }
      stats['position'] = position;
    }

    userStats = userStats.sort(([,a], [,b]) => {
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

    items = userStats.map(([mapName, stats]) => {
      let item = "";
      const formattedTime = formatTime(stats.averageTime);
      const positionString = stats.position === -1 ? 'not ranked' : `#${stats.position}`;
      delete stats.position
      item += `**${mapName}**\n`;
      if (type === 'multi') item += `Participants: ${userList(stats.participants)}\n`;
      item += `Rank: ${positionString} | Best Streak: ${stats.streak} | Time: ${formattedTime} | Date: ${getDay(stats.date)}\n\n`;
      return item;
    });
  }

  await navEmbed(embeds, items, 10, interaction);
}

export async function showUserLb(interaction, type, sort) {
  const embed = new EmbedBuilder()
    .setTitle(`Total ${capitalizeFirst(sort)} Leaderboard - ${capitalizeFirst(type)}`)
    .setColor('#f1c40f');
  
  let lb = Object.entries(userLb[type]);
  if (sort === 'streak') {
    if (lb.length === 0) {
      return interaction.reply(`No one has played in ${type} mode yet. Be the first!`);
    }

    lb.sort(([,a], [,b]) => {
      if (a.totalStreak !== b.totalStreak) {
        return b.totalStreak - a.totalStreak;
      }
      return a.mapsPlayed - b.mapsPlayed;
    });
  } else {
    lb = lb.filter(entry => entry[1].mapsPlayed === mapNames.length);

    if (lb.length === 0) {
      return interaction.reply(`No one has played all ${mapNames.length} maps yet in ${type} mode. Be the first!`);
    }

    lb.sort(([,a], [,b]) => {
      if (a.totalRank !== b.totalRank) {
        return a.totalRank - b.totalRank;
      }
      return b.totalStreak - a.totalStreak;
    });
  }

  const prefix = sort === 'rank' ? `You must play all maps in ${type} mode to be on this leaderboard.\n\n` : '';

  const items = lb.map((entry, index) => {
    let streakData;
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    if (sort === 'rank') {
      streakData = `Rank Sum: ${entry[1].totalRank} | Streak Sum: ${entry[1].totalStreak}`;
    } else {
      streakData = `Streak Sum: ${entry[1].totalStreak} | Maps Played: ${entry[1].mapsPlayed}`;
    }
    return `${medal} **<@${entry[0]}>** - ${streakData}\n`;
  });

  await navEmbed([embed], items, 10, interaction, prefix);
}