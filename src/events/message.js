import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { mapAliases, mapData } from '../data/game/maps_data.js';

import { quizzes, locs, newLoc, handleGuess } from '../bot/game.js';
import { sendPrivateMessageOffer } from '../bot/private_quiz.js';
import { refreshUserLb } from '../bot/stats.js';
import { getCreateQuizId, getQuizId, getAdminId, getPrefix, isQuizChannel, availableMapsEmbed } from '../utils/bot_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handles all commands of players
async function handlePlayerCommands(message) {
  const content = message.content.trim().toLowerCase();
  let [command, ...args] = content.split(' ');
  if (command.startsWith(getPrefix(message))) command = command.slice(1);
  else return;

  const quizId = getQuizId(message);
  const mentionedUser = message.mentions.users.first();

  switch (command) {
    case 'invite':
      if (message.mentions.users.size === 0) return;

      if (!message.channel.isThread()) {
        await message.reply('❌ This command can only be used inside a thread.');
        return;
      }

      try {
        await message.channel.members.add(mentionedUser.id);
        await message.reply(`✅ Successfully invited ${mentionedUser.username} to the thread.`);
      } catch (error) {
        console.error('Error inviting user:', error);
        await message.reply('❌ Failed to invite the user. Make sure I have the correct permissions.');
      }
      break;

    case 'kick':
      if (message.mentions.users.size === 0) return;

      if (!message.channel.isThread()) {
        await message.reply('❌ This command can only be used inside a thread.');
        return;
      }

      try {
        await message.channel.members.remove(mentionedUser.id);
        await message.reply(`✅ Successfully kicked ${mentionedUser.username} from the thread.`);
      } catch (error) {
        console.error('Error kicking user:', error);
        await message.reply('❌ Failed to kick the user. Make sure I have the correct permissions.');
      }
      break;

    case 'stop':
      console.log('Stopping at', Date.now());
      const channelId = message.channel.id;
      const quiz = quizzes[channelId];

      if (!quiz) {
        return message.reply("❌ There's no ongoing game to stop in this channel.");
      }

      const currentLoc = locs[channelId][quiz.mapName][0];
      if (!quiz.saveStreaks) {
        delete locs[channelId][quiz.mapName];
        delete quizzes[channelId];
        await message.channel.send('Streaks not saved - not an official map.');
      } else delete quizzes[channelId];

      const stopEmbed = new EmbedBuilder()
        .setTitle('🛑 Game Stopped')
        .setDescription(`The current game has been stopped manually.`)
        .addFields(
          { name: 'Final Streak', value: `${quiz.multi.streak}`, inline: true },
        )
        .setColor('#f39c12')
      
      if (currentLoc && currentLoc.location) {
        stopEmbed.addFields(
          { name: 'Country', value: currentLoc.country || 'Unknown country'},
          { name: 'Subdivision', value: currentLoc.subdivision || 'Unknown subdivision' },
          {
            name: "Exact Location",
            value: `[View on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${currentLoc.location.lat},${currentLoc.location.lng}&heading=0&pitch=0)`
          }
        );
      }

      await message.reply({ embeds: [stopEmbed] });
      break;

    case 'g':
      await handleGuess(message, args.join(' ').trim());
      break;

    case 'play':
      if (quizzes[message.channel.id]) {
        await message.reply("There's already an active quiz. Solve it first or wait for it to complete!");
        return;
      }
      const mapName = args.length > 0 ? args.join(' ').trim() : null;

      await newLoc(message.channel, quizId, mapName);
      break;

    case 'maps':
      await message.reply({ embeds: [availableMapsEmbed()] });
      break;

    case 'help':
      const prefix = getPrefix(message);
      const helpEmbed = new EmbedBuilder()
        .setTitle('Bot Commands')
        .setDescription('Here are the available commands:')
        .addFields(
          { name: `${prefix}help`, value: 'Show the help message' },
          { name: `${prefix}play`, value: 'Start a new quiz with a random map' },
          { name: `${prefix}play <map>`, value: 'Start a new quiz with the specified map' },
          { name: `${prefix}g <country>`, value: 'Submit your guess for the current quiz' },
          { name: `${prefix}maps`, value: 'Show all available maps' },
          { name: `${prefix}map <map>`, value: 'Show alias and distribution for a map' },
          { name: `${prefix}invite <@user>`, value: 'Invite a user to your private thread *(only works in threads)*' },
          { name: `${prefix}kick <@user>`, value: 'Kick a user from your private thread *(only works in threads)*' },
          { name: `/stats <type> <@user>`, value: 'Show the personal stats for a user (solo or multi)' },
          { name: `/leaderboard <type> <map>`, value: 'Show the leaderboard for a map (solo or multi)' },
          { name: `/userlb <type> <sort>`, value: 'Show the overall user leaderboard (solo or multi), sorted by total rank or streak.' }
        )
        .setColor('#3498db');
      await message.reply({ embeds: [helpEmbed] });
      break;
    
    case 'map':
      if (args.length === 0) {
        await message.reply({ content: 'Please specify a map.', embeds: [availableMapsEmbed()] });
        return;
      }
      const map = mapAliases[args.join(' ').trim().toLowerCase()];
      if (!map) {
        await message.reply({ content: `Map "${map}" not found.`, embeds: [availableMapsEmbed()] });
        return;
      }

      const aliasesString = mapData[map].aliases.join('\n');
      let embed = new EmbedBuilder()
        .setTitle(`${map} - Info`)
        .addFields(
          { name: 'Aliases', value: aliasesString, inline: true },
          { name: 'Type', value: mapData[map].type, inline: true }
        )
        .setColor(0x2ecc71);

      const imageName = mapData[map].distribution;
      if (!imageName) {
        await message.reply({ embeds: [embed]});
        return;
      }
      const imagePath = path.join(__dirname, "../assets/images", imageName);
      if (fs.existsSync(imagePath)) {
        const imageFile = new AttachmentBuilder(imagePath);
        embed.setImage(`attachment://${imageName}`);
        await message.reply({ embeds: [embed], files: [imageFile] });
      } else {
        await message.reply({ embeds: [embed]});
      }

      break;
    
    case 'reload':
      await newLoc(message.channel, quizId, null, true);
      break;
  }
}

