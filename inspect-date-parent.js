async page => {

    const target = "2026-08-01";

    const dialog = page.getByRole("dialog", {
        name: /Date picker/
    });

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

    const chain = await cell.evaluate(el => {

        const result = [];

        let node = el;

        for (let i = 0; i < 8 && node; i++, node = node.parentElement) {

            result.push({
                tag: node.tagName,
                role: node.getAttribute("role"),
                dataValue: node.getAttribute("data-value"),
                className: node.getAttribute("class"),
                ariaSelected: node.getAttribute("aria-selected"),
                ariaDisabled: node.getAttribute("aria-disabled"),
                outerHTML: node.outerHTML.substring(0, 1200)
            });
        }

        return result;
    });

    return {
        success: true,
        target: target,
        chain: chain
    };
}
