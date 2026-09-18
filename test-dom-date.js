async page => {
    const target = '2026-08-01';

    const cell = page.locator(
        `[data-value="${target}"]`
    ).first();

    if (await cell.count() === 0) {
        throw new Error(`Date ${target} not found`);
    }

    // Get the exact element information before clicking
    const before = await cell.evaluate(el => ({
        outerHTML: el.outerHTML,
        ariaSelected: el.getAttribute('aria-selected')
    }));

    // DOM click — avoids the viewport problem
    await cell.evaluate(el => el.click());

    await page.waitForTimeout(1000);

    const input = page.getByRole('textbox', {
        name: 'From Date'
    });

    const after = await cell.evaluate(el => ({
        ariaSelected: el.getAttribute('aria-selected')
    })).catch(() => ({
        ariaSelected: 'cell disappeared'
    }));

    return {
        before,
        after,
        inputValue: await input.inputValue(),
        calendarOpen: await page
            .getByRole('dialog')
            .count() > 0
    };
}