
await (async page => {

    const imageUrl = "https://ramrajcotton--rrpartial.sandbox.my.salesforce.com/sfc/servlet.shepherd/version/download/068Bh000005U1S3IAK";

    console.log("");
    console.log("========================================");
    console.log(" SALESFORCE IMAGE");
    console.log("========================================");

    console.log("");
    console.log("Current page:");
    console.log(await page.url());

    console.log("");
    console.log("Opening image URL:");
    console.log(imageUrl);

    try {

        await page.goto(
            imageUrl,
            {
                waitUntil: "commit",
                timeout: 60000
            }
        );

        console.log("");
        console.log("Salesforce image URL opened.");

    } catch (error) {

        console.log("");
        console.log("Navigation message:");
        console.log(error.message);

        console.log("");
        console.log(
            "The browser may have started the download."
        );
    }

    console.log("");
    console.log("Salesforce image request completed.");

})(page);
