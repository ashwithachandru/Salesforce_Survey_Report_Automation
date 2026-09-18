async page => {

    const FROM_DATE = "2026-08-01";
    const TO_DATE = "2026-08-31";
    const REPORT_NAME = "Customer Complaints-Generic";

    const MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];

    function parseDate(value) {

        const p = value.split("-").map(Number);

        return {
            year: p[0],
            month: p[1] - 1,
            day: p[2]
        };
    }

    function expectedInputValue(dateString) {

        const d = parseDate(dateString);

        const day =
            String(d.day).padStart(2, "0");

        const month =
            MONTHS[d.month].substring(0, 3);

        return day + "-" + month + "-" + d.year;
    }

    async function openCalendar(buttonName) {

        const button =
            page.getByRole("button", {
                name: buttonName
            });

        if (await button.count() !== 1) {
            throw new Error(
                "Calendar button not found: " +
                buttonName
            );
        }

        await button.click({
            force: true
        });

        await page.waitForTimeout(500);

        const dialog =
            page.getByRole("dialog", {
                name: /Date picker/
            });

        if (await dialog.count() !== 1) {
            throw new Error(
                "Date picker did not open"
            );
        }

        return dialog;
    }

    async function getCalendarState(dialog) {

        const heading =
            dialog.getByRole("heading", {
                level: 2
            }).first();

        const monthName =
            (await heading.textContent()).trim();

        const yearElement =
            dialog.locator(
                'span[id^="year-selected-"]'
            ).first();

        const year =
            Number(
                (await yearElement.textContent()).trim()
            );

        return {
            monthName: monthName,
            monthIndex: MONTHS.indexOf(monthName),
            year: year
        };
    }

    async function goToMonth(
        dialog,
        targetDate
    ) {

        const target =
            parseDate(targetDate);

        for (let attempt = 0; attempt < 24; attempt++) {

            const state =
                await getCalendarState(dialog);

            if (
                state.year === target.year &&
                state.monthIndex === target.month
            ) {
                console.log(
                    "Calendar reached " +
                    state.monthName +
                    " " +
                    state.year
                );

                return;
            }

            const currentPosition =
                state.year * 12 +
                state.monthIndex;

            const targetPosition =
                target.year * 12 +
                target.month;

            if (targetPosition > currentPosition) {

                console.log("Clicking > Next Month");

                const next =
                    dialog.getByRole("button", {
                        name: "Next Month"
                    });

                await next.evaluate(
                    el => el.click()
                );

            } else {

                console.log("Clicking < Previous Month");

                const previous =
                    dialog.getByRole("button", {
                        name: "Previous Month"
                    });

                await previous.evaluate(
                    el => el.click()
                );
            }

            await page.waitForTimeout(400);
        }

        throw new Error(
            "Could not reach " + targetDate
        );
    }

    async function selectDate(
        inputName,
        calendarButtonName,
        targetDate
    ) {

        console.log(
            "--------------------------------"
        );

        console.log(
            "Selecting " +
            inputName +
            ": " +
            targetDate
        );

        const input =
            page.getByRole("textbox", {
                name: inputName
            });

        const expected =
            expectedInputValue(targetDate);

        const current =
            await input.inputValue();

        /*
         * If the requested date is already selected,
         * don't open the calendar again.
         */

        if (current === expected) {

            console.log(
                inputName +
                " already equals " +
                expected
            );

            return current;
        }

        let dialog =
            await openCalendar(
                calendarButtonName
            );

        await goToMonth(
            dialog,
            targetDate
        );

        /*
         * Salesforce puts the calendar popup at
         * left:-9999px.
         *
         * Move the popup into the visible viewport.
         */

        await dialog.evaluate(el => {

            el.style.setProperty(
                "position",
                "fixed",
                "important"
            );

            el.style.setProperty(
                "left",
                "100px",
                "important"
            );

            el.style.setProperty(
                "top",
                "100px",
                "important"
            );

            el.style.setProperty(
                "right",
                "auto",
                "important"
            );
        });

        await page.waitForTimeout(300);

        /*
         * IMPORTANT:
         * Exact date using Salesforce data-value.
         */

        const cell =
            dialog.locator(
                'td[data-value="' +
                targetDate +
                '"]'
            );

        if (await cell.count() !== 1) {
            throw new Error(
                "Date cell not found: " +
                targetDate
            );
        }

        const disabled =
            await cell.getAttribute(
                "aria-disabled"
            );

        if (disabled === "true") {
            throw new Error(
                "Date is disabled: " +
                targetDate
            );
        }

        console.log(
            "Clicking exact date: " +
            targetDate
        );

        await cell.click({
            force: true,
            timeout: 5000
        });

        await page.waitForTimeout(800);

        const after =
            await input.inputValue();

        console.log(
            inputName +
            " value: " +
            after
        );

        /*
         * Verify the requested date, rather than
         * requiring the value to be different.
         */

        if (after !== expected) {

            throw new Error(
                inputName +
                " has unexpected value. " +
                "Expected: " +
                expected +
                " | Actual: " +
                after
            );
        }

        return after;
    }

    // ============================================================
    // SURVEY REPORT
    // ============================================================

    const SURVEY_URL =
        "https://ramrajcotton--rrpartial.sandbox.lightning.force.com/lightning/n/SurveyReport";

    if (
        !page.url().includes(
            "/lightning/n/SurveyReport"
        )
    ) {

        await page.goto(
            SURVEY_URL,
            {
                waitUntil: "domcontentloaded"
            }
        );

        await page.waitForTimeout(1500);
    }

    await page.getByRole("heading", {
        name: "Survey Report",
        exact: true
    }).waitFor({
        state: "visible",
        timeout: 30000
    });

    console.log(
        "Survey Report loaded."
    );

    // ============================================================
    // FROM DATE
    // ============================================================

    await selectDate(
        "From Date",
        "Select a date for From Date",
        FROM_DATE
    );

    // ============================================================
    // TO DATE
    // ============================================================

    await selectDate(
        "To Date",
        "Select a date for To Date",
        TO_DATE
    );

    // ============================================================
    // SEARCH
    // ============================================================

    console.log(
        "Finding Survey Report Search button..."
    );

    /*
     * There are two Search buttons:
     *
     * Global Salesforce Search:
     * aria-label="Search"
     *
     * Survey Report Search:
     * slds-button_brand
     *
     * Target the branded button directly.
     */

    const searchButton =
        page.locator(
            'button.slds-button_brand'
        ).filter({
            hasText: "Search"
        });

    if (await searchButton.count() !== 1) {

        throw new Error(
            "Survey Report Search button not uniquely found. " +
            "Count: " +
            await searchButton.count()
        );
    }

    console.log(
        "Clicking Survey Report Search..."
    );

    await searchButton.click({
        force: true
    });

    await page.waitForTimeout(1500);

    // ============================================================
    // CUSTOMER COMPLAINTS-GENERIC
    // ============================================================

    console.log(
        "Looking for " +
        REPORT_NAME
    );

    const report =
        page.getByText(
            REPORT_NAME,
            {
                exact: true
            }
        ).first();

    if (await report.count() !== 1) {

        throw new Error(
            "Report not found: " +
            REPORT_NAME
        );
    }

    console.log(
        "Selecting " +
        REPORT_NAME
    );

    await report.click({
        force: true
    });

    await page.waitForTimeout(700);

    // ============================================================
    // DOWNLOAD EXCEL
    // ============================================================

    console.log(
        "Looking for Download Excel..."
    );

    const downloadButton =
        page.getByRole("button", {
            name: "Download Excel",
            exact: true
        });

    if (await downloadButton.count() !== 1) {

        throw new Error(
            "Download Excel button not found"
        );
    }

    console.log(
        "Clicking Download Excel..."
    );

    await downloadButton.click({
        force: true
    });

    await page.waitForTimeout(1500);

    return {
        success: true,
        fromDate: FROM_DATE,
        toDate: TO_DATE,
        report: REPORT_NAME,
        message: "Download Excel clicked successfully"
    };
}