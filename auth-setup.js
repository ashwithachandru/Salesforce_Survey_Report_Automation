const { chromium } = require('playwright');
const path = require('path');

const AUTH_FILE = path.resolve(__dirname, 'salesforce-auth.json');

const SURVEY_REPORT_URL =
    'https://ramrajcotton--rrpartial.sandbox.lightning.force.com/lightning/n/SurveyReport';

(async () => {

    console.log('Launching Chrome for one-time Salesforce authentication...');

    const context = await chromium.launchPersistentContext(
        path.resolve(__dirname, 'salesforce-auth-profile'),
        {
            headless: false,
            acceptDownloads: true,
            viewport: {
                width: 1400,
                height: 900
            }
        }
    );

    const pages = context.pages();

    const page =
        pages.length > 0
            ? pages[0]
            : await context.newPage();

    await page.goto(
        SURVEY_REPORT_URL,
        {
            waitUntil: 'domcontentloaded',
            timeout: 120000
        }
    );

    console.log('');
    console.log('==========================================');
    console.log('ACTION REQUIRED');
    console.log('==========================================');
    console.log('');
    console.log('If Salesforce asks for login:');
    console.log('1. Enter your Salesforce username manually.');
    console.log('2. Enter your Salesforce password manually.');
    console.log('3. Complete OTP manually if Salesforce asks.');
    console.log('');
    console.log('DO NOT put credentials into this script.');
    console.log('');
    console.log('After login, wait until the Survey Report page');
    console.log('is visible in the browser.');
    console.log('');
    console.log('Then press ENTER in this terminal.');
    console.log('');

    await new Promise(resolve => {
        process.stdin.resume();
        process.stdin.once('data', resolve);
    });

    console.log('');
    console.log('Checking Salesforce session...');

    if (
        page.url().includes('my.salesforce.com') &&
        !page.url().includes('/lightning/')
    ) {
        throw new Error(
            'Salesforce is not authenticated. Please complete the login first.'
        );
    }

    console.log('Salesforce session is authenticated.');
    console.log(`Current URL: ${page.url()}`);

    await context.storageState({
        path: AUTH_FILE
    });

    console.log('');
    console.log('==========================================');
    console.log('AUTHENTICATION STATE SAVED');
    console.log('==========================================');
    console.log('');
    console.log(`Saved to: ${AUTH_FILE}`);
    console.log('');
    console.log('You can now close this browser.');
    console.log('');

    await context.close();

})().catch(error => {

    console.error('');
    console.error('AUTH SETUP FAILED');
    console.error(error.message);

    process.exit(1);
});