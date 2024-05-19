const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

// Puppeteer scraping function
async function scrapeData(emailContent) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Open the website
        await page.goto('https://mxtoolbox.com/EmailHeaders.aspx', { waitUntil: 'networkidle2' });

        // Inject the email content into the input field
        await page.evaluate((emailContent) => {
            const input = document.querySelector('#ctl00_ContentPlaceHolder1_txtToolInput');
            input.value = emailContent;
        }, emailContent);

        // Click the submit button
        await page.click('#ctl00_ContentPlaceHolder1_btnAction');

        // Wait for the next page to load
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // Select the required data from the new page
        // const extractedData = await page.$eval('.panel-body > .container-dmarc-compliance > div > ul', ul => ul.innerText);
        const extractedData = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.panel-body > .container-dmarc-compliance > div > ul li, .panel-body > .container-dmarc-compliance > div > ul ul li'));
            return items.map(item => {
                const iconSrc = item.querySelector('img').src;
                const statusText = item.querySelector('a').textContent.trim();
                return { data: statusText, img: iconSrc };
            });
        });
        return extractedData;
    } catch (error) {
        console.log(error)
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeData }