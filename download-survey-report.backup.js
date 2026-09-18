const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================================
// SALESFORCE SURVEY REPORT DOWNLOADER
// ============================================================
//
// Features:
//   1. Uses a persistent Playwright browser profile
//   2. No auth-state.json required
//   3. Finds date inputs through their labels
//   4. Uses Salesforce calendar data-value attributes
//   5. Defaults to yesterday's date
//   6. Supports custom --from / --to dates
//   7. Searches and selects the required report
//   8. Downloads Excel
//   9. Detects Salesforce session/login redirects
//
// Examples:
//
//   node download-survey-report.js
//
//   node download-survey-report.js \
//       --from 2026-08-01 \
//       --to 2026-08-31
//
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const SALESFORCE_URL =
    'https://ramrajcotton--rrpartial.sandbox.lightning.force.com/lightning/n/SurveyReport';

const REPORT_NAME =
    process.env.SF_REPORT_NAME ||
    'Customer Complaints-Generic';

const DOWNLOAD_DIR =
    path.resolve('./downloads');

// Persistent browser profile.
// This replaces auth-state.json.
const BROWSER_PROFILE_DIR =
    path.resolve('./browser-profile');


// ============================================================
// UTILITY
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// DATE HELPERS
// ============================================================

function formatDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1).padStart(2, '0');

    const day =
        String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}


function getYesterday() {

    const date =
        new Date();

    date.setDate(
        date.getDate() - 1
    );

    return formatDate(date);
}


function isValidDateString(value) {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date =
        new Date(`${value}T00:00:00`);

    return !Number.isNaN(
        date.getTime()
    );
}


function parseCommandLineDates() {

    const args =
        process.argv.slice(2);

    let fromDate = null;
    let toDate = null;

    for (let i = 0; i < args.length; i++) {

        if (args[i] === '--from') {

            fromDate =
                args[i + 1];

            i++;

        } else if (args[i] === '--to') {

            toDate =
                args[i + 1];

            i++;
        }
    }

    // --------------------------------------------------------
    // If no dates supplied:
    // automatically use yesterday.
    // --------------------------------------------------------

    if (!fromDate && !toDate) {

        const yesterday =
            getYesterday();

        return {
            fromDate: yesterday,
            toDate: yesterday
        };
    }

    // --------------------------------------------------------
    // If only --from is supplied.
    // --------------------------------------------------------

    if (fromDate && !toDate) {

        toDate =
            fromDate;
    }

    // --------------------------------------------------------
    // If only --to is supplied.
    // --------------------------------------------------------

    if (!fromDate && toDate) {

        fromDate =
            toDate;
    }

    if (!isValidDateString(fromDate)) {

        throw new Error(
            `Invalid --from date: ${fromDate}`
        );
    }

    if (!isValidDateString(toDate)) {

        throw new Error(
            `Invalid --to date: ${toDate}`
        );
    }

    const from =
        new Date(`${fromDate}T00:00:00`);

    const to =
        new Date(`${toDate}T00:00:00`);

    if (from > to) {

        throw new Error(
            `From date ${fromDate} cannot be later than To date ${toDate}.`
        );
    }

    return {
        fromDate,
        toDate
    };
}


// ============================================================
// SESSION / LOGIN DETECTION
// ============================================================

function isSalesforceLoginPage(url) {

    if (!url) {
        return false;
    }

    const lower =
        url.toLowerCase();

    // Standard login URLs.
    if (lower.includes('/login')) {
        return true;
    }

    if (lower.includes('login.salesforce.com')) {
        return true;
    }

    // Salesforce expired-session redirect.
    //
    // Example:
    //
    // https://ramrajcotton--rrpartial.sandbox.my.salesforce.com/
    // ?ec=302&startURL=%2Fvisualforce%2Fsession...
    //
    if (
        lower.includes('ec=302') &&
        lower.includes('starturl=')
    ) {
        return true;
    }

    // Salesforce My Domain root without the Lightning page.
    if (
        lower.includes(
            'ramrajcotton--rrpartial.sandbox.my.salesforce.com'
        ) &&
        !lower.includes('.lightning.force.com/lightning/')
    ) {
        return true;
    }

    return false;
}


