import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/rest/v9';
import { ShardingManager } from 'discord.js';
import { Request, Response, Router } from 'express';
import router from 'express-promise-router';
import jwt from 'jsonwebtoken';
import { intersection } from 'lodash';
import qs from 'qs';
import { middleware } from 'tc-core-library-js';
import {
    Command,
    DevCommand,
    HandleCheckCommand,
    HelpCommand,
    InfoCommand,
    LeaderboardCommand,
    LinkCommand,
    TranslateCommand,
    VerifyCommand,
} from '../commands';
import db from '../models/db';
import { getRatingLevel, RATINGS_ROLES_MAP } from '../models/tc-models';
import { Env, HttpService, Logger, verifyToken } from '../services';
import { Controller } from './controller';

const Config = require('../../config/config.json');
const authenticator = middleware.jwtAuthenticator;
const authenticatorOptions = { AUTH_SECRET: Env.authSecret, VALID_ISSUERS: Env.validIssuers };

export class RootController implements Controller {
    public path = '/v5/discord-bot';
    public router: Router = router();

    constructor(private shardManager: ShardingManager) {}

    public register(): void {
        this.router.get('/health', (req, res) => this.get(req, res)); // health check
        this.router.post('/webhooks/thrive', (req, res) => this.thriveWebhook(req, res));
        this.router.get('/webhooks/verify-user', (req, res) => this.verifyUser(req, res));
        this.router.get(
            '/register-commands',
            (req, res, next) => authenticator(authenticatorOptions)(req, res, next),
            (req, res) => this.registerCommands(req, res)
        );
        this.router.post(
            '/members',
            (req, res, next) => authenticator(authenticatorOptions)(req, res, next),
            (req, res) => this.getMembers(req, res)
        );
    }

    private async get(req: Request, res: Response): Promise<void> {
        res.status(200).json({ name: 'Discord Bot Cluster API', author: 'Kiril Kartunov' });
    }

