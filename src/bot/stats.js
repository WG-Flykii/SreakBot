import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

import {
  pbStreaksSolo, pbStreaksMulti,
  lbStreaksSolo, lbStreaksMulti,
  userLbSolo, userLbMulti,
  compareStreaks,
  SOLO_USERLB_PATH, MULTI_USERLB_PATH
} from './game.js';
import { client } from '../streakbot.js';
import { mapNames } from '../data/game/maps_data.js';
import { saveJsonFile } from '../utils/json_utils.js';
import { resolveMapName } from '../utils/game_utils.js';
import { getDay, capitalizeFirst, formatTime, findObjectIndex } from '../utils/general_utils.js';
import { userList, availableMapsEmbed } from '../utils/bot_utils.js';

export async function saveOverallStats(userId) {
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
      entry.locsPlayed = locsPlayed;
      entry.totalTime = totalTime;
      entry.totalCorrect = totalCorrect;
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
    .setTitle(`🏆 ${mapName} - ${capitalizeFirst(type)} leaderboard`)
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
    .setTitle(`📊 ${capitalizeFirst(type)} stats for ${(await client.users.fetch(user.id)).username}`)
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
    .setTitle(`Total ${capitalizeFirst(sort)} Leaderboard - ${capitalizeFirst(type)}`)
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
      return a.mapsPlayed - b.mapsPlayed;
    });
  } else {
    userLb = userLb.filter(entry => entry[1].mapsPlayed === mapNames.length);
    userLb.sort(([,a], [,b]) => {
      if (a.totalRank !== b.totalRank) {
        return a.totalRank - b.totalRank;
      }
      return b.totalStreak - a.totalStreak;
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