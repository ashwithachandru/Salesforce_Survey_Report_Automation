async page => {
    const target = "2026-09-08";

    const cell = page.locator('td[data-value="' + target + '"]');

    if (await cell.count() === 0) {
        throw new Error("Date cell not found: " + target);
    }

    console.log("FOUND:", await cell.count());

    console.log(
        "HTML:",
        await cell.first().evaluate(el => el.outerHTML)
    );

    const before = await page
        .getByRole("textbox", { name: "From Date" })
        .inputValue();

    console.log("BEFORE:", before);

    // Scroll the exact cell into view.
    await cell.first().scrollIntoViewIfNeeded();

    // Get the actual center coordinates.
    const box = await cell.first().boundingBox();

    console.log("BOX:", box);

    if (!box) {
        throw new Error("No bounding box for date cell.");
    }

    // Dispatch pointer/mouse events on the actual date cell.
    await cell.first().evaluate(el => {
        el.dispatchEvent(new PointerEvent("pointerdown", {
            bubbles: true,
            composed: true,
            pointerType: "mouse",
            button: 0
        }));

        el.dispatchEvent(new MouseEvent("mousedown", {
            bubbles: true,
            composed: true,
            button: 0
        }));

        el.dispatchEvent(new PointerEvent("pointerup", {
            bubbles: true,
            composed: true,
            pointerType: "mouse",
            button: 0
        }));

        el.dispatchEvent(new MouseEvent("mouseup", {
            bubbles: true,
            composed: true,
            button: 0
        }));

        el.dispatchEvent(new MouseEvent("click", {
            bubbles: true,
            composed: true,
            button: 0
        }));
    });

    await page.waitForTimeout(1000);

    const after = await page
        .getByRole("textbox", { name: "From Date" })
        .inputValue();

    console.log("AFTER:", after);

    const selected = await cell.first().getAttribute("aria-selected");

    console.log("ARIA SELECTED:", selected);

    if (!after) {
        console.log("DATE WAS NOT SELECTED");
    } else {
        console.log("SUCCESS:", after);
    }
}
