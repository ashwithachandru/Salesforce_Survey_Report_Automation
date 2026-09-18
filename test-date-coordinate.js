async page => {
    const target = "2026-09-08";

    console.log("Looking for:", target);

    const result = await page.evaluate(target => {
        const cell = document.querySelector(
            'td[data-value="' + target + '"]'
        );

        if (!cell) {
            return {
                ok: false,
                error: "Date cell not found"
            };
        }

        const rect = cell.getBoundingClientRect();

        return {
            ok: true,
            html: cell.outerHTML,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: rect.width,
            height: rect.height
        };
    }, target);

    console.log("DOM result:", result);

    if (!result.ok) {
        throw new Error(result.error);
    }

    const before = await page
        .getByRole("textbox", { name: "From Date" })
        .inputValue();

    console.log("BEFORE:", before);

    console.log(
        "Clicking coordinates:",
        result.x,
        result.y
    );

    // Fresh coordinate-based mouse click.
    await page.mouse.click(result.x, result.y);

    await page.waitForTimeout(1000);

    const after = await page
        .getByRole("textbox", { name: "From Date" })
        .inputValue();

    console.log("AFTER:", after);

    if (after) {
        console.log("SUCCESS:", after);
    } else {
        console.log("DATE NOT SELECTED");
    }
}
