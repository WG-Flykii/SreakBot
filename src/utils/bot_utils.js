import { MessageFlags, EmbedBuilder } from 'discord.js';

import { client } from '../streakbot.js';
import { mapNames } from '../data/game/maps_data.js';
import { serverConfig } from '../bot/game.js';

export const getPrefix = (action) => serverConfig[action.guild.id]?.prefix; // Prefix of bot (! by default)
export const getCreateQuizId = (action) => serverConfig[action.guild.id]?.createQuizId; // Channel to send sendPrivateMessageOffer
export const getQuizId = (action) => serverConfig[action.guild.id]?.quizId; // Main quiz channel
export const getAdminId = (action) => serverConfig[action.guild.id]?.adminId; // Channel to make sendPrivateMessageOffer

export const availableMapsEmbed = () => new EmbedBuilder()
  .setTitle('Available Maps')
  .setDescription(mapNames.join('\n'))
  .setColor('#3498db');

export function setClient(client) {
  global.client = client;
}

export function isQuizChannel(channel) {
  const quizId = getQuizId(channel);
  if (channel.id === quizId) return true;
  if (channel.isThread() && channel.parentId === quizId) return true;
  return false;
}

export async function checkQuizChannel(interaction) {
  const quizId = getQuizId(interaction);
  if (!quizId) {
    await interaction.reply({ content: `The server has not been set up yet for StreakBot.`, flags: MessageFlags.Ephemeral});
    return false;
  }

  if (!isQuizChannel(interaction.channel)) {
    await interaction.reply({ content: `This command can only be used within the quiz channel <#${quizId}>.`, flags: MessageFlags.Ephemeral});
    return false;
  }

  return true;
}

export async function checkAdminChannel(interaction) {
  const adminId = getAdminId(interaction);
  const member = interaction.member;
  if (!adminId) {
    await interaction.reply({ content: `The server has not been set up yet for StreakBot.`, flags: MessageFlags.Ephemeral});
    return false;
  }

  if (interaction.channel.id !== adminId) {
    if ((await client.channels.fetch(adminId)).permissionsFor(member).has('SendMessages')) {
      await interaction.reply({ content: `This command can only be used within the admin channel <#${adminId}>.`, flags: MessageFlags.Ephemeral});
    } else {
      await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral});
    }
    return false;
  }

  return true;
}

export function userList(users) {
  if (users.length === 0) return 'none';
  return users.map(user => `<@${user}>`).join(', ');
}