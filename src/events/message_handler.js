import { MessageFlags, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { maps, mapAliases, mapImages } from '../data/game/maps_data.js';

import { getCreateQuizId, getQuizId, getAdminId, quizzesByChannel, isQuizChannel, newLoc, handleGuess, showLeaderboard, showPersonalStats, sendPrivateMessageOffer } from '../utils/bot_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handles all commands of players
async function handlePlayerCommands(message) {
  const content = message.content.trim().toLowerCase();
  const [command, ...args] = content.split(' ');
  const quizId = getQuizId(message);
  const mapNames = Object.keys(maps);
  let mentionedUser;
  switch (command) {
    case '!invite':
      if (message.mentions.users.size === 0) return;
      mentionedUser = message.mentions.users.first();

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

    case '!kick':
      if (message.mentions.users.size === 0) return;

      mentionedUser = message.mentions.users.first();

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

    case '!stop':
      const channelId = message.channel.id;
      const quiz = quizzesByChannel[channelId];
      console.log(quiz);

      if (!quiz || quiz.solved) {
        return message.reply("❌ There's no ongoing game to stop in this channel.");
      }

      quiz.solved = true;

      const stopEmbed = new EmbedBuilder()
        .setTitle('🛑 Game Stopped')
        .setDescription(`The current game has been stopped manually.`)
        .addFields(
          { name: 'Final Streak', value: `${quiz.multi.currentStreak}`, inline: true },
        )
        .setColor('#f39c12')
      
      if (quiz.location) {
        stopEmbed.addFields(
          {
            name: "Exact Location",
            value: `[View on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${quiz.location.lat},${quiz.location.lng}&heading=0&pitch=0)`
          }
        );
      } else {
        stopEmbed.addFields(
          {
            name: "Exact Location",
            value: "Location has not been loaded."
          }
        );
      }

      await message.reply({ embeds: [stopEmbed] });
      break;

    case '!g':
      await handleGuess(message, args.join(' '));
      break;

    case '!play':
      if (quizzesByChannel[message.channel.id] && !quizzesByChannel[message.channel.id].solved) {
        await message.reply("There's already an active quiz. Solve it first or wait for it to complete!");
        return;
      }
      const mapName = args.length > 0 ? args.join(' ') : null;

      await newLoc(message.channel, quizId, mapName, message.author.id);
      break;

    case '!maps':
      const mapsEmbed = new EmbedBuilder()
        .setTitle('Available Maps')
        .setDescription(mapNames.join('\n'))
        .setColor('#3498db');

      await message.channel.send({ embeds: [mapsEmbed] });
      break;

    case '!help':
      const helpEmbed = new EmbedBuilder()
        .setTitle('Bot Commands')
        .setDescription('Here are the available commands:')
        .addFields(
          { name: '!help', value: 'Show the help message' },
          { name: '!play', value: 'Start a new quiz with a random map' },
          { name: '!play <map>', value: 'Start a new quiz with the specified map' },
          { name: '!g <country>', value: 'Submit your guess for the current quiz' },
          { name: '!maps', value: 'Show all available maps' },
          { name: '!stats', value: 'Show your personal stats and records' },
          { name: '!invite <@user>', value: 'Invite a user to your private thread *(only works in threads)*' },
          { name: '!kick <@user>', value: 'Kick a user from your private thread *(only works in threads)*' }
        )
        .setColor('#3498db');
      await message.channel.send({ embeds: [helpEmbed] });
      break;

    case '!map':
    case '!locs':
    case '!locations':
    case '!distribution':
      const mapImage = mapImages[args.join(' ')];

      if (!mapImage) {
        return message.reply("Unknown map. Try `abe`, `abaf`, or full names like `a balanced europe`.");
      }

      const imagePath = path.join(__dirname, "../assets/images", mapImage);

      if (!fs.existsSync(imagePath)) {
        return message.reply("Image file not found.");
      }

      const file = new AttachmentBuilder(imagePath);
      const embed = new EmbedBuilder()
        .setTitle(`${mapAliases[args.join(' ')]} - Distribution`)
        .setImage(`attachment://${mapImage}`)
        .setColor(0x2ecc71);

      await message.channel.send({ embeds: [embed], files: [file] });
      break;
  }
}

// Handles all comands of admins
async function handleAdminCommands(message) {
  const content = message.content.trim().toLowerCase();
  const [command, ...args] = content.split(' ');
  const createQuizId = getCreateQuizId(message);
  switch (command) {
    case '!private_msg':
      await sendPrivateMessageOffer(createQuizId);
      await message.reply('Private thread creation message sent to the quiz channel!');
      break;

    case '!help':
      const helpEmbed = new EmbedBuilder()
        .setTitle("Administrator bot commands")
        .setDescription("Here are all the available admin commands")
        .addFields(
          { name: '!help', value: 'Show the admin help message' },
          { name: '!private_msg', value: "Create an announcement message to create private quizzes" }
        )
        .setColor('#3498db');
      await message.channel.send({ embeds: [helpEmbed] });
      break;
  }
}

// Listens to any potential command
export async function handleMessage(message) {
  if (message.author.bot) return;
  if (message.channel.id === getAdminId(message)) handleAdminCommands(message);
  else if (isQuizChannel(message.channel, getQuizId(message))) handlePlayerCommands(message);
};