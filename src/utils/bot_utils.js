import { MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

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

export function compareStreaks(a, b) {
  if (a.streak !== b.streak) {
    return b.streak - a.streak;
  }
  return a.averageTime - b.averageTime;
}

export async function navEmbed(
  base, items, itemsPerPage, interaction,
  prefix = '', suffix = '', timeout = 300000
) {
  let page = 1, message;
  const navigation = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('left')
        .setLabel('<')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('right')
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

    const lastEmbed = base.embeds.length - 1;
    const description = items.slice(itemsPerPage * (page - 1), places * page).join();
    base.embeds[lastEmbed].setDescription(prefix + description + suffix);
    base.embeds[lastEmbed].setFooter({ text: `Page ${page} of ${Math.ceil(items.length / places)}` });

    const content = { embeds: base, components: [navigation] };
    if (!message) message = await interaction.reply(content);
    else interaction.editReply(content);
  }

  await updateLb();

  const collector = message.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: timeout
  });
  
  collector.on('collect', async (i) => {
    if (i.customId === 'left') page -= 1;
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