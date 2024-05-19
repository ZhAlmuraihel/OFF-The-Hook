const { Client } = require('@microsoft/microsoft-graph-client');
const { htmlToText } = require('html-to-text');
require('isomorphic-fetch');
const { scrapeData } = require('./headAnalysis')
const axios = require('axios')


async function ensureTempFolderExists(client) {
    const inboxFolders = await client.api('/me/mailFolders/inbox/childFolders')
        .select('displayName, id')
        .get();

    let folder = inboxFolders.value.find(f => f.displayName === 'Temp');
    if (!folder) {
        folder = await client.api('/me/mailFolders/inbox/childFolders')
            .post({ displayName: 'Temp' });
        console.log('Created new folder:', folder.id);
    } else {
        console.log('Temp folder already exists:', folder.id);
    }
    return folder;
}


async function readEmails(token) {
    

    try {
        // Step 1: Retrieve child folders of Inbox
        const inboxFolders = await client.api('/me/mailFolders/inbox/childFolders')
            .select('displayName, id')
            .get();

        // Step 2: Check if 'Temp' folder exists
        let folder = inboxFolders.value.find(f => f.displayName === 'Temp');

        if (!folder) {
            // If 'Temp' folder does not exist, create it
            folder = await client.api('/me/mailFolders/inbox/childFolders')
                .post({ displayName: 'Temp' });
            console.log('Created new folder:', folder.id);
        } else {
            console.log('Temp folder already exists:', folder.id);
        }

        // Move the first email to the 'Temp' folder
        const messages = await client.api('/me/messages')
            .select('id')
            .top(1)
            .get();

        if (messages.value.length > 0) {
            const messageId = messages.value[0].id;
            const movedEmail = await client.api(`/me/messages/${messageId}/move`)
                .post({ destinationId: folder.id });

        } else {
            console.log('No emails found to move.');
        }
        const result = await client.api('/me/messages')
            .select('id,subject,from,receivedDateTime,isRead,body,internetMessageHeaders')
            .orderby('receivedDateTime desc')
            .top(10)
            .get();

        let mes = result.value.map(mail => ({
            subject: mail.subject,
            from: mail.from.emailAddress.address,
            receivedDateTime: mail.receivedDateTime,
            isRead: mail.isRead,
            bodyPreview: mail.bodyPreview || 'No preview available',
            bodyContent: mail.body ? mail.body.content : 'No content available',
            plainTextBody: mail.body ? htmlToText(mail.body.content, { wordwrap: 130 }) : 'No content available',
            headers: mail.internetMessageHeaders || []
        }));

        const formattedHeaders = formatEmailHeaders(mes[0]);

        let body = mes[0]

        const newe = formatEmailHeaders(mes[0])

        // const data = await scrapeData(newe);

        let data

        try {
            const response = await axios.post('http://127.0.0.1:8000/api/modify_content', {
                headers: {
                    'Content-Type': 'text/plain'
                },
                html_content: mes[0].bodyContent
            });

            data = response.data;

        } catch (error) {
            console.error('Error:', error);
        }

        try {
            const response = await axios.post('http://127.0.0.1:8000/api/analyze_urls', {
                headers: {
                    'Content-Type': 'text/plain'
                },
                html_content: data.cleaned_html,
                api_key: "7899c1bff18f7f96bef37c3869f9e1a51fc95845eb8d9ebc81a52ca13764ca3f"
            });

            // data = response.data;
            let d = response.data

        } catch (error) {
            console.error('Error:', error);
        }

        try {
            const response = await axios.post('http://127.0.0.1:8000/api/analyze_email', {
                headers: {
                    'Content-Type': 'text/plain'
                },
                email_content: body.plainTextBody
            });

            data = response.data;

        } catch (error) {
            console.error('Error:', error);
        }



        return data
    } catch (err) {
        console.log(err);
    }
}



function stripHtml(html) {
    let doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}
// module.exports = readEmails;