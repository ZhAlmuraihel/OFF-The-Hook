const Token = require('../models/token')
const { AuthorizationCode } = require('simple-oauth2');
const logger = require('./logger.js')

function isTimeToRefresh(expiryTime) {
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    return (new Date(expiryTime) - now) < bufferTime;
}

async function refreshAccessToken() {
    const tokenEntry = await Token.findOne({});
    if (!tokenEntry) throw new Error('No token found');

    const config = {
        client: {
            id: process.env.CLIENT_ID,
            secret: process.env.CLIENT_SECRET,
        },
        auth: {
            tokenHost: 'https://login.microsoftonline.com',
            tokenPath: `${process.env.TENANT_ID}/oauth2/v2.0/token`
        }
    };

    const client = new AuthorizationCode(config);

    const tokenConfig = {
        scope: 'offline_access Mail.Read',
        refresh_token: tokenEntry.refreshToken,
    };

    try {
        // Create a token instance
        const token = client.createToken({ refresh_token: tokenEntry.refreshToken });

        // Refresh the token
        const result = await token.refresh();

        // Update the token entry with the new tokens and expiry time
        tokenEntry.accessToken = result.token.access_token;
        tokenEntry.refreshToken = result.token.refresh_token;
        tokenEntry.expiryTime = new Date(result.token.expires_at * 1000);
        await tokenEntry.save();

        logger.info('Refreshed the access token')

        return tokenEntry.accessToken;
    } catch (error) {
        logger.error('Error refreshing access token: ', error.message);
        throw new Error('Could not refresh access token');
    }
}

module.exports = { isTimeToRefresh, refreshAccessToken }