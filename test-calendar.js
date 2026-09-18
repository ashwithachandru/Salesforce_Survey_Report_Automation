async page => {
  const button = page.getByRole("button", {
    name: "Select a date for From Date"
  });

  await button.evaluate(el => el.click());

  await page.waitForTimeout(500);

  return await page.locator("td[data-value]").count();
}