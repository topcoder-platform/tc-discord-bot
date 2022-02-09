import { ApplicationCommandOptionType } from 'discord-api-types';
import {
    ApplicationCommandData,
    CommandInteraction,
    MessageEmbed,
    PermissionString,
} from 'discord.js';
import qs from 'qs';

import { EventData } from '../models/internal-models';
import { Env } from '../services/env';
import { HttpService } from '../services/http-service';
import { MessageUtils } from '../utils';
import { Command } from './command';
let Config = require('../../config/config.json');

export class HandleCheckCommand implements Command {
    public metadata: ApplicationCommandData = {
        name: 'handle',
        description: 'Check discord username if it is valid TC handle.',
        options: [
            {
                name: 'username',
                description: 'Discord username to check.',
                required: true,
                type: ApplicationCommandOptionType.String.valueOf(),
            },
        ],
    };
    public requireDev = false;
    public requireGuild = false;
    public requireClientPerms: PermissionString[] = [];
    public requireUserPerms: PermissionString[] = [];

    public async execute(intr: CommandInteraction, data: EventData): Promise<void> {
        const channelId = intr.channelId;
        if (channelId !== '939234143785590805') {
            await MessageUtils.sendIntr(intr, 'This is an admin command.');
            return;
        }

        let username = intr.options.getString('username');
        const https = new HttpService();
        const apiRsp = await https.get(`https://api.topcoder.com/v5/members/${username}`, '');
        const apiData = await apiRsp.json();

        if (apiRsp.status !== 200) {
            await MessageUtils.sendIntr(intr, apiData.message || `Username ${username} doesn't exist for Topcoder!`);
        } else {
            await MessageUtils.sendIntr(intr, `SUCCESS!
Username "${username}" is valid Topcoder handle.
Current status: ${apiData.status}`);
        }
    }
}
