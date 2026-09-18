require("dotenv").config();

const {
    chromium
} = require("playwright");

const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIG
// ============================================================

const SF_USERNAME = process.env.SF_USERNAME;
const SF_PASSWORD = process.env.SF_PASSWORD;
const SF_LOGIN_URL = process.env.SF_LOGIN_URL;

const REPORT_NAME = "Customer Complaints-Generic";

const BROWSER_PROFILE = path.resolve(
    __dirname,
    "browser-profile"
);

const SAVE_DIR = path.resolve(
    __dirname,
    "downloads"
);

// ============================================================
// ARGUMENTS
// ============================================================

function getArgument(name) {

    const index =
        process.argv.indexOf(name);

    if (
        index === -1 ||
        !process.argv[index + 1]
    ) {
        return null;
    }

    return process.argv[index + 1];
}

const fromDate =
    getArgument("--from");

const toDate =
    getArgument("--to");

// ============================================================
// VALIDATION
// ============================================================

function isValidDateString(value) {

    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

if (
    !fromDate ||
    !toDate ||
    !isValidDateString(fromDate) ||
    !isValidDateString(toDate)
) {

    console.log("");
    console.log(
        "Usage:"
    );

    console.log(
        "node download-survey-report.js --from YYYY-MM-DD --to YYYY-MM-DD"
    );

    process.exit(1);
}

if (!SF_USERNAME || !SF_PASSWORD) {

    throw new Error(
        "SF_USERNAME or SF_PASSWORD is missing from .env"
    );
}

fs.mkdirSync(
    SAVE_DIR,
    {
        recursive: true
    }
);

// ============================================================
// HELPERS
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

function normalizeDateText(value) {

    if (!value) {
        return null;
    }

    const text =
        value
            .trim()
            .replace(/\s+/g, " ");

    // Salesforce commonly returns:
    // 01-Aug-2026
    // 06-Sept-2026

    const match =
        text.match(
            /^(\d{1,2})[-\/]([A-Za-z]+)[-\/](\d{4})$/
        );

    if (!match) {
        return null;
    }

    const day =
        Number(match[1]);

    const monthText =
        match[2].toLowerCase();

    const year =
        Number(match[3]);

    const months = {

        jan: 1,
        january: 1,

        feb: 2,
        february: 2,

        mar: 3,
        march: 3,

        apr: 4,
        april: 4,

        may: 5,

        jun: 6,
        june: 6,

        jul: 7,
        july: 7,

        aug: 8,
        august: 8,

        sep: 9,
        sept: 9,
        september: 9,

        oct: 10,
        october: 10,

        nov: 11,
        november: 11,

        dec: 12,
        december: 12
    };

    const month =
        months[monthText];

    if (!month) {
        return null;
    }

    return (
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );
}

// ============================================================
// SALESFORCE LOGIN
// ============================================================

async function loginIfRequired(page) {

    console.log("");
    console.log("------------------------------------------");
    console.log("CHECKING SALESFORCE LOGIN");
    console.log("------------------------------------------");

    console.log(
        "Current page:",
        page.url()
    );

    // Give Salesforce time to redirect.
    await sleep(2000);

    const passwordInput =
        page.locator(
            'input[type="password"]'
        ).first();

    const passwordVisible =
        await passwordInput
            .isVisible()
            .catch(() => false);

    if (!passwordVisible) {

        console.log(
            "Salesforce login form not visible."
        );

        console.log(
            "Assuming existing session is available."
        );

        return;
    }

    console.log(
        "Salesforce login page detected."
    );

    console.log(
        "Entering username and password..."
    );

    const usernameInput =
        page.locator(
            'input[name="username"], input[type="email"]'
        ).first();

    await usernameInput.waitFor({
        state: "visible",
        timeout: 30000
    });

    await usernameInput.fill(
        SF_USERNAME
    );

    await passwordInput.fill(
        SF_PASSWORD
    );

    console.log(
        "Credentials entered."
    );

    const loginButton =
        page.getByRole(
            "button",
            {
                name: /log in/i
            }
        ).first();

    if (
        await loginButton.count()
    ) {

        await loginButton.click();

    } else {

        const submit =
            page.locator(
                'input[type="submit"]'
            ).first();

        await submit.click();
    }

    console.log(
        "Login submitted."
    );

    await sleep(3000);

    // IMPORTANT:
    // We do NOT automate OTP.
    const bodyText =
        await page.locator("body")
            .innerText()
            .catch(() => "");

    if (
        /verification code|one[- ]time password|enter.*code|security code|otp/i
            .test(bodyText)
    ) {

        throw new Error(
            "Salesforce is asking for an OTP/verification code. OTP automation is intentionally disabled."
        );
    }

    await page.waitForLoadState(
        "domcontentloaded",
        {
            timeout: 30000
        }
    ).catch(() => {});

    console.log(
        "Salesforce login completed."
    );

    console.log(
        "Current page:",
        page.url()
    );
}

// ============================================================
// APP LAUNCHER
// ============================================================

async function openSurveyReportFromAppLauncher(page) {

    console.log("");
    console.log("------------------------------------------");
    console.log("OPENING SURVEY REPORT");
    console.log("------------------------------------------");

    // --------------------------------------------------------
    // Find the 9-dot App Launcher
    // --------------------------------------------------------

    const appLauncher =
        page.getByRole(
            "button",
            {
                name: /App Launcher/i
            }
        ).first();

    await appLauncher.waitFor({
        state: "visible",
        timeout: 30000
    });

    console.log(
        "App Launcher found."
    );

    await appLauncher.click();

    console.log(
        "App Launcher opened."
    );

    await sleep(1000);

    // --------------------------------------------------------
    // Find App Launcher search box
    // --------------------------------------------------------

    const searchCandidates = [

        page.locator(
            'input[placeholder*="Search apps and items" i]'
        ).first(),

        page.locator(
            'input[placeholder*="Search" i]'
        ).first(),

        page.getByRole(
            "combobox",
            {
                name: /Search/i
            }
        ).first()
    ];

    let searchInput = null;

    for (
        const candidate of searchCandidates
    ) {

        if (
            await candidate.count()
        ) {

            if (
                await candidate
                    .isVisible()
                    .catch(() => false)
            ) {

                searchInput =
                    candidate;

                break;
            }
        }
    }

    if (!searchInput) {

        throw new Error(
            "Could not find App Launcher search box."
        );
    }

    console.log(
        'Typing "Survey Report"...'
    );

    await searchInput.fill(
        "Survey Report"
    );

    await sleep(2000);

    // --------------------------------------------------------
    // Select Survey Report
    // --------------------------------------------------------

    const surveyReport =
        page.getByText(
            "Survey Report",
            {
                exact: true
            }
        ).last();

    await surveyReport.waitFor({
        state: "visible",
        timeout: 20000
    });

    console.log(
        'Found "Survey Report".'
    );

    await surveyReport.click();

    console.log(
        'Clicked "Survey Report".'
    );

    await page.waitForLoadState(
        "domcontentloaded",
        {
            timeout: 30000
        }
    ).catch(() => {});

    await sleep(2000);

    console.log(
        "Current page:",
        page.url()
    );

    // Verify that we reached Survey Report.
    if (
        !page.url()
            .toLowerCase()
            .includes("surveyreport")
    ) {

        // Sometimes Salesforce needs another moment.
        await sleep(3000);
    }

    console.log(
        "Survey Report page opened."
    );
}

// ============================================================
// FIND DATE INPUT
// ============================================================

async function findDateInput(
    page,
    labelText
) {

    const roleInput =
        page.getByRole(
            "textbox",
            {
                name: labelText,
                exact: true
            }
        ).first();

    if (
        await roleInput.count()
    ) {

        await roleInput.waitFor({
            state: "visible",
            timeout: 15000
        });

        return roleInput;
    }

    const label =
        page.locator("label")
            .filter({
                hasText: labelText
            })
            .first();

    await label.waitFor({
        state: "visible",
        timeout: 15000
    });

    const inputId =
        await label.getAttribute("for");

    if (!inputId) {

        throw new Error(
            `${labelText} label has no "for" attribute.`
        );
    }

    const input =
        page.locator(
            `#${inputId}`
        );

    await input.waitFor({
        state: "visible",
        timeout: 15000
    });

    return input;
}

// ============================================================
// OPEN DATE PICKER
// ============================================================

async function openDatePicker(
    page,
    labelText,
    input
) {

    const dateButton =
        page.getByRole(
            "button",
            {
                name:
                    new RegExp(
                        `Select a date for ${labelText}`,
                        "i"
                    )
            }
        ).first();

    if (
        await dateButton.count()
    ) {

        if (
            await dateButton
                .isVisible()
                .catch(() => false)
        ) {

            await dateButton.click();

        } else {

            await input.click();
        }

    } else {

        await input.click();
    }

    const calendar =
        page.locator(
            '.slds-datepicker[role="dialog"]'
        ).last();

    await calendar.waitFor({
        state: "visible",
        timeout: 15000
    });

    return calendar;
}

// ============================================================
// SELECT DATE
// ============================================================

async function selectDate(
    page,
    labelText,
    targetDate
) {

    console.log("");
    console.log(
        `Selecting ${labelText}: ${targetDate}`
    );

    const input =
        await findDateInput(
            page,
            labelText
        );

    console.log(
        `${labelText} input found: #${await input.getAttribute("id")}`
    );

    for (
        let attempt = 0;
        attempt < 24;
        attempt++
    ) {

        const calendar =
            await openDatePicker(
                page,
                labelText,
                input
            );

        const cells =
            calendar.locator(
                'td[role="gridcell"][data-value]'
            );

        const count =
            await cells.count();

        let minDate = null;
        let maxDate = null;
        let targetCell = null;

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const cell =
                cells.nth(i);

            const value =
                await cell.getAttribute(
                    "data-value"
                );

            if (!value) {
                continue;
            }

            if (!minDate || value < minDate) {
                minDate = value;
            }

            if (!maxDate || value > maxDate) {
                maxDate = value;
            }

            if (
                value === targetDate
            ) {

                targetCell =
                    cell;

                break;
            }
        }

        if (targetCell) {

            console.log(
                `FOUND ${targetDate} in calendar.`
            );

            const button =
                targetCell.locator(
                    "button"
                ).first();

            if (
                await button.count()
            ) {

                await button.click();

            } else {

                await targetCell.click();
            }

            await sleep(500);

            const actualValue =
                await input.inputValue();

            console.log(
                `${labelText} selected value: ${actualValue}`
            );

            const normalized =
                normalizeDateText(
                    actualValue
                );

            if (
                normalized === targetDate
            ) {

                console.log(
                    `${labelText} confirmed: ${targetDate}`
                );

                return;
            }

            // Salesforce may update the value asynchronously.
            await sleep(1000);

            const retryValue =
                await input.inputValue();

            const retryNormalized =
                normalizeDateText(
                    retryValue
                );

            if (
                retryNormalized === targetDate
            ) {

                console.log(
                    `${labelText} confirmed: ${targetDate}`
                );

                return;
            }

            throw new Error(
                `${labelText} did not update correctly. Current value: "${retryValue}"`
            );
        }

        // ----------------------------------------------------
        // Navigate calendar based on REAL data-value dates.
        // We intentionally do NOT inspect displayed month text.
        // ----------------------------------------------------

        if (
            minDate &&
            targetDate < minDate
        ) {

            console.log(
                "Target is earlier -> Previous Month"
            );

            const previousButton =
                calendar.getByRole(
                    "button",
                    {
                        name: /Previous Month/i
                    }
                ).first();

            await previousButton.click();

            await sleep(300);

            continue;
        }

        if (
            maxDate &&
            targetDate > maxDate
        ) {

            console.log(
                "Target is later -> Next Month"
            );

            const nextButton =
                calendar.getByRole(
                    "button",
                    {
                        name: /Next Month/i
                    }
                ).first();

            await nextButton.click();

            await sleep(300);

            continue;
        }

        throw new Error(
            `Could not locate ${targetDate} in Salesforce calendar.`
        );
    }

    throw new Error(
        `Could not select ${labelText}: ${targetDate}`
    );
}