async function ensureAuthenticated(page) {

    const currentUrl = page.url();

    console.log("");
    console.log("------------------------------------------");
    console.log("CHECKING SALESFORCE SESSION");
    console.log("------------------------------------------");

    console.log(`Current page: ${currentUrl}`);

    if (isSalesforceLoginPage(currentUrl)) {

        console.log("");
        console.log("Salesforce login/session page detected.");
        console.log("Entering Salesforce credentials automatically...");

        const username = process.env.SF_USERNAME;
        const password = process.env.SF_PASSWORD;

        if (!username || !password) {
            throw new Error("SF_USERNAME or SF_PASSWORD is missing from .env");
        }

        // ----------------------------------------------------
        // Salesforce first asks for the username.
        // The password field appears only after clicking
        // "Log In to Sandbox".
        // ----------------------------------------------------

        const usernameInput = page.locator("#username");

        await usernameInput.waitFor({
            state: "visible",
            timeout: 30000
        });

        await usernameInput.fill(username);

        console.log("Username entered.");
        console.log("Clicking Log In to Sandbox...");

        await page.locator("#Login").click();

        // ----------------------------------------------------
        // Wait for Salesforce to reveal the password field.
        // ----------------------------------------------------

        const passwordInput = page.locator('input[type="password"]');

        await passwordInput.waitFor({
            state: "visible",
            timeout: 30000
        });

        await passwordInput.fill(password);

        console.log("Password entered.");
        console.log("Submitting Salesforce login...");

        await page.locator("#Login").click();

        console.log("Login submitted. Waiting for Salesforce...");

        await page.waitForURL(
            url => url.toString().includes("/lightning/n/SurveyReport"),
            { timeout: 300000 }
        );

        console.log("Salesforce login completed.");
        console.log(`Current page: ${page.url()}`);
    }
}
// ============================================================
// FIND DATE INPUT USING LABEL
// ============================================================

async function getDateInput(page, labelText) {

    const label =
        page
            .locator('label')
            .filter({
                hasText: labelText
            })
            .first();

    await label.waitFor({
        state: 'visible',
        timeout: 15000
    });

    const inputId =
        await label.getAttribute('for');

    if (!inputId) {

        throw new Error(
            `${labelText} label does not have a "for" attribute.`
        );
    }

    const input =
        page.locator(
            `#${inputId}`
        );

    await input.waitFor({
        state: 'visible',
        timeout: 15000
    });

    return input;
}


// ============================================================
// SELECT DATE FROM SALESFORCE CALENDAR
// ============================================================
//
// IMPORTANT:
//
// We DO NOT use Salesforce's displayed month/year text.
//
// Instead we inspect:
//   td[role="gridcell"][data-value="YYYY-MM-DD"]
//
// This is much more reliable.
// ============================================================

