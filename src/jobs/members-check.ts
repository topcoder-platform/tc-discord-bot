import { ShardingManager } from 'discord.js';

import { CustomClient } from '../extensions';
import db from '../models/db';
import { Env, HttpService, Logger } from '../services';
import { Job } from './job';

let Config = require('../../config/config.json');
export class MembersCheckJob implements Job {
    public name = 'Members Check';
    public schedule: string = Config.jobs.membersCheck.schedule;
    public log: boolean = Config.jobs.membersCheck.log;

    constructor(private shardManager: ShardingManager, private httpService: HttpService) {
    }

    public async run(): Promise<void> {
        Logger.info('Running Members Check Job...');

        const members: any = await this.shardManager.broadcastEval(
            async (client, context) => {
                const customClient = client as CustomClient;
                const guild = await client.guilds.fetch(context.serverID)
                const members = await guild.members.fetch();
                return [...members.filter(g => !g.user.bot).values()];
            },
            { context: { serverID: Env.serverID } }
        );

        Logger.info(`Found ${members[0].length} members in the server processing...`);

        for (const m of members[0]) {
            try {
                let userId = m.user.id;
                let dbM = await db.Member.findByPk(userId);
                if (dbM) {
                    // there is record in our db
                    // check if matching tc -> discord
                    if (dbM.tcHandle !== (m.nickname || m.user.username)) {
                        // member renamed him/herself
                        // take away verified roles
                        await this.shardManager.broadcastEval(
                            async (client, context) => {
                                const customClient = client as CustomClient;
                                const guild = await client.guilds.fetch(context.serverID)
                                const member = await guild.members.fetch(context.memberID);
                                const removeRoles = context.removeRoleIDs.split(',');
                                await member.roles.remove(removeRoles);
                            },
                            {
                                context: {
                                    serverID: Env.serverID,
                                    memberID: userId,
                                    removeRoleIDs: Env.removeRoleIDs
                                }
                            }
                        );
                    }
                }
            } catch (error) {
                Logger.error('Save error', error);
            }
        }

        Logger.info(
            'ran Members Check job and finished okay',
        );
    }
}
