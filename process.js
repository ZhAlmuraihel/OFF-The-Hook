const Token = require('../models/token')
const { Client } = require('@microsoft/microsoft-graph-client');
const Email = require('../models/Emails')
const { scrapeData } = require('./headAnalysis')
const axios = require('axios')
const { htmlToText } = require('html-to-text');
const { isTimeToRefresh, refreshAccessToken } = require('../helpers/tokenTime')
const logger = require('../helpers/logger');
const { sendNotification } = require('../helpers/notification');
require('isomorphic-fetch');

async function checkTokensAndPerformAction() {
    try {
        const token = await Token.findOne({});

        if (token.isConnected) {
            performAction(token);
        }else if(token.notification){
            sendNotification('Token Expired',`Token is Expired! Please Reconnect Outlook to Continue`)
        }
    } catch (error) {
        logger.error('Error checking tokens:', error.message);
    }
}
//Main FUnction
async function performAction(access) {
    let token
    try {
        logger.info("Checking if Access Token is expired");
        if (access.isConnected) {
            if (isTimeToRefresh(access.expiryTime)) {
                logger.info("Access Token is expired!");
                token = await refreshAccessToken();
            }
        } else {
            if (access.notification) {
                sendNotification('Token Expired',`Token is Expired! Please Reconnect Outlook to Continue`)
            }
            logger.error(`Token Expired: ${error.message}`)
            return
        }

    } catch (error) {
        logger.error(`Token Expired: ${error.message}`)
        token = await Token.findOne({});
        token.isConnected = false
        await token.save()
        return
    }

    let client
    try {
        client = Client.init({
            authProvider: (done) => {
                done(null, access.accessToken)
            },
        });
    } catch (error) {
        logger.error(`Token Expired: ${error.message}`)
        token = await Token.findOne({});
        token.isConnected = false
        await token.save()
        return
    }

    try {

        logger.info("Checking the If temp Folder Exsists?");
        const folder = await ensureTempFolderExists(client);

        logger.info("Move Emails to Temp Folder");
        await moveEmailsToFolder(client, folder.id);

        logger.info("Read Emails from Temp Folder");
        const emails = await readAndProcessEmails(client, folder.id);

        if (emails.length == 0 || !emails) {
            return
        }

        for (const email of emails) {
            let data
            try {
                logger.info(`Html Code Scanning for Email with Subject: ${email.subject}`)
                const response = await axios.post(`${process.env.Django_URL}/modify_content`, {
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    html_content: email.bodyContent
                });

                data = response.data;
                logger.info(`Html Code Scanning Successful for Email with Subject: ${email.subject}`)

            } catch (error) {
                let mail = await Email.findOneAndUpdate({emailId:email.internetMessageId},{ $set: { isError: true } },{ new: true, upsert: false } )
                logger.error(`Error Occurred in HTML Code Scanning for Email with Subject: ${email.subject}   ${error.message}`)
                continue
            }
            if (access.headerAnalysis) {
                logger.info(`Perfoming Header Analysis for Email with Subject: ${email.subject}`)

                const formattedHeaders = formatEmailHeaders(email.headers);

                try {
                    const data = await scrapeData(formattedHeaders);

                    const problemCount = data.reduce((count, item) => {
                        if (item.img.includes('problem.png')) {
                            count++;
                        }
                        return count;
                    }, 0);

                    if (problemCount > 3) {
                        logger.info(`Email Detected as Phishing in Header Analysis: ${email.subject}`)

                        await moveEmailToSpam(client, email.internetMessageId,email.emailId);
                        if (access.notification) {
                            sendNotification('Phishing Email Detected',`Email with subject "${email.subject}" moved to Junk.`)
                        }
                        logger.info(`Email with subject "${email.subject}" moved to Junk.`);
                        continue
                    }
                } catch (error) {
                    let mail = await Email.findOneAndUpdate({emailId:email.internetMessageId},{ $set: { isError: true } },{ new: true, upsert: false } )
                    logger.error(`Error Occurred in Header Analysis for Email with Subject: ${email.subject}   ${error.message}`)
                    continue
                }

            }
            if (access.urlScanning) {
                try {
                    logger.info(`Perfoming URL Analysis for Email with Subject: ${email.subject}`)
                    const response = await axios.post(`${process.env.Django_URL}/analyze_urls`, {
                        headers: {
                            'Content-Type': 'text/plain'
                        },
                        html_content: data.cleaned_html,
                        api_key: "7899c1bff18f7f96bef37c3869f9e1a51fc95845eb8d9ebc81a52ca13764ca3f"
                    });

                    const urlResults = response.data.url_results;


                    for (const url in urlResults) {
                        if (urlResults[url] && urlResults[url].positives !== undefined) {
                            logger.info(`Positives for ${url}:`, urlResults[url].positives);
                            if (urlResults[url].positives > 5) {
                                logger.info(`Email with Subject: ${email.subject} Detect as Phishing in Perfoming URL Analysis`)
                                await moveEmailToSpam(client, email.internetMessageId,email.emailId);
                                if (access.notification) {
                                    sendNotification('Spam Email Detected',`Email with subject "${email.subject}" moved to Junk.`)
                                }
                                logger.info(`Email with subject "${email.subject}" moved to spam.`);
                                continue;
                            }
                        }
                    }

                } catch (error) {
                    logger.error(`Error Occurred in URL Analysis for Email with Subject: ${email.subject}   ${error.message}`)
                    let mail = await Email.findOneAndUpdate({emailId:email.internetMessageId},{ $set: { isError: true } },{ new: true, upsert: false } )
                    continue
                }

                try {
                    logger.info(`Perfoming ML Classifier for Email with Subject: ${email.subject}`)

                    const response = await axios.post(`${process.env.Django_URL}/analyze_email`, {
                        headers: {
                            'Content-Type': 'text/plain'
                        },
                        email_content: email.plainTextBody
                    });

                    data = response.data;
                    logger.info(`Email with Subject: ${email.subject} Detect as ${data.prediction} in Perfoming ML Classifeir`)



                    if (data.prediction == 'Phishing Email') {
                        await moveEmailToSpam(client, email.internetMessageId,email.emailId);
                        if (access.notification) {
                            sendNotification('Phishing Email Detected',`Email with subject "${email.subject}" moved to Junk.`)
                        }
                        logger.info(`Email with subject "${email.subject}" moved to Junk.`);
                        continue
                    }

                } catch (error) {
                    logger.error(`Error Occurred in perfoming ML Classifer for Email with Subject: ${email.subject}   ${error.message}`)
                    let mail = await Email.findOneAndUpdate({emailId:email.internetMessageId},{ $set: { isError: true } },{ new: true, upsert: false } )
                    continue
                }
            }
            try {
                logger.info(`Email with Subject: ${email.subject} is Safe email`)
                await moveEmailToInbox(client, email.emailId);
                logger.info(`Email with subject "${email.subject}" moved to Inbox.`);
            } catch (error) {
                logger.error(`Error moving email with subject "${email.subject}" to Inbox:`, error.message);
            }
        }
    } catch (error) {
        logger.error(`Token Expired! Connect Again to continue: ${error.message}`)
        token = await Token.findOne({});
        if (token.notification) {
            sendNotification(`Token Expired! Connect Again to continue: ${error.message}`)
        }
        token.isConnected = false
        await token.save()
        return
    }
}