async function selectDate(
    page,
    labelText,
    targetDate
) {

    console.log('');
    console.log('------------------------------------------');
    console.log(
        `Selecting ${labelText}: ${targetDate}`
    );
    console.log('------------------------------------------');

    const input =
        await getDateInput(
            page,
            labelText
        );

    console.log(
        `${labelText} input found: #${await input.getAttribute('id')}`
    );

    // Open calendar.
    await input.click();

    await sleep(500);

    const calendar =
        page
            .locator(
                '.slds-datepicker[role="dialog"]'
            )
            .first();

    await calendar.waitFor({
        state: 'visible',
        timeout: 10000
    });

    console.log(
        `${labelText} calendar opened.`
    );

    // --------------------------------------------------------
    // Navigate calendar.
    // --------------------------------------------------------

    for (
        let attempt = 1;
        attempt <= 36;
        attempt++
    ) {

        const targetCell =
            calendar.locator(
                `td[role="gridcell"][data-value="${targetDate}"]`
            );

        // ----------------------------------------------------
        // Exact target date exists.
        // ----------------------------------------------------

        if (
            await targetCell.count() > 0
        ) {

            console.log(
                `FOUND ${targetDate} in calendar.`
            );

            await targetCell
                .first()
                .scrollIntoViewIfNeeded();

            await targetCell
                .first()
                .click();

            await sleep(500);

            const value =
                await input.inputValue();

            console.log(
                `${labelText} selected value: ${value}`
            );

            if (
                !value ||
                !/^\d{1,2}-[A-Za-z]{3,4}-\d{4}$/.test(value)
            ) {

                throw new Error(
                    `${labelText} did not update after selecting ${targetDate}. Current value: "${value}"`
                );
            }

            return;
        }

        // ----------------------------------------------------
        // Read actual calendar dates.
        // ----------------------------------------------------

        const dates =
            await calendar
                .locator(
                    'td[role="gridcell"][data-value]'
                )
                .evaluateAll(
                    cells =>
                        cells
                            .map(
                                cell =>
                                    cell.getAttribute(
                                        'data-value'
                                    )
                            )
                            .filter(Boolean)
                );

        if (!dates.length) {

            throw new Error(
                `No date cells found in ${labelText} calendar.`
            );
        }

        console.log(
            `Calendar currently contains: ${dates[0]} → ${dates[dates.length - 1]}`
        );

        const target =
            new Date(
                `${targetDate}T00:00:00`
            );

        const first =
            new Date(
                `${dates[0]}T00:00:00`
            );

        const last =
            new Date(
                `${dates[dates.length - 1]}T00:00:00`
            );

        // ----------------------------------------------------
        // Target earlier.
        // ----------------------------------------------------

        if (target < first) {

            console.log(
                'Target is earlier → Previous Month'
            );

            const previousButton =
                calendar.locator(
                    'button[title="Previous Month"]'
                );

            await previousButton.waitFor({
                state: 'visible',
                timeout: 5000
            });

            await previousButton.click();
        }

        // ----------------------------------------------------
        // Target later.
        // ----------------------------------------------------

        else if (target > last) {

            console.log(
                'Target is later → Next Month'
            );

            const nextButton =
                calendar.locator(
                    'button[title="Next Month"]'
                );

            await nextButton.waitFor({
                state: 'visible',
                timeout: 5000
            });

            await nextButton.click();
        }

        else {

            throw new Error(
                `Target ${targetDate} is inside the visible calendar range but its data-value cell was not found.`
            );
        }

        await sleep(250);
    }

    throw new Error(
        `Unable to find ${targetDate} after navigating the calendar.`
    );
}


// ============================================================
// WAIT FOR SURVEY REPORT PAGE
// ============================================================

async function openSurveyReport(page) {

    console.log('');
    console.log('==========================================');
    console.log('OPENING SURVEY REPORT');
    console.log('==========================================');

    await page.goto(
        SALESFORCE_URL,
        {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        }
    );

    await sleep(2000);

    await ensureAuthenticated(page);

    console.log(
        `Current page: ${page.url()}`
    );

    // --------------------------------------------------------
    // If login completed somewhere else, explicitly navigate
    // back to Survey Report.
    // --------------------------------------------------------

    if (
        !page.url().includes(
            '/lightning/n/SurveyReport'
        )
    ) {

        await page.goto(
            SALESFORCE_URL,
            {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            }
        );

        await sleep(2000);

        await ensureAuthenticated(page);
    }

    // --------------------------------------------------------
    // Wait for actual page content.
    // --------------------------------------------------------

    await page
        .getByText(
            'Survey Report',
            {
                exact: true
            }
        )
        .first()
        .waitFor({
            state: 'visible',
            timeout: 30000
        });

    console.log(
        'Survey Report page opened successfully.'
    );
}


// ============================================================
// SEARCH REPORT
// ============================================================

