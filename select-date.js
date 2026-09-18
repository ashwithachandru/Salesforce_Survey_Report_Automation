async page => {
    const target = '2026-08-01';
    const inputName = 'From Date';

    // Open the date picker
    const pickerButton = page.getByRole('button', {
        name: `Select a date for ${inputName}`
    });

    await pickerButton.click({ force: true });

    await page.waitForTimeout(300);

    // Try up to 24 months
    for (let i = 0; i < 24; i++) {

        // Get actual dates from the calendar HTML
        const dates = await page.getByRole('gridcell').evaluateAll(
            cells => cells
                .map(cell => cell.getAttribute('data-value'))
                .filter(Boolean)
        );

        // Check whether target date exists
        const targetCell = page.locator(
            `[data-value="${target}"]`
        );

        if (await targetCell.count() > 0) {

            // Click the exact date using DOM click
            await targetCell.first().evaluate(
                el => el.click()
            );

            await page.waitForTimeout(300);

            // Verify From Date input
            const value = await page
                .getByRole('textbox', { name: inputName })
                .inputValue();

            return {
                success: true,
                target: target,
                inputValue: value,
                message: `Selected ${target}`
            };
        }

        if (dates.length === 0) {
            throw new Error('No calendar dates found.');
        }

        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];

        // Target is before current calendar
        if (target < minDate) {

            const previous = page.getByRole('button', {
                name: 'Previous Month'
            });

            await previous.waitFor({
                state: 'attached',
                timeout: 10000
            });

            await previous.evaluate(
                el => el.click()
            );

            await page.waitForTimeout(400);

            continue;
        }

        // Target is after current calendar
        if (target > maxDate) {

            const next = page.getByRole('button', {
                name: 'Next Month'
            });

            await next.waitFor({
                state: 'attached',
                timeout: 10000
            });

            await next.evaluate(
                el => el.click()
            );

            await page.waitForTimeout(400);

            continue;
        }

        throw new Error(
            `Target ${target} is not found in the calendar.`
        );
    }

    throw new Error(
        `Could not select ${target} after 24 attempts.`
    );
}