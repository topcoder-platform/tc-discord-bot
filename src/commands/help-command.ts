import { ApplicationCommandData, CommandInteraction, PermissionString } from 'discord.js';

import { EventData } from '../models/internal-models';
import { Lang } from '../services';
import { MessageUtils } from '../utils';
import { Command } from './command';

export class HelpCommand implements Command {
    public metadata: ApplicationCommandData = {
        name: Lang.getCom('commands.help'),
        description: Lang.getRef('commandDescs.help', Lang.Default),
    };
    public requireDev = false;
    public requireGuild = false;
    public requireClientPerms: PermissionString[] = [];
    public requireUserPerms: PermissionString[] = [];

    public async execute(intr: CommandInteraction, data: EventData): Promise<void> {
        await MessageUtils.sendIntr(intr, Lang.getEmbed('displayEmbeds.help', data.lang()));
    }
}
