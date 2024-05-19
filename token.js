const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    accessToken: String,
    refreshToken: String,
    tokenExpiresAt: Date,
    headerAnalysis:{type:Boolean,default:true},
    urlScanning:{type:Boolean,default:true},
    isConnected:{type:Boolean,default:false},
});

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;