async page => {
    const target = '2026-08-01';

    const cell = page.locator(
        `[data-value="${target}"]`
    ).first();

    if (await cell.count() === 0) {
        return {
            found: false,
            message: `Could not find ${target}`
        };
    }

    return await cell.evaluate(el => ({
        found: true,
        tagName: el.tagName,
        outerHTML: el.outerHTML,
        innerHTML: el.innerHTML,
        text: el.innerText,
        role: el.getAttribute('role'),
        dataValue: el.getAttribute('data-value'),
        className: el.className
    }));
}