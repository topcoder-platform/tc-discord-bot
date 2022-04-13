/**
 * Config service
 * used for access to config vars and etc.
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
    postgreUser: process.env.POSTGRE_SQL_USER ?? '',
    postgrePass: process.env.POSTGRE_SQL_PASS ?? '',
    postgreDB: process.env.POSTGRE_SQL_DATABASE ?? '',
    authSecret: process.env.AUTH_SECRET ?? '',
    validIssuers: process.env.VALID_ISSUERS ?? '',
    nodeEnv: process.env.NODE_ENV ?? '',
    removeRoleIDs: process.env.REMOVE_ROLE_IDS ?? '',
    grayRatedRoleID: process.env.GRAY_RATED_ROLE_ID ?? '',
    greenRatedRoleID: process.env.GREEN_RATED_ROLE_ID ?? '',
    blueRatedRoleID: process.env.BLUE_RATED_ROLE_ID ?? '',
    yellowRatedRoleID: process.env.YELLOW_RATED_ROLE_ID ?? '',
    redRatedRoleID: process.env.RED_RATED_ROLE_ID ?? '',
    targetRatedRoleID: process.env.TARGET_RATED_ROLE_ID ?? ''
}