    /**
     * Thrive webhook listener
     * Acts upon Contentful webhooks
     */
    private async thriveWebhook(req: Request, res: Response): Promise<void> {
        // check for valid authorization
        if (!req.headers.authorization || req.headers.authorization !== Env.serverID) {
            res.status(403).json({ error: 'Not valid authorization provided' });
            return;
        }
        if (req.body.sys.revision === 1) {
            await fetch(Env.discordThriveWebhook, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: `Hey, we have published a new article on Thrive. Have a look at it https://www.topcoder.com/thrive/articles/${req.body.fields.slug['en-US']}?${qs.stringify({ ...Config.UTMs, utm_campaign: 'thrive-articles' })}`,
                }),
            });
        }
        res.status(200).end();
    }

    /**
     * Callback webhook to verify user JWT
     * send here as return URL after login/register flow
     * if success user gets verified roles in TC discord server
     */
    private async verifyUser(req: Request, res: Response): Promise<void> {
        try {
            const discord = req.query.discord;
            const token = req.query.token;
            const decodedDiscord: any = jwt.verify(discord as string, Env.token);
            Logger.info(`verifyUser entry: ${JSON.stringify(decodedDiscord)}`);
            // verfy token comes from TC 4real
            verifyToken(token, async (err: any, decodedToken: any) => {
                if (err) {
                    Logger.error('verifyToken error:', JSON.stringify(err));
                    res.status(400).send(`Bad Request: ${err}`);
                    return;
                } else {
                    Logger.info(`verifyToken success: ${JSON.stringify(decodedToken)}`);
                    // there is record for this member in our db
                    // get member info from TC members API
                    const https = new HttpService();
                    const tcAPI: any = await https
                        .get(
                            `https://api.topcoder${Env.nodeEnv === 'development' ? '-dev' : ''}.com/v5/members/${decodedToken.nickname}`,
                            ''
                        )
                        .then(r => r.json());
                    Logger.info(`verifyToken user data: ${JSON.stringify(tcAPI)}`);
                    // prepare rating role that should be set to this member
                    // set all to gray rated by default
                    let ratingRole = Env.grayRatedRoleID;
                    if (tcAPI.maxRating && tcAPI.maxRating.rating) {
                        // sometimes no rating available from TC API
                        ratingRole = RATINGS_ROLES_MAP[getRatingLevel(tcAPI.maxRating.rating)];
                    }
                    // discord side...
                    const resOps = await this.shardManager.broadcastEval(
                        async (client, context) => {
                            try {
                                const guild = client.guilds.cache.get(context.serverID);
                                if (!guild)
                                    return {
                                        success: false,
                                        error: `Can\'t find any guild with the ID: ${context.serverID}`,
                                    };
                                const member = await guild.members.fetch(context.userId);
                                const userMsg = `Hey @${member.user.username}, thank you for verifying your Topcoder account with us!

In order for everyone in our Discord server to know who you are and so that you know who everyone else is, we have updated your Discord nickname in our server only to match your Topcoder username.  By having your Discord nickname match your Topcoder handle, you will be granted with the "Verified" role and badge, which allows you to view all of our channels.  If at any time you decide to change your nickname on our server to anything else, we will be forced to revoke your "Verified" role, in which case you will lose access to our channels and will have to reverify.

We're glad to have you join us. Welcome!`;
                                // Set member nickname to TC handle
                                await member.setNickname(context.decodedToken.nickname);
                                // member roles
                                const roles = context.roleId.split(',');
                                roles.push(context.ratingRole);
                                if (member && roles.every(r => member.roles.cache.has(r))) {
                                    try {
                                        await member.send(userMsg);
                                    } catch (e) {
                                        console.log(e);
                                    }
                                    return { success: true, member };
                                } else if (member) {
                                    await member.roles.add(roles);
                                    if (member.roles.cache.has(context.guestRoleId)) {
                                        await member.roles.remove(context.guestRoleId);
                                    }
                                    try {
                                        await member.send(userMsg);
                                    } catch (e) {
                                        console.log(e);
                                    }
                                    return { success: true, member };
                                } else {
                                    return { success: false, erorr: 'can not find member by ID' };
                                }
                            } catch (e) {
                                return { success: false, erorr: e };
                            }
                        },
                        {
                            context: {
                                serverID: Env.serverID,
                                userId: decodedDiscord.data.userId,
                                roleId: Env.verifyRoleID,
                                guestRoleId: Env.guestRoleID,
                                decodedToken,
                                ratingRole,
                            },
                        }
                    );
                    if (resOps[0].success) {
                        // User verify success
                        // Store in db
                        try {
                            const m: any = resOps[0].member;
                            const isValidTC =
                                (m.nickname || m.user.username).toLowerCase() ===
                                decodedToken.nickname.toLowerCase();
                            await db.Member.create({
                                id: m.user.id,
                                username: m.user.username,
                                discriminator: m.user.discriminator,
                                nickname: m.nickname,
                                tcHandle: decodedToken.nickname,
                                verifiedDate: new Date(),
                                discordValidTC: isValidTC,
                            });
                            // finally redirect user back to discrod
                            res.redirect(Env.verifySuccessRedirect);
                        } catch (e) {
                            res.status(500).json(e);
                        }
                    } else res.json(resOps);
                }
            });
        } catch (e) {
            Logger.error('verify user error:', JSON.stringify(e));
            res.status(500).json(e);
            throw e;
        }
    }

    /** Register discord commands when this endpoint is called */
    private async registerCommands(req: any, res: Response): Promise<void> {
        // check permissions to do this op
        if (!intersection(req.authUser.roles, Config.DiscordManagePermissionRoles).length) {
            res.status(403).json({ error: 'Missing needed roles for this op.' });
            return;
        }
        // Commands
        let commands: Command[] = [
            new DevCommand(),
            new HelpCommand(),
            new InfoCommand(),
            new LinkCommand(),
            new TranslateCommand(),
            new VerifyCommand(),
            new LeaderboardCommand(),
            new HandleCheckCommand(),
            // TODO: Add new commands here
        ].sort((a, b) => (a.metadata.name > b.metadata.name ? 1 : -1));
        let cmdDatas = commands.map(cmd => cmd.metadata);

        try {
            let rest = new REST({ version: '9' }).setToken(Env.token);
            await rest.put(Routes.applicationCommands(Env.appId), { body: [] });
            await rest.put(Routes.applicationCommands(Env.appId), { body: cmdDatas });
            Logger.info('All commands registered');
            res.status(200).json(commands);
        } catch (error) {
            Logger.error('Registering commands error:', error);
            res.status(500).json({ error });
        }
    }

    /** Get Discord Members */
    private async getMembers(req: any, res: Response): Promise<void> {
        // check permissions to do this op
        if (!intersection(req.authUser.roles, Config.DiscordManagePermissionRoles).length) {
            res.status(403).json({ error: 'Missing needed roles for this op.' });
            return;
        }
        try {
            const members = await db.Member.findAll(req.body);
            res.status(200).json(members);
        } catch (error) {
            Logger.error('getMembers error:', error);
            res.status(500).json({ error });
        }
    }
}
