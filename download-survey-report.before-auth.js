const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');


// ==========================================
// CONFIGURATION
// ==========================================

const SURVEY_REPORT_URL =
    'https://ramrajcotton--rrpartial.sandbox.lightning.force.com/lightning/n/SurveyReport';

const REPORT_NAME =
    'Customer Complaints-Generic';

const SAVE_DIR =
    path.resolve(__dirname, 'downloads');

const CDP_URL =
    'http://127.0.0.1:9222';


// ==========================================
// HELPERS
// ==========================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function parseArguments() {

    const args = process.argv.slice(2);

    let fromDate = null;
    let toDate = null;

    for (let i = 0; i < args.length; i++) {

        if (args[i] === '--from') {
            fromDate = args[i + 1];
            i++;
        }

        else if (args[i] === '--to') {
            toDate = args[i + 1];
            i++;
        }
    }

    if (!fromDate || !toDate) {
        throw new Error(
            'Usage: node download-survey-report.js --from YYYY-MM-DD --to YYYY-MM-DD'
        );
    }

    return {
        fromDate,
        toDate
    };
}


function validateDate(dateString) {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error(
            `Invalid date: ${dateString}. Expected YYYY-MM-DD`
        );
    }

    const date =
        new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        throw new Error(
            `Invalid date: ${dateString}`
        );
    }
}


// ==========================================
// GET DATE INPUT USING LABEL
// ==========================================

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
            `Could not find input associated with label: ${labelText}`
        );
    }

    const input =
        page.locator(`#${inputId}`);

    await input.waitFor({
        state: 'visible',
        timeout: 15000
    });

    console.log(
        `${labelText} input found: #${inputId}`
    );

    return input;
}


// ==========================================
// SELECT DATE
// ==========================================

async function selectDate(
    page,
    labelText,
    targetDate
) {

    console.log('');
    console.log('------------------------------------------');
    console.log(`Selecting ${labelText}: ${targetDate}`);
    console.log('------------------------------------------');

    const input =
        await getDateInput(
            page,
            labelText
        );

    await input.click();

    console.log(
        `${labelText} calendar opened.`
    );

    const calendar =
        page
            .locator(
                '.slds-datepicker[role="dialog"]'
            )
            .last();

    await calendar.waitFor({
        state: 'visible',
        timeout: 15000
    });


    for (
        let attempt = 0;
        attempt < 24;
        attempt++
    ) {

        const targetCell =
            calendar.locator(
                `td[role="gridcell"][data-value="${targetDate}"]`
            ).first();


        if (await targetCell.count() > 0) {

            console.log(
                `FOUND ${targetDate} in calendar.`
            );

            const dayButton =
                targetCell
                    .locator('button')
                    .first();

            await dayButton.click();

            await sleep(500);

            const selectedValue =
                await input.inputValue();

            console.log(
                `${labelText} selected value: ${selectedValue}`
            );


            if (
                !/^\d{1,2}-[A-Za-z]{3,4}-\d{4}$/
                    .test(selectedValue)
            ) {

                throw new Error(
                    `${labelText} selection failed. Value received: ${selectedValue}`
                );
            }

            return;
        }


        const values =
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


        if (values.length === 0) {

            throw new Error(
                `No calendar dates found while selecting ${targetDate}`
            );
        }


        const firstDate =
            values[0];

        const lastDate =
            values[values.length - 1];


        console.log(
            `Calendar currently contains: ${firstDate} → ${lastDate}`
        );


        const target =
            new Date(
                `${targetDate}T00:00:00`
            );

        const first =
            new Date(
                `${firstDate}T00:00:00`
            );

        const last =
            new Date(
                `${lastDate}T00:00:00`
            );


        if (target < first) {

            console.log(
                'Target is earlier → Previous Month'
            );

            await calendar
                .locator(
                    'button[title="Previous Month"]'
                )
                .first()
                .click();

            await sleep(300);

            continue;
        }


        if (target > last) {

            console.log(
                'Target is later → Next Month'
            );

            await calendar
                .locator(
                    'button[title="Next Month"]'
                )
                .first()
                .click();

            await sleep(300);

            continue;
        }


        throw new Error(
            `Target ${targetDate} is in the calendar range but could not be found.`
        );
    }


    throw new Error(
        `Could not find ${targetDate} in Salesforce calendar.`
    );
}


// ==========================================
// OPEN SURVEY REPORT
// ==========================================

async function openSurveyReport(page) {

    console.log('');
    console.log('==========================================');
    console.log('OPENING SURVEY REPORT');
    console.log('==========================================');


    console.log(
        `Current page: ${page.url()}`
    );


    await page.goto(
        SURVEY_REPORT_URL,
        {
            waitUntil: 'domcontentloaded',
            timeout: 120000
        }
    );


    await sleep(3000);


    console.log(
        `Current page: ${page.url()}`
    );


    if (
        page.url().includes(
            'my.salesforce.com'
        ) &&
        !page.url().includes(
            '/lightning/'
        )
    ) {

        throw new Error(
            'The existing Chrome session is not logged into Salesforce.'
        );
    }


    console.log(
        'Existing Salesforce session confirmed.'
    );

    console.log(
        'Survey Report page opened successfully.'
    );
}


// ==========================================
// SEARCH
// ONLY THE GREEN SEARCH BUTTON
// ==========================================

async function searchReport(page) {

    console.log('');
    console.log('==========================================');
    console.log('SEARCHING');
    console.log('==========================================');


    const searchButton =
        page
            .locator(
                'button.slds-button_brand'
            )
            .filter({
                hasText: /^Search$/
            })
            .first();


    await searchButton.waitFor({
        state: 'visible',
        timeout: 20000
    });


    console.log(
        'Green Search button found.'
    );


    console.log(
        'Button text:',
        await searchButton.innerText()
    );


    console.log(
        'Clicking green Search button...'
    );


    await searchButton.click();


    console.log(
        'Green Search button clicked.'
    );


    await sleep(2000);


    console.log(
        'Search completed.'
    );
}


