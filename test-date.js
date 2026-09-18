async page => {
    const target = '2026-08-01';

    const cell = page.locator('[data-value="' + target + '"]');

    if (await cell.count()) {
        await cell.first().click();
        return 'Clicked ' + target;
    }

    return 'Target not currently visible';
}