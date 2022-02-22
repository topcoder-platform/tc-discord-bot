import { ShardingManager } from 'discord.js';
import { connect, model } from 'mongoose';

import { CustomClient } from '../extensions';
import { DiscordUser, MemberSchema } from '../models/mongo/Members';
import { Env, HttpService, Logger } from '../services';
import { Job } from './job';

let Config = require('../../config/config.json');

// MongoDB setup
let connectedToDB = false;
const DiscordUserModel = model<DiscordUser>('DiscordUser', MemberSchema);
async function mongoConnect(): Promise<void> {
    // 4. Connect to MongoDB
    await connect(`mongodb+srv://${Env.mongoUser}:${Env.mongoPass}@cluster0.f2qmf.mongodb.net/${Env.mongoDB}?retryWrites=true&w=majority`);
    Logger.info('Connected to MongoDb');
    connectedToDB = true;
}
mongoConnect().catch(err => Logger.error('MongoDb connect error', err));

export class MembersCheckJob implements Job {
    public name = 'Members Check';
    public schedule: string = Config.jobs.membersCheck.schedule;
    public log: boolean = Config.jobs.membersCheck.log;

    constructor(private shardManager: ShardingManager, private httpService: HttpService) {
    }

    public async run(): Promise<void> {
        Logger.info('Running Members Check Job...');
        if (!connectedToDB) {
            Logger.info('can\'t perform Members Check without connection to db!');
            return;
        }

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
                const uM = await DiscordUserModel.findOneAndUpdate(
                    { discordID: m.user.id },
                    { nickname: m.nickname, username: m.user.username, discriminator: m.user.discriminator },
                    { new: true, upsert: true }
                )
                if (!uM.checkHandle || uM.checkHandle !== (m.nickname || m.user.username)) {
                    const apiRsp = await this.httpService.get(`https://api.topcoder.com/v5/members/${(m.nickname || m.user.username)}`, '');
                    const apiData = await apiRsp.json();
                    uM.checkHandle = m.nickname || m.user.username;
                    uM.checkValid = apiRsp.status === 200;
                    // if (apiRsp.status === 200 && !uM.tcHandle) {
                    //     uM.tcHandle = apiData.handle;
                    //     uM.verifyDate = new Date();
                    // }
                    await uM.save();
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