// ============================================================
// SEARCH
// ============================================================

async function searchReport(page) {

    console.log("");
    console.log("------------------------------------------");
    console.log("SEARCH");
    console.log("------------------------------------------");

    // IMPORTANT:
    // We DO NOT interact with Checklist Template.
    // We only click the Search button.

    const searchButton =
        page.getByRole(
            "button",
            {
                name: "Search",
                exact: true
            }
        ).first();

    await searchButton.waitFor({
        state: "visible",
        timeout: 20000
    });

    if (
        !(await searchButton.isEnabled())
    ) {

        throw new Error(
            "Search button is visible but disabled."
        );
    }

    console.log(
        "Clicking Search..."
    );

    await searchButton.click();

    console.log(
        "Search clicked."
    );

    await sleep(2000);
}

// ============================================================
// SELECT REPORT
// ============================================================

async function selectReport(page) {

    console.log("");
    console.log("------------------------------------------");
    console.log(
        `SELECTING: ${REPORT_NAME}`
    );
    console.log("------------------------------------------");

    const report =
        page.getByText(
            REPORT_NAME,
            {
                exact: true
            }
        ).last();

    await report.waitFor({
        state: "visible",
        timeout: 30000
    });

    console.log(
        `Report found: ${REPORT_NAME}`
    );

    await report.click();

    console.log(
        "Report selected."
    );

    await sleep(1500);
}