async function searchReport(page) {

    console.log("");
    console.log("==========================================");
    console.log("SEARCHING");
    console.log("==========================================");

    // Find the search input associated with Checklist Template.
    const checklistLabel = page
        .locator("label")
        .filter({ hasText: "Checklist Template" })
        .first();

    await checklistLabel.waitFor({
        state: "visible",
        timeout: 15000
    });

    const labelFor = await checklistLabel.getAttribute("for");

    let searchInput;

    if (labelFor) {
        searchInput = page.locator(`#${labelFor}`);
    } else {
        searchInput = checklistLabel.locator('xpath=following::input[1]');
    }

    await searchInput.waitFor({
        state: "visible",
        timeout: 15000
    });

    console.log("Checklist Template search input found.");

    await searchInput.fill(REPORT_NAME);

    console.log(`Searching for: ${REPORT_NAME}`);

    const searchButton = page.getByRole("button", {
        name: "Search",
        exact: true
    }).first();

    await searchButton.waitFor({
        state: "visible",
        timeout: 15000
    });

    await searchButton.click();

    await sleep(1500);

    console.log("Search button clicked.");
    console.log("Search results loaded.");
}
// ============================================================
// SELECT REPORT
// ============================================================

async function selectReport(page) {

    console.log("");
    console.log("==========================================");
    console.log(`SELECTING: ${REPORT_NAME}`);
    console.log("==========================================");

    const report = page.getByText(
        REPORT_NAME,
        { exact: true }
    ).first();

    await report.waitFor({
        state: "visible",
        timeout: 30000
    });

    console.log(`Report result visible: ${REPORT_NAME}`);
    console.log("Clicking report result...");

    await report.click();

    await sleep(1500);

    console.log(`Report selected: ${REPORT_NAME}`);
}
// ============================================================
// DOWNLOAD EXCEL
// ============================================================

