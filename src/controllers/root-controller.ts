import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/rest/v9';
import { ShardingManager } from 'discord.js';
import { Request, Response, Router } from 'express';
import router from 'express-promise-router';
import jwt from 'jsonwebtoken';
import { intersection } from 'lodash';
import fetch from 'node-fetch';
import qs from 'qs';
import { middleware } from 'tc-core-library-js';
import {
    Command,
    DevCommand,
    HandleCheckCommand,
    HelpCommand,
    InfoCommand,
    JokeCommand,
    LeaderboardCommand,
    LinkCommand,
    TranslateCommand,
    VerifyCommand,
} from '../commands';
import db from '../models/db';
import { member } from '../models/db/members';
import { Env, Logger, verifyToken } from '../services';
import { Controller } from './controller';

const Config = require('../../config/config.json');
const authenticator = middleware.jwtAuthenticator;
const authenticatorOptions = { AUTH_SECRET: Env.authSecret, VALID_ISSUERS: Env.validIssuers };

export class RootController implements Controller {
    public path = '/v5/discord-bot';
    public router: Router = router();

    constructor(private shardManager: ShardingManager) { }

    public register(): void {
        this.router.get('/health', (req, res) => this.get(req, res)); // health check
        this.router.post('/webhooks/thrive', (req, res) => this.thriveWebhook(req, res));
        this.router.get('/webhooks/verify-user', (req, res) => this.verifyUser(req, res));
        this.router.get('/register-commands', (req, res, next) => authenticator(authenticatorOptions)(req, res, next), (req, res) => this.registerCommands(req, res));
        this.router.post('/members', (req, res, next) => authenticator(authenticatorOptions)(req, res, next), (req, res) => this.getMembers(req, res));
    }

    private async get(req: Request, res: Response): Promise<void> {
        res.status(200).json({ name: 'Discord Bot Cluster API', author: 'Kiril Kartunov' });
    }

    /**
     * Thrive webhook listener
     * Acts upon Contentful webhooks
     */
    private async thriveWebhook(req: Request, res: Response): Promise<void> {
        if (req.body.sys.revision === 1) {
            await fetch(Env.discordThriveWebhook, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: `Hey, we have published a new article on Thrive. Have a look at it https://www.topcoder.com/thrive/articles/${req.body.fields.slug['en-US']}?${qs.stringify({ ...Config.UTMs, 'utm_campaign': 'thrive-articles' })}`
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
            // verfy token comes from TC 4real
            verifyToken(token, Env.validIssuers, async (err: any, decodedToken: any) => {
                if (err) {
                    res.status(400).send(`Bad Request: ${err}`);
                    return;
                } else {
                    const resOps = await this.shardManager.broadcastEval(
                        async (client, context) => {
                            const guild = client.guilds.cache.get(context.serverID);
                            if (!guild) return { success: false, error: `Can\'t find any guild with the ID: ${context.serverID}` };
                            const member = await guild.members.fetch(context.userId);
                            const isValidTC = (member.nickname || member.user.username).toLowerCase() === context.decodedToken.nickname.toLowerCase();
                            const userMsg = `Hey @${member.user.username}, thank You for verifying with your TC account!${!isValidTC ? `

Please rename your server nickname to your Topcoder handle.
In order to do that, click the dropdown arrow ⬇next to "Topcoder" in the top-left of your screen and click "Edit Server Profile". There you can change your nickname and your photo (if you wish).` : ''}`;
                            // Set member nickname to TC handle
                            await member.setNickname(context.decodedToken.nickname);
                            // member roles
                            if (member && member.roles.cache.has(context.roleId)) {
                                await member.send(userMsg);
                                return { success: true, member };
                            } else if (member) {
                                await member.roles.add([context.roleId]);
                                if (member.roles.cache.has(context.guestRoleId)) {
                                    await member.roles.remove(context.guestRoleId);
                                }
                                await member.send(userMsg);
                                return { success: true, member };
                            } else {
                                return { success: false, erorr: 'can not find member by ID' };
                            }
                        },
                        {
                            context: {
                                serverID: Env.serverID,
                                userId: decodedDiscord.data.userId,
                                roleId: Env.verifyRoleID,
                                guestRoleId: Env.guestRoleID,
                                decodedToken
                            }
                        }
                    );
                    if (resOps[0].success) {
                        // User verify success
                        // Store in db
                        const m: any = resOps[0].member;
                        const isValidTC = (m.nickname || m.user.username).toLowerCase() === decodedToken.nickname.toLowerCase();
                        const newVerifiedMember = await db.Member.create({
                            id: m.user.id,
                            username: m.user.username,
                            discriminator: m.user.discriminator,
                            nickname: m.nickname,
                            tcHandle: decodedToken.nickname,
                            verifiedDate: new Date(),
                            discordValidTC: isValidTC
                        })
                        // finally redirect user back to discrod
                        res.redirect(Env.verifySuccessRedirect);
                    } else res.json(resOps);
                }
            });
        } catch (e) {
            res.status(500).json(e);
            throw e;
        }
    }

    /** Register discord commands when this endpoint is called */
    private async registerCommands(req: any, res: Response): Promise<void> {
        // check permissions to do this op
        if (!intersection(req.authUser.roles, Config.DiscordManagePermissionRoles).length) {
            res.status(403).json({ error: 'Missing needed roles for this op.' })
            return;
        }
        // Commands
        let commands: Command[] = [
            new DevCommand(),
            new HelpCommand(),
            new InfoCommand(),
            new LinkCommand(),
            new TranslateCommand(),
            new JokeCommand(),
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
            res.status(403).json({ error: 'Missing needed roles for this op.' })
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
