// Originally made by Flykii (@flykii on Discord) for the Worldguessr Discord. Join at https://discord.gg/nfebQwes6a !

import { Client, GatewayIntentBits, Partials } from 'discord.js';

import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN; // Token for the discord bot

import { botStart } from './utils/bot_utils.js';
import { handleMessage } from './events/message_handler.js';
import { handleInteraction } from './events/interaction_handler.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once('ready', async () => await botStart());

client.on('interactionCreate', async (interaction) => await handleInteraction(interaction));

client.on('messageCreate', async (message) => await handleMessage(message));

client.login(BOT_TOKEN);