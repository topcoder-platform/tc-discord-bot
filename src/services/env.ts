/**
 * Config service
 * used for access to env vars and etc.
 */
export const Env = {
    token: process.env.DISCORD_BOT_TOKEN ?? '',
    appId: process.env.DISCORD_APP_ID ?? '',
    botChannelId: process.env.BOT_CHANNEL_ID ?? '',
    discordThriveWebhook: process.env.DISCORD_THRIVE_WEBHOOK ?? ''
}
