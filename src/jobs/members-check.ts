import { ShardingManager } from 'discord.js';
import { intersection } from 'lodash';

import { CustomClient } from '../extensions';
import db from '../models/db';
import { Env, HttpService, Logger } from '../services';
import { Job } from './job';

let Config = require('../../config/config.json');

/** TC rating helper */
function getRatingLevel(rating: Number | string) {
  if (rating < 900) return 1;
  if (rating < 1200) return 2;
  if (rating < 1500) return 3;
  if (rating < 2200) return 4;
  if (rating < 3000) return 5;
  return 6;
}

const RATINGS_ROLES_MAP = {
  1: Env.grayRatedRoleID,
  2: Env.greenRatedRoleID,
  3: Env.blueRatedRoleID,
  4: Env.yellowRatedRoleID,
  5: Env.redRatedRoleID,
  6: Env.targetRatedRoleID
};

export class MembersCheckJob implements Job {
  public name = 'Members Check';
  public schedule: string = Config.jobs.membersCheck.schedule;
  public log: boolean = Config.jobs.membersCheck.log;

  constructor(private shardManager: ShardingManager, private httpService: HttpService) {
  }

  public async run(): Promise<void> {
    Logger.info('Running Members Check Job...');

    // get all members for the server
    const members: any = await this.shardManager.broadcastEval(
      async (client, context) => {
        const customClient = client as CustomClient;
        const guild = await client.guilds.fetch(context.serverID)
        const members = await guild.members.fetch();
        return [...members.filter((g: any) => !g.user.bot).values()];
      },
      {
        context: {
          serverID: Env.serverID,
        }
      }
    );

    Logger.info(`Found ${members[0].length} members in the server processing...`);

    // prepare roles for working
    const removeRoles = Env.removeRoleIDs.split(',');

    // THE LOOP
    // iterate over ALL members in the server
    for (const m of members[0]) {
      // process only VERIFIED members
      if (intersection(m._roles, removeRoles)) {
        const userId = m.user.id;
        try {
          // get member record from db
          const dbM = await db.Member.findByPk(userId);
          if (dbM) {
            // there is record for this member in our db
            // get member info from TC members API
            const tcAPI = await this.httpService.get(
              `https://api.topcoder${Env.nodeEnv === 'development' ? '-dev' : ''}.com/v5/members/${dbM.tcHandle}`,
              ''
            ).then(r => r.json());
            // prepare rating role that should be set to this member
            // set all to gray rated by default
            let ratingRole = Env.grayRatedRoleID;
            if (tcAPI.maxRating && tcAPI.maxRating.rating) {
              // sometimes no rating available from TC API
              ratingRole = RATINGS_ROLES_MAP[getRatingLevel(tcAPI.maxRating.rating)];
            }
            // eval member's state and apply housekeeping logic
            await this.shardManager.broadcastEval(
              async (client, context) => {
                const customClient = client as CustomClient;
                const guild = await client.guilds.fetch(context.serverID)
                const member = await guild.members.fetch(context.memberID);

                // 1. Check if matching tc -> discord
                if (context.tcHandle !== (member.nickname || member.user.username)) {
                  // member renamed him/herself
                  // Takeaway verified roles
                  await member.roles.remove(context.removeRoles);
                  await member.send(`Hey @${member.user.username}, we have detected that your discord does not match with your TC handle and therefore have removed your verified role.`);
                }
                // 2. Check for TC rating updates/misses
                if (!member.roles.cache.has(context.ratingRole)) {
                  await member.roles.remove([
                    context.grayRatedRoleID, context.greenRatedRoleID, context.blueRatedRoleID,
                    context.yellowRatedRoleID, context.redRatedRoleID, context.targetRatedRoleID
                  ]);
                  await member.roles.add(context.ratingRole);
                }
              },
              {
                context: {
                  serverID: Env.serverID,
                  memberID: userId,
                  removeRoles,
                  tcHandle: dbM.tcHandle,
                  ratingRole,
                  grayRatedRoleID: Env.grayRatedRoleID,
                  greenRatedRoleID: Env.greenRatedRoleID,
                  blueRatedRoleID: Env.blueRatedRoleID,
                  yellowRatedRoleID: Env.yellowRatedRoleID,
                  redRatedRoleID: Env.redRatedRoleID,
                  targetRatedRoleID: Env.targetRatedRoleID
                }
              }
            );
          }
        } catch (e) {
          Logger.error('In The LOOP error', e);
        }
      }
    }

    Logger.info(
      'Ran Members Check job and finished okay',
    );
  }
}
