import { ChannelType, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

import { getQuizId, getAdminId } from '../utils/bot_utils.js';
import { client } from '../streakbot.js';

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

    await interaction.editReply({
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