async function downloadExcel(
    page,
    fromDate,
    toDate
) {

    console.log('');
    console.log('==========================================');
    console.log('DOWNLOADING EXCEL');
    console.log('==========================================');

    const downloadButton =
        page.getByRole(
            'button',
            {
                name: 'Download Excel',
                exact: true
            }
        ).first();

    await downloadButton.waitFor({
        state: 'visible',
        timeout: 20000
    });

    // --------------------------------------------------------
    // Verify enabled.
    // --------------------------------------------------------

    if (
        !(await downloadButton.isEnabled())
    ) {

        throw new Error(
            'Download Excel button is visible but disabled.'
        );
    }

    console.log(
        'Download Excel button found and enabled.'
    );

    console.log(
        'Clicking Download Excel...'
    );

    // --------------------------------------------------------
    // Capture Playwright download event.
    // --------------------------------------------------------

    const downloadPromise =
        page.waitForEvent(
            'download',
            {
                timeout: 60000
            }
        );

    await downloadButton.click();

    const download =
        await downloadPromise;

    // --------------------------------------------------------
    // Create deterministic filename.
    // --------------------------------------------------------

    const safeReportName =
        REPORT_NAME.replace(
            /[<>:"/\\|?*]/g,
            '_'
        );

    const filename =
        `${safeReportName}_${fromDate}_to_${toDate}.xlsx`;

    const destination =
        path.join(
            DOWNLOAD_DIR,
            filename
        );

    // --------------------------------------------------------
    // Save file.
    // --------------------------------------------------------

    await download.saveAs(
        destination
    );

    // --------------------------------------------------------
    // Verify.
    // --------------------------------------------------------

    if (
        !fs.existsSync(destination)
    ) {

        throw new Error(
            'Download completed but output file does not exist.'
        );
    }

    const stats =
        fs.statSync(destination);

    if (
        stats.size === 0
    ) {

        throw new Error(
            'Downloaded Excel file is empty.'
        );
    }

    console.log('');
    console.log('==========================================');
    console.log('DOWNLOAD SUCCESSFUL');
    console.log('==========================================');

    console.log(
        `Filename : ${filename}`
    );

    console.log(
        `Location : ${destination}`
    );

    console.log(
        `Size     : ${stats.size} bytes`
    );

    return destination;
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    const {
        fromDate,
        toDate
    } =
        parseCommandLineDates();

    // --------------------------------------------------------
    // Ensure download directory exists.
    // --------------------------------------------------------

    fs.mkdirSync(
        DOWNLOAD_DIR,
        {
            recursive: true
        }
    );

    // --------------------------------------------------------
    // Header.
    // --------------------------------------------------------

    console.log('');
    console.log('##########################################');
    console.log('# SALESFORCE SURVEY REPORT DOWNLOADER');
    console.log('##########################################');

    console.log('');

    console.log(
        `From Date : ${fromDate}`
    );

    console.log(
        `To Date   : ${toDate}`
    );

    console.log(
        `Report    : ${REPORT_NAME}`
    );

    console.log(
        `Save Dir  : ${DOWNLOAD_DIR}`
    );

    console.log(
        `Browser   : ${BROWSER_PROFILE_DIR}`
    );

    console.log('');

    console.log(
        'Launching browser...'
    );

    // --------------------------------------------------------
    // Launch persistent browser.
    //
    // This stores cookies/local storage in browser-profile.
    // --------------------------------------------------------

    const context =
        await chromium.launchPersistentContext(
            BROWSER_PROFILE_DIR,
            {
                headless: false,

                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',

                acceptDownloads: true,

                viewport: {
                    width: 1440,
                    height: 900
                }
            }
        );

    let page;

    try {

        // ----------------------------------------------------
        // Reuse an existing page if available.
        // ----------------------------------------------------

        if (
            context.pages().length > 0
        ) {

            page =
                context.pages()[0];

        } else {

            page =
                await context.newPage();
        }

        // ----------------------------------------------------
        // Open Survey Report.
        // ----------------------------------------------------

        await openSurveyReport(page);

        // ----------------------------------------------------
        // From Date.
        // ----------------------------------------------------

        await selectDate(
            page,
            'From Date',
            fromDate
        );

        // ----------------------------------------------------
        // To Date.
        // ----------------------------------------------------

        await selectDate(
            page,
            'To Date',
            toDate
        );

        // ----------------------------------------------------
        // Search.
        // ----------------------------------------------------

        await searchReport(page);

        // ----------------------------------------------------
        // Select report.
        // ----------------------------------------------------

        await selectReport(page);

        // ----------------------------------------------------
        // Download.
        // ----------------------------------------------------

        const output =
            await downloadExcel(
                page,
                fromDate,
                toDate
            );

        // ----------------------------------------------------
        // Success.
        // ----------------------------------------------------

        console.log('');
        console.log('##########################################');
        console.log('# ALL STEPS COMPLETED SUCCESSFULLY');
        console.log('##########################################');

        console.log('');

        console.log(
            `Excel file saved at:`
        );

        console.log(output);

    } catch (error) {

        console.log('');
        console.log('##########################################');
        console.log('# AUTOMATION FAILED');
        console.log('##########################################');

        console.error('');
        console.error(
            error.message
        );

        console.error('');

        console.error(
            `Current URL: ${page ? page.url() : 'unknown'}`
        );

        // ----------------------------------------------------
        // Save screenshot for debugging.
        // ----------------------------------------------------

        try {

            if (page) {

                const screenshot =
                    path.join(
                        DOWNLOAD_DIR,
                        'automation-error.png'
                    );

                await page.screenshot({
                    path: screenshot,
                    fullPage: true
                });

                console.error(
                    `Error screenshot: ${screenshot}`
                );
            }

        } catch {
            // Ignore screenshot errors.
        }

        process.exitCode = 1;

    } finally {

        // ----------------------------------------------------
        // Close browser.
        // ----------------------------------------------------

        await context.close();

        console.log('');
        console.log(
            'Browser closed.'
        );
    }
}


// ============================================================
// START
// ============================================================

main();






