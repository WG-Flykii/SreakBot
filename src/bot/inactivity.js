import { serverConfig } from '../bot/game.js';
import { client } from '../streakbot.js';

export function scheduleThreadInactivityCheck(threadId) {
  setTimeout(async () => {
    try {
      const thread = await client.channels.fetch(threadId);
      if (thread && thread.isThread() && !thread.archived) {
        const lastMessage = await thread.messages.fetch({ limit: 1 });
        const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
        const now = Date.now();
        const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

        if (hoursInactive >= 24) {
          await thread.delete(`Thread inactive for over 24h`);
          console.log(`Deleted inactive thread: ${thread.name}`);
        } else {
          scheduleThreadInactivityCheck(threadId);
        }
      }
    } catch (err) {
      console.error(`Error checking or deleting thread ${threadId}:`, err);
    }
  }, 24 * 60 * 60 * 1000);
}

export async function checkAllQuizThreadsForInactivity() {
  try {
    const quizChannels = await Promise.all(
      Array.from(serverConfig).map(async ([serverId, config]) => {
        const server = await client.guilds.fetch(serverId);
        return await server.channels.fetch(config.quizId);
      })
    );

    quizChannels.forEach(async (quizChannel) => {
      const threads = await quizChannel.threads.fetchActive();
      threads.threads.forEach(async (thread) => {
        try {
          if (thread.isThread() && !thread.archived) {
            const lastMessage = await thread.messages.fetch({ limit: 1 });
            const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
            const now = Date.now();
            const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

            if (hoursInactive >= 24) {
              await thread.delete(`Thread inactive for over 24h`);
              console.log(`Deleted inactive thread: ${thread.name}`);
            } else {
              scheduleThreadInactivityCheck(thread.id);
            }
          }
        } catch (err) {
          console.error(`Error checking thread ${thread.id}:`, err);
        }
      });

      const archivedThreads = await quizChannel.threads.fetchArchived();

      archivedThreads.threads.forEach(async (thread) => {
        try {
          const lastMessage = await thread.messages.fetch({ limit: 1 });
          const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
          const now = Date.now();
          const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

          if (hoursInactive >= 24) {
            await thread.delete(`Thread inactive for over 24h`);
            console.log(`Deleted inactive thread: ${thread.name}`);
          }
        } catch (err) {
          console.error(`Error checking archived thread ${thread.id}:`, err);
        }
      });
    });
  } catch (error) {
    console.error('Error checking all quiz threads:', error);
  }
}

export function initializeThreadCleanup() {
  checkAllQuizThreadsForInactivity();
  setInterval(() => {
    checkAllQuizThreadsForInactivity();
  }, 6 * 60 * 60 * 1000);
}