// ============================================================
// DOWNLOAD EXCEL
// ============================================================

async function downloadExcel(
    page,
    fromDate,
    toDate
) {

    console.log("");
    console.log("------------------------------------------");
    console.log("DOWNLOAD EXCEL");
    console.log("------------------------------------------");

    const downloadButton =
        page.getByRole(
            "button",
            {
                name: "Download Excel",
                exact: true
            }
        ).first();

    await downloadButton.waitFor({
        state: "visible",
        timeout: 30000
    });

    if (
        !(await downloadButton.isEnabled())
    ) {

        throw new Error(
            "Download Excel button is visible but disabled."
        );
    }

    console.log(
        "Download Excel button found and enabled."
    );

    const downloadPromise =
        page.waitForEvent(
            "download",
            {
                timeout: 60000
            }
        );

    await downloadButton.click();

    const download =
        await downloadPromise;

    const safeReportName =
        REPORT_NAME.replace(
            /[<>:"/\\|?*]/g,
            "_"
        );

    const filename =
        `${safeReportName}_${fromDate}_to_${toDate}.xlsx`;

    const destination =
        path.join(
            SAVE_DIR,
            filename
        );

    await download.saveAs(
        destination
    );

    const stats =
        fs.statSync(
            destination
        );

    console.log("");
    console.log("==========================================");
    console.log("DOWNLOAD SUCCESSFUL");
    console.log("==========================================");

    console.log(
        "File:",
        filename
    );

    console.log(
        "Location:",
        destination
    );

    console.log(
        "Size:",
        stats.size,
        "bytes"
    );

    return destination;
}

// ============================================================
// MAIN
// ============================================================

(async () => {

    console.log("");
    console.log("##########################################");
    console.log("# SALESFORCE SURVEY REPORT DOWNLOADER");
    console.log("##########################################");
    console.log("");

    console.log(
        "From Date :",
        fromDate
    );

    console.log(
        "To Date   :",
        toDate
    );

    console.log(
        "Report    :",
        REPORT_NAME
    );

    console.log(
        "Save Dir  :",
        SAVE_DIR
    );

    console.log(
        "Browser   :",
        BROWSER_PROFILE
    );

    console.log("");

    let context = null;

    try {

        // ----------------------------------------------------
        // Launch Google Chrome using the dedicated automation
        // profile.
        // ----------------------------------------------------

        console.log(
            "Launching Google Chrome..."
        );

        context =
            await chromium.launchPersistentContext(
                BROWSER_PROFILE,
                {
                    channel: "chrome",

                    headless: false,

                    acceptDownloads: true,

                    viewport: {
                        width: 1440,
                        height: 900
                    },

                    args: [
                        "--start-minimized"
                    ]
                }
            );

        let pages =
            context.pages();

        let page =
            pages.length
                ? pages[0]
                : await context.newPage();

        // ----------------------------------------------------
        // Open Salesforce.
        // ----------------------------------------------------

        console.log(
            "Opening Salesforce..."
        );

        await page.goto(
            SF_LOGIN_URL,
            {
                waitUntil: "domcontentloaded",
                timeout: 60000
            }
        );

        await loginIfRequired(
            page
        );

        // ----------------------------------------------------
        // App Launcher -> Survey Report
        // ----------------------------------------------------

        await openSurveyReportFromAppLauncher(
            page
        );

        // ----------------------------------------------------
        // Dates
        // ----------------------------------------------------

        await selectDate(
            page,
            "From Date",
            fromDate
        );

        await selectDate(
            page,
            "To Date",
            toDate
        );

        // ----------------------------------------------------
        // Search
        // ----------------------------------------------------

        await searchReport(
            page
        );

        // ----------------------------------------------------
        // Select report
        // ----------------------------------------------------

        await selectReport(
            page
        );

        // ----------------------------------------------------
        // Download
        // ----------------------------------------------------

        await downloadExcel(
            page,
            fromDate,
            toDate
        );

        console.log("");
        console.log(
            "##########################################"
        );

        console.log(
            "# DONE"
        );

        console.log(
            "##########################################"
        );

        console.log("");

        // Leave Chrome open/minimized.
        // This keeps the Salesforce session available
        // for the next run.

        console.log(
            "Chrome left open/minimized."
        );

    } catch (error) {

        console.log("");
        console.log(
            "##########################################"
        );

        console.log(
            "# AUTOMATION FAILED"
        );

        console.log(
            "##########################################"
        );

        console.log("");

        console.error(
            error.message
        );

        if (context) {

            try {

                const pages =
                    context.pages();

                if (pages.length) {

                    const errorScreenshot =
                        path.join(
                            SAVE_DIR,
                            "automation-error.png"
                        );

                    await pages[0]
                        .screenshot({
                            path: errorScreenshot,
                            fullPage: true
                        });

                    console.log("");
                    console.log(
                        "Error screenshot:"
                    );

                    console.log(
                        errorScreenshot
                    );
                }

            } catch (_) {}
        }

        process.exitCode = 1;

    } finally {

        // IMPORTANT:
        // We intentionally do NOT close Chrome.
        //
        // The persistent profile keeps the Salesforce session.
        // Chrome remains minimized/background after the run.
    }

})();