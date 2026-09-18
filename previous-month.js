async page => {
    const button = page.getByRole('button', {
        name: 'Previous Month'
    });

    await button.waitFor({ state: 'attached', timeout: 10000 });

    await button.evaluate(el => el.click());

    await page.waitForTimeout(700);

    const dates = await page.getByRole('gridcell').evaluateAll(
        cells => cells.map(cell => cell.getAttribute('data-value'))
    );

    return dates;
}