import { ShardingManager } from 'discord.js';
import 'reflect-metadata';

import { Api } from './api';
import { GuildsController, RootController, ShardsController } from './controllers';
import { MembersCheckJob, UpdateServerCountJob } from './jobs';
import { Manager } from './manager';
import db from './models/db';
import { Env, HttpService, JobService, Logger, MasterApiService } from './services';
import { MathUtils, ShardUtils } from './utils';

let Config = require('../config/config.json');
let Debug = require('../config/debug.json');
let Logs = require('../lang/logs.json');

async function start(): Promise<void> {
    Logger.info(Logs.info.appStarted);

    // DB
    await db.sequelize.sync();
    Logger.info('DB models were synchronized successfully.');

    // Dependencies
    let httpService = new HttpService();
    let masterApiService = new MasterApiService(httpService);
    if (Config.clustering.enabled) {
        await masterApiService.register();
    }

    // Sharding
    let shardList: number[];
    let totalShards: number;
    try {
        if (Config.clustering.enabled) {
            let resBody = await masterApiService.login();
            shardList = resBody.shardList;
            let requiredShards = await ShardUtils.requiredShardCount(Env.token);
            totalShards = Math.max(requiredShards, resBody.totalShards);
        } else {
            let recommendedShards = await ShardUtils.recommendedShardCount(
                Env.token,
                Config.sharding.serversPerShard
            );
            shardList = MathUtils.range(0, recommendedShards);
            totalShards = recommendedShards;
        }
    } catch (error) {
        Logger.error(Logs.error.retrieveShards, error);
        return;
    }

    if (shardList.length === 0) {
        Logger.warn(Logs.warn.managerNoShards);
        return;
    }

    let shardManager = new ShardingManager('dist/start.js', {
        token: Env.token,
        mode: Debug.override.shardMode.enabled ? Debug.override.shardMode.value : 'worker',
        respawn: true,
        totalShards,
        shardList,
    });

    // Jobs
    let jobs = [
        Config.clustering.enabled ? undefined : new UpdateServerCountJob(shardManager, httpService),
        // new MembersCheckJob(shardManager, httpService) will enable later...
    ].filter(Boolean);
    let jobService = new JobService(jobs);

    let manager = new Manager(shardManager, jobService);

    // API
    let guildsController = new GuildsController(shardManager);
    let shardsController = new ShardsController(shardManager);
    let rootController = new RootController(shardManager);
    let api = new Api([guildsController, shardsController, rootController]);

    // Start
    await manager.start();
    await api.start();
    if (Config.clustering.enabled) {
        await masterApiService.ready();
    }
}

process.on('unhandledRejection', (reason, promise) => {
    Logger.error(Logs.error.unhandledRejection, reason);
});

start().catch(error => {
    Logger.error(Logs.error.unspecified, error);
});
