import { ApplicationCommandData, CommandInteraction, PermissionString } from 'discord.js';
import { getRandomJoke } from 'one-liner-joke';

import { EventData } from '../models/internal-models';
import { Lang } from '../services';
import { MessageUtils } from '../utils';
import { Command } from './command';

export class JokeCommand implements Command {
    public metadata: ApplicationCommandData = {
        name: Lang.getCom('commands.joke'),
        description: Lang.getRef('commandDescs.joke', Lang.Default),
    };
    public requireDev = false;
    public requireGuild = false;
    public requireClientPerms: PermissionString[] = [];
    public requireUserPerms: PermissionString[] = [];

    public async execute(intr: CommandInteraction, data: EventData): Promise<void> {
        await MessageUtils.sendIntr(intr, Lang.getEmbed('displayEmbeds.joke', data.lang(), {
            JOKE: getRandomJoke().body
        }));
    }
}
