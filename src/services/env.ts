/**
 * Config service
 * used for access to env vars and etc.
 */
export const Env = {
    token: process.env.DISCORD_BOT_TOKEN ?? '',
    appId: process.env.DISCORD_APP_ID ?? '',
    botChannelId: process.env.BOT_CHANNEL_ID ?? '',
    discordThriveWebhook: process.env.DISCORD_THRIVE_WEBHOOK ?? '',
    discordVerifyUserWebhook: process.env.DISCORD_VERIFY_USER_WEBHOOK ?? '',
    serverID: process.env.SERVER_ID ?? '',
    verifyRoleID: process.env.VERIFY_ROLE_ID ?? '',
    guestRoleID: process.env.GUEST_ROLE_ID ?? '',
    verifySuccessRedirect: process.env.VERIFY_REDIRECT_URL ?? '',
    contentfulSpaceID: process.env.CONTENTFUL_SPACE_ID ?? '',
    contentfulCDNKey: process.env.CONTENTFUL_CDN_KEY ?? '',
    mongoUser: process.env.MONGO_ATLAS_USER ?? '',
    mongoPass: process.env.MONGO_ATLAS_PASS ?? '',
    mongoDB: process.env.MONGO_ATLAS_DB ?? ''
}
