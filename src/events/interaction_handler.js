import { MessageFlags } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { mapData, mapAliases, refreshMaps } from '../data/game/maps_data.js';

import { saveJsonFile } from '../utils/json_utils.js';
import { serverConfig, checkQuizChannel, checkAdminChannel, createPrivateThread, showLeaderboard, showPersonalStats } from '../utils/bot_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_CONFIG_PATH = path.join(__dirname, '../data/user/server_config.json');

export async function handleInteraction(interaction) {
    console.log('Interaction received:', interaction.type, interaction.customId ?? 'no customId');

  if (interaction.isButton() && interaction.customId === 'create_private_thread') {
    console.log('Button clicked:', interaction.customId);
    await createPrivateThread(interaction, interaction.user.id);
  }

  const guild = interaction.guild;
  let type, map, user;

  switch (interaction.commandName) {
    // #region -- Config --
    case 'setup':
      const createQuizId = interaction.options.getChannel('create-private-quiz-channel').id;
      const quizId = interaction.options.getChannel('quiz-channel').id;
      const adminId = interaction.options.getChannel('admin-channel').id;
      const prefix = interaction.options.getString('prefix') ?? '!';

      serverConfig[guild.id] = { createQuizId, quizId, adminId, prefix };
      saveJsonFile(SERVER_CONFIG_PATH, serverConfig);

      await interaction.reply({ content: `Finished setting up StreakBot!`, flags: MessageFlags.Ephemeral});
      break;

    case 'create-channels':
      // Create StreakBot category
      const category = await guild.channels.create({
        name: 'StreakBot',
        type: ChannelType.GuildCategory,
      });

      // Create channels under category
      const channels = ['🔐︱private-quiz', '🌎 | streakbot', '🛠️ | bot-admin'];
      for (const channel of channels) {
        await guild.channels.create({
          name: channel,
          type: ChannelType.GuildText,
          parent: category.id,
        });
      }

      await interaction.reply({ content: `Finished setting up channels!`, flags: MessageFlags.Ephemeral});
      break;
    // #endregion
    
    // #region -- Admin --
    case 'add-map':
      if (!(await checkAdminChannel(interaction))) return;

      const addName = interaction.options.getString('name');
      const aliases = interaction.options.getString('aliases')
        .toLowerCase()
        .split(',')
        .map(item => item.trim())
        .push(addName.toLowerCase());
      const distribution = interaction.options.getAttachment('distribution');

      if (distribution) {
        const imagePath = path.join(__dirname, 'assets/images', distribution.name);
        mapData[addName] = { aliases: aliases, distribution: distribution.name };

        // Download and save the attachment
        try {
          const response = await axios.get(distribution.url, { responseType: 'stream' });
          const writeStream = fs.createWriteStream(imagePath);
          response.data.pipe(writeStream);

          await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });
        } catch (error) {
          console.error('Error saving distribution image:', error);
          throw error;
        }
      } else {
        mapData[addName] = { aliases: aliases };
      }

      saveJsonFile(path.join(__dirname, 'data/game/maps_data.json'), mapData);
      refreshMaps();

      await interaction.reply({ content: `Finished adding map "${addName}"!`});
      break;

    case 'delete-map':
      if (!(await checkAdminChannel(interaction))) return;

      const deleteName = mapAliases[interaction.options.getString('name')];
      if (!(deleteName in mapData)) {
        interaction.reply(`No map found named "${deleteName}"`);
        return;
      }
      delete mapData[deleteName];
      saveJsonFile(path.join(__dirname, 'data/game/maps_data.json'), mapData);
      refreshMaps();

      await interaction.reply({ content: `Finished deleting map "${deleteName}"!`});
      break;
    // #endregion

    // #region -- Player --
    case 'leaderboard':
      if (!(await checkQuizChannel(interaction))) return;

      type = interaction.options.getString('type');
      map = interaction.options.getString('map');

      await showLeaderboard(interaction, map, type);
      break;
    
    case 'stats':
      if (!(await checkQuizChannel(interaction))) return;

      type = interaction.options.getString('type');
      user = interaction.options.getUser('user');

      await showPersonalStats(interaction, user, type)
      break;
    // #endregion
  }


}