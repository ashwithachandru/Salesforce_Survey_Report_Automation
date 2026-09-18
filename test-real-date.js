async page => {

    const target = "2026-08-01";

    const dialog = page.getByRole("dialog", {
        name: /Date picker/
    });

    if (await dialog.count() === 0) {
        return {
            success: false,
            error: "Calendar is not open"
        };
    }

    const cell = dialog.locator(
        'td[data-value="' + target + '"]'
    );

    if (await cell.count() !== 1) {
        return {
            success: false,
            error: "Date cell not found",
            target: target
        };
    }

    const input = page.getByRole("textbox", {
        name: "From Date"
    });

    const before = await input.inputValue();

    const box = await cell.boundingBox();

    if (!box) {
        return {
            success: false,
            error: "Could not get date cell coordinates",
            target: target
        };
    }

    await page.mouse.click(
        box.x + box.width / 2,
        box.y + box.height / 2
    );

    await page.waitForTimeout(1000);

    const after = await input.inputValue();

    return {
        success: true,
        target: target,
        before: before,
        after: after,
        box: box,
        calendarOpen:
            await page.getByRole("dialog", {
                name: /Date picker/
            }).count() > 0
    };
}
