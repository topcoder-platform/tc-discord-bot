import { ShardingManager } from 'discord.js';
import { intersection } from 'lodash';
import db from '../models/db';
import { getRatingLevel, RATINGS_ROLES_MAP } from '../models/tc-models';
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

    // get all members for the server
    const members: any = await this.shardManager.broadcastEval(
      async (client, context) => {
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
                const guild = await client.guilds.fetch(context.serverID)
                const member = await guild.members.fetch(context.memberID);

                // 1. Check if matching tc -> discord
                if (context.tcHandle !== (member.nickname || member.user.username)) {
                  // member renamed him/herself
                  // force rename back to tcHandle
                  await member.setNickname(context.tcHandle);
                  try {
                    await member.send(`Hey @${member.user.username}, our server has detected that you have changed your nickname. In order for other community members to know who they are talking to, we require everyone to use their Topcoder handle as their Discord nickname. Great thing is, there is no action required from you! We have taken the liberty to switch your nickname back to your Topcoder handle. Thank you for your understanding and if you have any questions please feel free to open a ticket.`);
                  } catch (e) { console.log(e); }
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
          } else {
            // member has verified role but is not in the DB
            // we need to remove verified roles to force re-verify
            // eval member's state and apply housekeeping logic
            await this.shardManager.broadcastEval(
              async (client, context) => {
                const guild = await client.guilds.fetch(context.serverID)
                const member = await guild.members.fetch(context.memberID);

                // 1. Remove verified roles and add guest
                // only if not Admin or CM type of member
                if (![context.roleCM, context.roleADMIN].some(r => member.roles.cache.has(r))) {
                  await member.roles.remove(context.removeRoles);
                  await member.roles.add(context.guestRole);
                }
              },
              {
                context: {
                  serverID: Env.serverID,
                  memberID: userId,
                  removeRoles,
                  guestRole: Env.guestRoleID,
                  roleCM: Env.configRoleIDs.CM_ROLE,
                  roleADMIN: Env.configRoleIDs.ADMIN_ROLE
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