//Create Temp Directory in Outlook
async function ensureTempFolderExists(client) {
    try {
        const inboxFolders = await client.api('/me/mailFolders/inbox/childFolders')
            .select('displayName, id')
            .get();

        let folder = inboxFolders.value.find(f => f.displayName === 'Temp');
        if (!folder) {
            folder = await client.api('/me/mailFolders/inbox/childFolders')
                .post({ displayName: 'Temp' });
            logger.info('Created new Temp folder:', folder.id);
        } else {
            logger.info('Temp folder already exists:', folder.id);
        }
        return folder;

    } catch (error) {
        throw new Error(error.message)
    }
}

async function moveEmailsToFolder(client, folderId, count = 3) {
    try {
        const movedEmails = [];
        let fetchedEmails = 0;

        while (movedEmails.length < count) {
            const messages = await client.api('/me/mailFolders/inbox/messages')
                .select('id,internetMessageId')
                .top(count + fetchedEmails)
                .get();

            for (let message of messages.value.slice(fetchedEmails)) {
                const emailExists = await Email.findOne({ emailId: message.internetMessageId });
                if (!emailExists || emailExists.isError) {
                    logger.info(`Moving email ${message.id} with internetMessageId ${message.internetMessageId} to Temp folder.`);
                    const movedEmail = await client.api(`/me/messages/${message.id}/move`)
                        .post({ destinationId: folderId });

                    // Store both the original ID and the moved ID along with internetMessageId
                    movedEmails.push({
                        originalId: message.id,
                        movedId: movedEmail.id,
                        internetMessageId: message.internetMessageId
                    });

                    logger.info(`Move email ${message.id} to the Temp Folder`);

                    if (movedEmails.length >= count) {
                        break;
                    }
                } else {
                    logger.info(`Email ${message.id} already scanned. Skipping.`);
                }
            }

            fetchedEmails = messages.value.length;
            if (fetchedEmails >= messages.value.length) {
                break;
            }
        }

        return movedEmails;
    } catch (error) {
        throw new Error(error.message)

    }
}


