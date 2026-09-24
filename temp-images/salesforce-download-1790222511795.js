
async page => {

    const imageUrl =
        "https://ramrajcotton--rrpartial.sandbox.my.salesforce.com/sfc/servlet.shepherd/version/download/068Bh000005U1S3IAK";

    const outputFile =
        "D:\\Ramraj_Intern\\salesforce-survey-downloader\\temp-images\\survey-image-1.jpg";

    console.log("");
    console.log("========================================");
    console.log(" SALESFORCE BROWSER DOWNLOAD");
    console.log("========================================");

    console.log("");
    console.log("Current Salesforce page:");
    console.log(
        await page.url()
    );

    console.log("");
    console.log("Salesforce image URL:");
    console.log(imageUrl);

    console.log("");
    console.log("Starting download listener...");


    // --------------------------------------------------------
    // LISTEN FOR DOWNLOAD BEFORE OPENING URL
    // --------------------------------------------------------

    const downloadPromise =
        page.waitForEvent(
            "download",
            {
                timeout: 60000
            }
        );


    // --------------------------------------------------------
    // OPEN SHEPHERD DOWNLOAD URL
    // --------------------------------------------------------

    console.log("");
    console.log("Opening Salesforce image URL...");


    try {

        await page.goto(
            imageUrl,
            {
                waitUntil: "commit",
                timeout: 60000
            }
        );

        console.log("");
        console.log(
            "Salesforce navigation completed."
        );

    } catch (error) {

        console.log("");
        console.log(
            "Navigation returned:"
        );

        console.log(
            error.message
        );

        console.log("");
        console.log(
            "Waiting for download event..."
        );
    }


    // --------------------------------------------------------
    // WAIT FOR DOWNLOAD
    // --------------------------------------------------------

    const download =
        await downloadPromise;


    console.log("");
    console.log(
        "Salesforce download event received."
    );


    // --------------------------------------------------------
    // DOWNLOAD INFORMATION
    // --------------------------------------------------------

    console.log("");
    console.log(
        "Suggested filename:"
    );

    console.log(
        download.suggestedFilename()
    );


    const failure =
        await download.failure();


    if (failure) {

        throw new Error(
            "Salesforce download failed: " +
            failure
        );
    }


    // --------------------------------------------------------
    // SAVE FILE
    // --------------------------------------------------------

    console.log("");
    console.log(
        "Saving downloaded file..."
    );

    await download.saveAs(
        outputFile
    );


    console.log("");
    console.log(
        "Download saved:"
    );

    console.log(
        outputFile
    );


    // --------------------------------------------------------
    // VERIFY FILE
    // --------------------------------------------------------

    const nodeFs =
        require("fs");


    if (
        !nodeFs.existsSync(
            outputFile
        )
    ) {

        throw new Error(
            "Download completed but output file was not created."
        );
    }


    const stats =
        nodeFs.statSync(
            outputFile
        );


    console.log("");
    console.log(
        "Downloaded file size:"
    );

    console.log(
        stats.size
    );


    if (
        stats.size === 0
    ) {

        throw new Error(
            "Salesforce downloaded an empty file."
        );
    }


    console.log("");
    console.log(
        "SALESFORCE_DOWNLOAD_SUCCESS"
    );
}
