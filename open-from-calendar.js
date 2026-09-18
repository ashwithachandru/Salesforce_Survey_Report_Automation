async page => {
    const button = page.getByRole("button", {
        name: "Select a date for From Date"
    });

    if (await button.count() !== 1) {
        return {
            success: false,
            error: "From Date calendar button not found",
            count: await button.count()
        };
    }

    await button.click({ force: true });
    await page.waitForTimeout(500);

    return {
        success: true,
        calendarOpen:
            await page.getByRole("dialog", {
                name: /Date picker/
            }).count() > 0
    };
}
