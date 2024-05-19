const Token = require('../models/token')
const { Client } = require('@microsoft/microsoft-graph-client');
const Email = require('../models/Emails')
const { scrapeData } = require('./headAnalysis')
const axios = require('axios')
const { htmlToText } = require('html-to-text');
const {isTimeToRefresh,refreshAccessToken} = require('../helpers/tokenTime')
const logger = require('../helpers/logger')
require('isomorphic-fetch');

async function checkTokensAndPerformAction() {
    try {
        const token = await Token.findOne({});

        if (token.isConnected) {
            performAction(token);
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
        }
        
    } catch (error) {
        token = await Token.findOne({});
        token.isConnected = false
        await token.save()
        return
    }


    const client = Client.init({
        authProvider: (done) => {
            done(null, access.accessToken)
        },
    });
    logger.info("Checking the If temp Folder Exsists?");
    const folder = await ensureTempFolderExists(client);
    
    logger.info("Move Emails to Temp Folder");
    await moveEmailsToFolder(client, folder.id);
    
    logger.info("Read Emails from Temp Folder");
    const emails = await readAndProcessEmails(client, folder.id);

    if (emails.length==0 || !emails) {
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
                    logger.info(`Email Detected as Spam in Header Analysis: ${email.subject}`)

                    await moveEmailToSpam(client, email.emailId);
                    logger.info(`Email with subject "${email.subject}" moved to spam.`);
                    continue
                }
            } catch (error) {
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
                        logger.info(`Email with Subject: ${email.subject} Detect as Spam in Perfoming URL Analysis`)
                        await moveEmailToSpam(client, email.emailId);
                        logger.info(`Email with subject "${email.subject}" moved to spam.`);
                        continue; 
                    }
                    }
                  }
    
            } catch (error) {
                logger.error(`Error Occurred in URL Analysis for Email with Subject: ${email.subject}   ${error.message}`)
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



                if (data.prediction=='Phishing Email') {
                    await moveEmailToSpam(client, email.emailId);
                    logger.info(`Email with subject "${email.subject}" moved to Junk.`);
                    continue
                }
    
            } catch (error) {
                logger.error(`Error Occurred in perfoming ML Classifer for Email with Subject: ${email.subject}   ${error.message}`)
                continue
            }
        }
        try {
            logger.info(`Email with Subject: ${email.subject} is safe email`)
            await moveEmailToInbox(client, email.emailId);
            logger.info(`Email with subject "${email.subject}" moved to Inbox.`);
        } catch (error) {
            logger.error(`Error moving email with subject "${email.subject}" to Inbox:`, error.message);
        }
    }
}
 
//Create Temp Directory in Outlook
async function ensureTempFolderExists(client) {
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
}

async function moveEmailsToFolder(client, folderId, count = 3) {
    const movedEmails = [];
    let fetchedEmails = 0;

    while (movedEmails.length < count) {
        const messages = await client.api('/me/mailFolders/inbox/messages')
            .select('id')
            .top(count + fetchedEmails)
            .get();

        for (let message of messages.value.slice(fetchedEmails)) {
            // Check if the email already exists in the DB with isJunk: false
            const emailExists = await Email.findOne({ emailId: message.id });
            if (!emailExists) {
                const movedEmail = await client.api(`/me/messages/${message.id}/move`)
                    .post({ destinationId: folderId });
                movedEmails.push(movedEmail);
                logger.info(`Moved email ${message.id} to folder Temp Folder`);

                if (movedEmails.length >= count) {
                    break;
                }
            }
        }

        fetchedEmails = messages.value.length;
        if (fetchedEmails >= messages.value.length) {
            break;
        }
    }

    return movedEmails;
}


//Read and Save Emails
async function readAndProcessEmails(client, folderId) {
    const result = await client.api(`/me/mailFolders/${folderId}/messages`)
        .select('id,subject,from,receivedDateTime,isRead,body,internetMessageHeaders')
        .orderby('receivedDateTime desc')
        .get();
    const newEmails = [];
    for (const mail of result.value) {
        const emailData = {
            emailId: mail.id,
            from: mail.from.emailAddress.address,
            emailSubject: mail.subject
        };

        // Check if email already exists in the database
        const exists = await Email.findOne({ emailId: emailData.emailId });
        if (!exists) {
            // Save new email if it does not exist
            const newEmail = new Email(emailData);
            await newEmail.save();
            newEmails.push({
                emailId: mail.id,
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
            logger.info('Email already exists in the database');
        }
    }

    return newEmails.length > 0 ? newEmails : [];

}

//Move Email to Spam
async function moveEmailToSpam(client, emailId) {
    const junkFolderId = 'JunkEmail';

    await client.api(`/me/messages/${emailId}/move`)
        .post({ destinationId: junkFolderId });

    await Email.findOneAndUpdate({ emailId: emailId }, { isJunk: true });
}

//Format Headers
function formatEmailHeaders(email) {
    return email.map(header => `${header.name}: ${header.value}`).join('\n');
}


//Move back to inbox
async function moveEmailToInbox(client, emailId) {
    const inboxFolderId = 'Inbox';

    try {
        await client.api(`/me/messages/${emailId}/move`)
            .post({ destinationId: inboxFolderId });

        logger.info(`Moved email ${emailId} to Inbox.`);
    } catch (error) {
        logger.error(`Error moving email ${emailId} to Inbox:`, error);
        throw error; 
    }
}

module.exports = { checkTokensAndPerformAction }