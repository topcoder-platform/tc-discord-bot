# Topcoder Discord Bot

**Discord bot** - A discord.js bot for Topcoder Community written with TypeScript.

## Introduction

This code was forked from https://github.com/KevinNovak/Discord-Bot-TypeScript-Template originally and modified to suit Topcoder needs.

## Commands

This bot has a few example commands which can be modified as needed.

### Help Command

A `/help` command with a bot description, list of commands, and important links.

![Help Command](https://i.imgur.com/qsxQ0fP.png)

### Test Command

A generic command, `/test`, which can be copied to create additional commands.

![Test Command](https://i.imgur.com/HxzgUO7.png)

### Info Command

An `/info` command, which shows more information and relevant links.

![Info Command](https://i.imgur.com/BQcxVFm.png)

### Dev Command

A `/dev` command, which shows detailed information that may be helpful to developers.

![Dev Command](https://i.imgur.com/KVIIVJ3.png)

### Link Command

A `/link` command, which provides relevant links (`invite`, `support`, `docs`, `vote`, `donate`).

![Misc Commands](https://i.imgur.com/FOZcKM8.png)

### Welcome Message

A welcome message is sent to the server and owner when the bot is added.

![Welcome Message](https://i.imgur.com/APzT9pp.png)

## Setup

1. Copy example config files.
    - Navigate to the `config` folder of this project.
    - Copy all files ending in `.example.json` and remove the `.example` from the copied file names.
        - Ex: `config.example.json` should be copied and renamed as `config.json`.
2. Obtain a bot token.
    - You'll need to create a new bot in your [Discord Developer Portal](https://discord.com/developers/applications/).
        - See [here](https://www.writebots.com/discord-bot-token/) for detailed instructions.
        - At the end you should have a **bot token**.
3. Modify the config file.
    - Open the `config/config.json` file.
    - You'll need to edit the following values:
        - `client.id` - Your discord bot's [user ID](https://techswift.org/2020/04/22/how-to-find-your-user-id-on-discord/).
        - `client.token` - Your discord bot's token.
4. Install packages.
    - Navigate into the downloaded source files and type `npm install`.
5. Register commands.
    - In order to use slash commands, they first [have to be registered](https://discordjs.guide/interactions/registering-slash-commands.html#registering-slash-commands).
    - Type `npm run register` to register the bot's commands.
        - Run this script any time you change a command name, structure, or add/remove commands.
        - This is so Discord knows what your commands look like.
        - It may take up to an hour for command changes to appear.

## Start Scripts

You can run the bot in 4 different modes:

1. Normal Mode
    - Type `npm start`.
    - This runs the bot directly with Node and without shards.
    - Use this mode if you don't need sharding.
2. Dev Mode
    - Type `npm start:dev`.
    - This runs the bot with [ts-node-dev](https://www.npmjs.com/package/ts-node-dev).
    - Use this mode for general development.
    - TypeScript files are compiled automatically as they are changed.
3. Shard Mode
    - Type `npm run start:shard`.
    - This runs the bot directly with Node and with sharding enabled.
    - Use this mode if you need sharding.
4. PM2 Mode
    - Run by typing `npm run start:pm2`.
    - This runs the bot using the process manager [PM2](https://pm2.keymetrics.io/).
    - Use this mode if you require the bot to always be online.
## Maintainers
For questions, proposals and ideas feel free to contact the team behind this bot:

- [@kkartunov](https://github.com/kkartunov)
- [@hokienick](https://github.com/hokienick)
