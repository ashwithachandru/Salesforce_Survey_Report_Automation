async page => {
    const target = '2026-08-01';

    const cell = page.locator(
        `[data-value="${target}"]`
    ).first();

    if (await cell.count() === 0) {
        throw new Error(`Date cell ${target} not found`);
    }

    // Try a real Playwright click on the exact TD
    await cell.click({ force: true });

    await page.waitForTimeout(500);

    const input = page.getByRole('textbox', {
        name: 'From Date'
    });

    return {
        inputValue: await input.inputValue(),
        calendarStillOpen: await page
            .getByRole('dialog', {
                name: 'Date picker: August'
            })
            .count() > 0,
        cellSelected: await cell.getAttribute('aria-selected')
    };
}