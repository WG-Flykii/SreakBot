import { REST, Routes } from 'discord.js';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    
    try {
        const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.json'));
        
        await Promise.all(commandFiles.map(async file => {
            const filePath = path.join(commandsPath, file);
            const data = await readFile(filePath, 'utf8');
            const command = JSON.parse(data);
            commands.push(command);
        }));
        
        return commands;
    } catch (error) {
        console.error('Error loading command files:', error);
        throw error;
    }
}

async function registerCommands(guildId = null) {
    try {
        const commands = await loadCommands();
        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

        console.log(`Starting refresh of ${commands.length} application (/) commands.`);

        const route = guildId
            ? Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
            : Routes.applicationCommands(process.env.CLIENT_ID);

        const data = await rest.put(route, { body: commands });

        console.log(`Successfully registered ${data.length} commands.`);
        return data;
    } catch (error) {
        console.error('Command registration failed:', error);
        throw error;
    }
}

registerCommands()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));