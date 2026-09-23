
async page => {

    const imageUrl =
        "https://ramrajcotton--rrpartial.sandbox.my.salesforce.com/sfc/servlet.shepherd/version/download/068Bh000005U1S3IAK";

    console.log(
        "Opening Salesforce image URL..."
    );

    try {

        await page.goto(
            imageUrl,
            {
                waitUntil: "commit",
                timeout: 30000
            }
        );

    }
    catch (error) {

        console.log(
            "Salesforce download navigation triggered."
        );

        console.log(
            error.message
        );
    }

    console.log(
        "Salesforce image URL processed."
    );
}
