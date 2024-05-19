require('dotenv').config();
const express = require('express');
const Token = require('../models/token')
const { AuthorizationCode } = require('simple-oauth2');

const app = express();

const config = {
    client: {
        id: process.env.CLIENT_ID,
        secret: process.env.CLIENT_SECRET,
    },
    auth: {
        tokenHost: 'https://login.microsoftonline.com',
        authorizePath: `${process.env.TENANT_ID}/oauth2/v2.0/authorize`,
        tokenPath: `${process.env.TENANT_ID}/oauth2/v2.0/token`
    }
};

const client = new AuthorizationCode(config);

app.get('/auth', (req, res) => {
    const authorizationUri = client.authorizeURL({
        scope: 'offline_access Mail.Read',
        redirect_uri: process.env.REDIRECT_URI,
    });
    res.redirect(authorizationUri);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    const options = {
        code,
        redirect_uri: process.env.REDIRECT_URI,
        scope: 'offline_access Mail.Read',
    };

    try {
        const accessToken = await client.getToken(options);
        const tokenData = {
            accessToken: accessToken.token.access_token,
            refreshToken: accessToken.token.refresh_token,
            expiryTime: new Date(accessToken.token.expires_at * 1000),
            isConnected : true
        };

        const existingToken = await Token.findOne({});
        if (existingToken) {
            existingToken.accessToken = tokenData.accessToken;
            existingToken.refreshToken = tokenData.refreshToken;
            existingToken.expiryTime = tokenData.expiryTime;
            existingToken.isConnected = true
            await existingToken.save();
        } else {
            const newToken = new Token(tokenData);
            await newToken.save();
        }
        res.redirect(`${process.env.FRONT_END_URL}?isConnected=true`); 
    } catch (error) {
        console.error('Access Token Error', error.message);
        res.send('Authentication failed');
    }
});



module.exports=app