//Read and Save Emails
async function readAndProcessEmails(client, folderId) {
    try {

        const result = await client.api(`/me/mailFolders/${folderId}/messages`)
            .select('id,internetMessageId,subject,from,receivedDateTime,isRead,body,internetMessageHeaders')
            .orderby('receivedDateTime desc')
            .get();
        const newEmails = [];
        for (const mail of result.value) {
            const emailData = {
                emailId: mail.internetMessageId,
                from: mail.from.emailAddress.address,
                emailSubject: mail.subject
            };

            // Check if email already exists in the database
            const exists = await Email.findOne({ emailId: mail.internetMessageId });
            if (!exists) {
                logger.info(`Saving Email ${mail.id} with internetMessageId ${mail.internetMessageId} in the Database.`);
                // Save new email if it does not exist
                const newEmail = new Email(emailData);
                try {
                    await newEmail.save();
                } catch (error) {
                    logger.error(`Error Occurred While Saving the Mail: ${error.message}`)                    
                }
                newEmails.push({
                    emailId: mail.id,
                    internetMessageId: mail.internetMessageId,
                    subject: mail.subject,
                    from: mail.from.emailAddress.address,
                    receivedDateTime: mail.receivedDateTime,
                    isRead: mail.isRead,
                    bodyPreview: mail.bodyPreview || 'No preview available',
                    bodyContent: mail.body ? mail.body.content : 'No content available',
                    plainTextBody: mail.body ? htmlToText(mail.body.content, { wordwrap: 130 }) : 'No content available',
                    headers: mail.internetMessageHeaders || []
                });
            }else if(exists.isError){
                newEmails.push({
                    emailId: mail.id,
                    internetMessageId: mail.internetMessageId,
                    subject: mail.subject,
                    from: mail.from.emailAddress.address,
                    receivedDateTime: mail.receivedDateTime,
                    isRead: mail.isRead,
                    bodyPreview: mail.bodyPreview || 'No preview available',
                    bodyContent: mail.body ? mail.body.content : 'No content available',
                    plainTextBody: mail.body ? htmlToText(mail.body.content, { wordwrap: 130 }) : 'No content available',
                    headers: mail.internetMessageHeaders || []
                });
            } else {
                logger.info('Email already Scanned');
                await moveEmailToInbox(client, mail.id)
            }
        }

        return newEmails.length > 0 ? newEmails : [];
    } catch (error) {
        throw new Error(error.message)

    }

}

//Move Email to Spam
async function moveEmailToSpam(client,internetMessageId, emailId) {
    try {
        const junkFolderId = 'JunkEmail';

        await client.api(`/me/messages/${emailId}/move`)
            .post({ destinationId: junkFolderId });

        await Email.findOneAndUpdate({ emailId: internetMessageId }, { isJunk: true });
    } catch (error) {
        throw new Error(error.message)

    }
}

//Format Headers
function formatEmailHeaders(email) {
    return email.map(header => `${header.name}: ${header.value}`).join('\n');
}


//Move back to inbox
async function moveEmailToInbox(client, emailId) {
    try {
        const inboxFolderId = 'Inbox';

        try {
            await client.api(`/me/messages/${emailId}/move`)
                .post({ destinationId: inboxFolderId });

            logger.info(`Moved email ${emailId} to Inbox.`);
        } catch (error) {
            logger.error(`Error moving email ${emailId} to Inbox:`, error);
            throw error;
        }
    } catch (error) {
        throw new Error(error.message)

    }
}

module.exports = { checkTokensAndPerformAction }