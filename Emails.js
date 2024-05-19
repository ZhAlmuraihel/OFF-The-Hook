const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
    emailId:{ type: String, required: true },
    from: { type: String, required: true },
    emailSubject: { type: String, required: true },
    isJunk:{type:Boolean,default:false}
},
{ timestamps: true });

const Email = mongoose.model('Email', emailSchema);

module.exports = Email;