// Handles all comands of admins
async function handleAdminCommands(message) {
  const content = message.content.trim().toLowerCase();
  let [command, ...args] = content.split(' ');
  if (command.startsWith(getPrefix(message))) command = command.slice(1);
  else return;

  const createQuizId = getCreateQuizId(message);
  switch (command) {
    case 'private_msg':
      await sendPrivateMessageOffer(createQuizId);
      await message.reply('Private thread creation message sent to the quiz channel!');
      break;

    case 'help':
      const prefix = getPrefix(message);
      const helpEmbed = new EmbedBuilder()
        .setTitle("Administrator bot commands")
        .setDescription("Here are all the available admin commands")
        .addFields(
          { name: `${prefix}help`, value: 'Show the admin help message' },
          { name: `${prefix}private_msg`, value: "Create an announcement message to create private quizzes" },
          { name: `${prefix}refresh_userlb`, value: "Refreshes userlb, in case something goes wrong"},
          { name: `/setup <create_quiz_channel> <quiz_channel> <admin_channel>`, value: "Creates recommended channels for StreakBot"},
          { name: `/create-channels`, value: "Sets up StreakBot channels"},
          { name: `/add-map <name> <aliases> [distribution]`, value: "Adds a map to the officially supported maps"},
          { name: `/delete-map`, value: "Deletes a map from the officially supported maps"}
        )
        .setColor('#3498db');
      await message.reply({ embeds: [helpEmbed] });
      break;
    
    case 'refresh_userlb':
      refreshUserLb();
      break;
  }
}

// Listens to any potential command
export async function handleMessage(message) {
  if (message.author.bot) return;
  if (message.channel.id === getAdminId(message)) handleAdminCommands(message);
  else if (isQuizChannel(message.channel)) handlePlayerCommands(message);
};