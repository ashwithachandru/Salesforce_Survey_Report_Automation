async page => {

    const imageUrl = "https://ramrajcotton--rrpartial.sandbox.my.salesforce.com/sfc/servlet.shepherd/version/download/068Bh000005U1S3IAK";

    console.log(
        "CURRENT_PAGE=" +
        await page.url()
    );

    const context =
        page.context();

    console.log(
        "OPENING_IMAGE_IN_NEW_TAB"
    );

    let newPage = null;

    try {

        newPage =
            await context.newPage();

    } catch (e) {

        throw new Error(
            "Could not create a new browser tab: " +
            e.message
        );
    }

    let download = null;

    let response = null;

    let downloadError = null;

    let responseError = null;

    /*
     * Start waiting for a browser download.
     */

    const downloadPromise =
        newPage.waitForEvent(
            "download",
            {
                timeout: 30000
            }
        ).catch(
            error => {
                downloadError = error;
                return null;
            }
        );

    /*
     * Navigate the new browser tab.
     */

    try {

        response =
            await newPage.goto(
                imageUrl,
                {
                    waitUntil: "domcontentloaded",
                    timeout: 60000
                }
            );

    } catch (e) {

        responseError =
            e.message;

        console.log(
            "NEW_TAB_NAVIGATION_ERROR=" +
            e.message
        );
    }

    /*
     * Give Salesforce time to initiate a download
     * if it is going through a redirect.
     */

    download =
        await downloadPromise;

    /*
     * --------------------------------------------------------
     * CASE 1: Browser download
     * --------------------------------------------------------
     */

    if (download) {

        console.log(
            "BROWSER_DOWNLOAD_DETECTED"
        );

        const downloadPath =
            await download.path();

        if (!downloadPath) {

            throw new Error(
                "Salesforce download detected but no temporary file was provided."
            );
        }

        const fs =
            require("fs");

        const body =
            fs.readFileSync(
                downloadPath
            );

        if (
            !body ||
            body.length === 0
        ) {

            throw new Error(
                "Salesforce browser download was empty."
            );
        }

        return JSON.stringify({
            success: true,
            mode: "download",
            suggestedFilename:
                download.suggestedFilename(),
            size:
                body.length,
            base64:
                body.toString("base64")
        });
    }

    /*
     * --------------------------------------------------------
     * CASE 2: Direct HTTP image response
     * --------------------------------------------------------
     */

    if (response) {

        const status =
            response.status();

        const headers =
            response.headers();

        const contentType =
            headers["content-type"] || "";

        const finalUrl =
            response.url();

        console.log(
            "IMAGE_HTTP_STATUS=" +
            status
        );

        console.log(
            "IMAGE_CONTENT_TYPE=" +
            contentType
        );

        console.log(
            "IMAGE_FINAL_URL=" +
            finalUrl
        );

        if (
            contentType
                .toLowerCase()
                .startsWith("image/")
        ) {

            const body =
                await response.body();

            if (
                body &&
                body.length > 0
            ) {

                return JSON.stringify({
                    success: true,
                    mode: "response",
                    status:
                        status,
                    contentType:
                        contentType,
                    finalUrl:
                        finalUrl,
                    size:
                        body.length,
                    base64:
                        body.toString("base64")
                });
            }
        }

        /*
         * If it was HTML, capture enough diagnostic
         * information to determine what Salesforce
         * redirected to.
         */

        let text =
            "";

        try {

            text =
                await response.text();

        } catch {
            text = "";
        }

        return JSON.stringify({
            success: false,
            mode: "html",
            status:
                status,
            contentType:
                contentType,
            finalUrl:
                finalUrl,
            html:
                text.substring(
                    0,
                    3000
                )
        });
    }

    /*
     * --------------------------------------------------------
     * CASE 3: No response and no download
     * --------------------------------------------------------
     */

    let currentUrl =
        "";

    let currentTitle =
        "";

    try {

        currentUrl =
            await newPage.url();

        currentTitle =
            await newPage.title();

    } catch {
        // Ignore.
    }

    return JSON.stringify({
        success: false,
        mode: "no-response",
        currentUrl:
            currentUrl,
        currentTitle:
            currentTitle,
        navigationError:
            responseError || ""
    });
}
