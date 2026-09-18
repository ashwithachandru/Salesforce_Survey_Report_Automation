async page => {
    const dialog = page.getByRole("dialog", {
        name: /Date picker/
    });

    const dialogCount = await dialog.count();

    if (dialogCount === 0) {
        return {
            success: false,
            error: "Calendar dialog is not open."
        };
    }

    const grid = dialog.getByRole("grid").first();

    const cells = grid.getByRole("gridcell");

    const count = await cells.count();

    const result = [];

    for (let i = 0; i < count; i++) {
        const cell = cells.nth(i);

        result.push({
            index: i,
            text: (await cell.innerText()).trim(),
            dataValue: await cell.getAttribute("data-value"),
            ariaCurrent: await cell.getAttribute("aria-current"),
            ariaSelected: await cell.getAttribute("aria-selected"),
            ariaDisabled: await cell.getAttribute("aria-disabled"),
            className: await cell.getAttribute("class")
        });
    }

    return {
        success: true,
        dialogCount,
        gridCount: await grid.count(),
        cellCount: count,
        cells: result
    };
}
