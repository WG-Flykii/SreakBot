# 🌍 **StreakBot**

Made by **Flykii** for the [WorldGuessr Discord](https://discord.gg/nfebQwes6a)  
Play Worldguessr at https://worldguessr.com
Feel free to use it on your own server!

Test your geography knowledge with country streak challenges based on real Street View locations!  
Compete solo or with friends, track your best streaks, and climb the leaderboard.

<img src="./images/right_answer_screenshot.png" width="30%">
<img src="./images/wrong_answer_screenshot.png" width="30%">

---
## 🕹️ **Available Commands**
### **Players**
| Command | Description |
| ------- | ----------- |
| `!help` | Show the help message |
| `!play` | Start a new quiz with a random map |
| `!play <map>` | Start a new quiz with the specified map |
| `!g <country>` | Submit your guess for the current quiz |
| `!maps` | Show all available maps |
| `!stats` | Show your personal stats and records |
| `!leaderboard <map>` | Show the leaderboard for a specific map |
| `!invite @user` | Invite a user to your private thread *(only works in threads)* |

### **Admins**
| Command | Description |
| ------- | ----------- |
| `!help_admin` | Show the admin help message" |
| `!private_msg"` | "Create an announcement message to create private quizzes" |

---
![Preview 3](./images/stats_screenshot.png)

---
## **Environment**
Create an `.env` file containing variables in this format:
```js
BOT_TOKEN=
CLIENT_ID=
```
- `BOT_TOKEN`: Your Discord bot token
- `CLIENT_ID`: Identifies bot within Discord Developer portal

---
## **Setup**
1. Invite the bot to your server
2. Use `/create_channels` to create the channels for the bot (optional)
3. Use `/setup` to set up the bot channels
    - `create_quiz_channel`: The channel where the "Create Private Thread" button will be posted
    ![Create Quiz Channel](./images/announcement_screenshot.png)
    - `quiz_channel`: The main channel where quizzes are played and where threads will be created
    ![Quiz Channel](./images/quiz_channel_screenshot.png)
    - `admin_channel`: The channel where admins can control the bot
    ![Admin Channel](./images/admin_channel_screenshot.png)

---
## **Development**
1. Run `npm install`.
2. Register slash commands with `node src/register_commands.js`. Note that this does not need to be run often, so it is in a separate file.
3. Run `node src/streakbot.js` to start the bot. If you want hot reload, use `npm run dev`.

---
## **Usage**
1. Invite the bot to your server.
2. Run `/create_channels` to create the channels for the bot (optional).
3. Run `/setup` to configure the bot channels.
4. Have fun with developing and playing!