// ==========================================
// SELECT REPORT
// ==========================================

async function selectReport(page) {

    console.log('');
    console.log('==========================================');
    console.log(`SELECTING: ${REPORT_NAME}`);
    console.log('==========================================');


    const report =
        page
            .getByText(
                REPORT_NAME,
                {
                    exact: true
                }
            )
            .first();


    await report.waitFor({
        state: 'visible',
        timeout: 30000
    });


    console.log(
        `${REPORT_NAME} appeared in Surveys.`
    );


    await report.scrollIntoViewIfNeeded();


    console.log(
        `Clicking ${REPORT_NAME}...`
    );


    await report.click();


    await sleep(1500);


    console.log(
        `${REPORT_NAME} selected.`
    );
}


// ==========================================
// DOWNLOAD EXCEL
// ==========================================

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
        page
            .getByRole(
                'button',
                {
                    name: 'Download Excel',
                    exact: true
                }
            )
            .first();


    await downloadButton.waitFor({
        state: 'visible',
        timeout: 30000
    });


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


    const downloadPromise =
        page.waitForEvent(
            'download',
            {
                timeout: 60000
            }
        );


    console.log(
        'Clicking Download Excel...'
    );


    await downloadButton.click();


    console.log(
        'Download Excel clicked.'
    );


    const download =
        await downloadPromise;


    console.log(
        'Excel download event received.'
    );


    const failure =
        await download.failure();


    if (failure) {

        throw new Error(
            `Excel download failed: ${failure}`
        );
    }


    const safeReportName =
        REPORT_NAME.replace(
            /[<>:"/\\|?*]/g,
            '_'
        );


    const filename =
        `${safeReportName}_${fromDate}_to_${toDate}.xlsx`;


    const destination =
        path.join(
            SAVE_DIR,
            filename
        );


    fs.mkdirSync(
        SAVE_DIR,
        {
            recursive: true
        }
    );


    console.log(
        `Saving Excel to: ${destination}`
    );


    await download.saveAs(
        destination
    );


    if (
        !fs.existsSync(destination)
    ) {

        throw new Error(
            'Excel file was not created.'
        );
    }


    const stats =
        fs.statSync(destination);


    if (stats.size === 0) {

        throw new Error(
            'Excel file was created but is empty.'
        );
    }


    console.log('');
    console.log(
        'Excel file saved successfully.'
    );

    console.log(
        `File: ${destination}`
    );

    console.log(
        `Size: ${stats.size} bytes`
    );
}


// ==========================================
// MAIN
// ==========================================

(async () => {

    let browser = null;

    try {

        const {
            fromDate,
            toDate
        } = parseArguments();


        validateDate(fromDate);
        validateDate(toDate);


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
            `Save Dir  : ${SAVE_DIR}`
        );

        console.log(
            'Browser   : Existing Chrome Session'
        );

        console.log(
            `CDP       : ${CDP_URL}`
        );


        fs.mkdirSync(
            SAVE_DIR,
            {
                recursive: true
            }
        );


        // ==================================
        // CONNECT TO EXISTING CHROME
        // ==================================

        console.log('');
        console.log(
            'Connecting to existing Chrome...'
        );


        browser =
            await chromium.connectOverCDP(
                CDP_URL
            );


        console.log(
            'Connected to existing Chrome.'
        );


        // ==================================
        // GET EXISTING CONTEXT
        // ==================================

        const contexts =
            browser.contexts();


        if (contexts.length === 0) {

            throw new Error(
                'No Chrome browser context was found.'
            );
        }


        const context =
            contexts[0];


        // ==================================
        // FIND EXISTING SALESFORCE TAB
        // ==================================

        let page =
            context
                .pages()
                .find(
                    p =>
                        p.url().includes(
                            'salesforce.com'
                        )
                );


        // If Salesforce tab isn't open,
        // use the first existing tab.

        if (!page) {

            const pages =
                context.pages();

            page =
                pages.length > 0
                    ? pages[0]
                    : await context.newPage();
        }


        console.log(
            `Using Chrome tab: ${page.url()}`
        );


        // ==================================
        // 1. OPEN SURVEY REPORT
        // ==================================

        await openSurveyReport(page);


        // ==================================
        // 2. FROM DATE
        // ==================================

        await selectDate(
            page,
            'From Date',
            fromDate
        );


        // ==================================
        // 3. TO DATE
        // ==================================

        await selectDate(
            page,
            'To Date',
            toDate
        );


        // ==================================
        // 4. GREEN SEARCH
        // ==================================

        await searchReport(page);


        // ==================================
        // 5. SELECT REPORT
        // ==================================

        await selectReport(page);


        // ==================================
        // 6. DOWNLOAD EXCEL
        // ==================================

        await downloadExcel(
            page,
            fromDate,
            toDate
        );


        console.log('');
        console.log('##########################################');
        console.log('# AUTOMATION COMPLETED SUCCESSFULLY');
        console.log('##########################################');

        console.log('');
        console.log(
            `Excel saved in: ${SAVE_DIR}`
        );


    }
    catch (error) {

        console.log('');
        console.log('##########################################');
        console.log('# AUTOMATION FAILED');
        console.log('##########################################');

        console.error(
            error.message
        );
    }


    finally {

        // IMPORTANT:
        // Do NOT close the browser.
        //
        // This is the user's existing Chrome
        // session. We leave it running.

        console.log('');
        console.log(
            'Leaving existing Chrome session open.'
        );
    }

})();