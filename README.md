# 🌍 **StreakBot**

Made by **Flykii (@flykii)** and **Beans (@cansinabean)** for the [WorldGuessr Discord](https://discord.gg/nfebQwes6a)
Play Worldguessr at https://worldguessr.com.
Feel free to use it on your own server!

Test your geography knowledge with country streak challenges based on real Street View locations!  
Compete solo or with friends, track your best streaks, and climb the leaderboard.

<img src="./assets/images/right_answer_screenshot.png" width="30%">
<img src="./assets/images/wrong_answer_screenshot.png" width="30%">

---
## 🕹️ **Available Commands**
Note that most commands are text-based for speed, but admin commands often use slash commands for complex interactions and to hide actions from players. The default prefix is `!`, but you may change this.

### **Players**
| Command | Description |
| ------- | ----------- |
| `!help` | Show the help message ,
| `!play` | Start a new quiz with a random map ,
| `!play <map>` | Start a new quiz with the specified map ,
| `!g <country>` | Submit your guess for the current quiz ,
| `!maps` | Show all available maps ,
| `!map <map>` | Show alias and distribution for a map ,
| `!invite <@user>` | Invite a user to your private thread *(only works in threads)* ,
| `!kick <@user>` | Kick a user from your private thread *(only works in threads)* ,
| `/stats <type> <@user>` | Show the personal stats for a user (solo or multi) ,
| `/leaderboard <type> <map>` | Show the leaderboard for a map (solo or multi) ,
| `/userlb <type> <sort>` | Show the overall user leaderboard (solo or multi), sorted by total rank or streak.

### **Admins**
| Command | Description |
| ------- | ----------- |
| `!help` | Show the admin help message ,
| `!private_msg` | Create an announcement message to create private quizzes ,
| `!refresh_userlb` | Refreshes userlb, in case something goes wrong,
| `/setup <create_quiz_channel> <quiz_channel> <admin_channel>` | Creates recommended channels for StreakBot,
| `/create-channels` | Sets up StreakBot channels,
| `/add-map <name> <aliases> [distribution]` | Adds a map to the officially supported maps,
| `/delete-map <name>` | Deletes a map from the officially supported maps

---
![Preview 3](./assets/images/stats_screenshot.png)

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
2. Use `/create-channels` to create the channels for the bot (optional)
3. Use `/setup` to set up the bot channels
    - `create-private-quiz-channel`: The channel where the "Create Private Thread" button will be posted
    ![Create Quiz Channel](./assets/images/announcement_screenshot.png)
    - `quiz-channel`: The main channel where quizzes are played and where threads will be created
    ![Quiz Channel](./assets/images/quiz_channel_screenshot.png)
    - `admin-channel`: The channel where admins can control the bot
    ![Admin Channel](./assets/images/admin_channel_screenshot.png)

---
## **Development**
1. Run `npm install`.
2. Register slash commands with `node src/register_commands.js`. Note that this does not need to be run often, so it is in a separate file.
3. Run `node src/streakbot.js` to start the bot. If you want hot reload with nodemon, use `npm run dev`.
