import { ApplicationCommandData, CommandInteraction, MessageEmbed, PermissionString } from 'discord.js';
import jwt from 'jsonwebtoken';
import qs from 'qs';

import { EventData } from '../models/internal-models';
import { Env } from '../services/env';
import { MessageUtils } from '../utils';
import { Command } from './command';
let Config = require('../../config/config.json');

export class VerifyCommand implements Command {
    public metadata: ApplicationCommandData = {
        name: 'verify',
        description: 'Verify that you are Topcoder member and earn Grey Rated role.'
    };
    public ephemeral = true;
    public requireDev = false;
    public requireGuild = false;
    public requireClientPerms: PermissionString[] = [];
    public requireUserPerms: PermissionString[] = [];

    public async execute(intr: CommandInteraction, data: EventData): Promise<void> {
        const token = jwt.sign({
            exp: Math.floor(Date.now() / 1000) + (60 * 5), // 5min
            data: {
                userId: intr.user.id
            }
        }, Env.token);
        const retUrl = encodeURIComponent(`${Env.discordVerifyUserWebhook}?discord=${token}`);
        const embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('CLICK HERE TO VERIFY')
            .setURL(`https://accounts-auth0.topcoder.com/member/registration?retUrl=${retUrl}&mode=signIn&${qs.stringify({ ...Config.UTMs, 'utm_campaign': 'verify-members' })}`)
            .setDescription('You will be sent to Topcoder authentication page where you need to either login or register. Once done, we will send you back to discord and complete the verification process.');

        await MessageUtils.sendIntr(intr, embed);
    }
}
