
async page => {

    const imageUrl =
        "https://ramrajcotton--rrpartial.sandbox.my.salesforce.com/sfc/servlet.shepherd/version/download/068Bh000005U1S3IAK";

    console.log("");
    console.log("========================================");
    console.log("SALESFORCE IMAGE REQUEST");
    console.log("========================================");

    console.log("");
    console.log("URL:");
    console.log(imageUrl);

    console.log("");
    console.log("Current browser page:");
    console.log(await page.url());

    console.log("");
    console.log("Attempting authenticated request...");

    // --------------------------------------------------------
    // CHECK THAT REQUEST CONTEXT EXISTS
    // --------------------------------------------------------

    const context =
        page.context();

    if (!context) {

        throw new Error(
            "Playwright page.context() is unavailable."
        );
    }

    console.log(
        "Browser context available."
    );

    console.log("");
    console.log(
        "Checking page.context().request..."
    );

    const requestContext =
        context.request;

    if (!requestContext) {

        throw new Error(
            "page.context().request is NOT available in this Playwright CLI session."
        );
    }

    console.log(
        "page.context().request is available."
    );


    // --------------------------------------------------------
    // REQUEST SALESFORCE IMAGE
    // --------------------------------------------------------

    const response =
        await requestContext.get(
            imageUrl,
            {
                timeout: 60000,
                failOnStatusCode: false
            }
        );

    console.log("");
    console.log("Salesforce HTTP status:");
    console.log(
        response.status()
    );

    console.log("");
    console.log("Salesforce status text:");
    console.log(
        response.statusText()
    );

    const headers =
        response.headers();

    console.log("");
    console.log("Salesforce response headers:");
    console.log(
        JSON.stringify(
            headers,
            null,
            2
        )
    );

    const contentType =
        headers["content-type"] || "";

    console.log("");
    console.log("Content-Type:");
    console.log(contentType);


    // --------------------------------------------------------
    // READ RESPONSE BODY
    // --------------------------------------------------------

    const body =
        await response.body();

    console.log("");
    console.log("Response body size:");
    console.log(
        body
            ? body.length
            : 0
    );


    if (
        !body ||
        body.length === 0
    ) {

        throw new Error(
            "Salesforce returned an empty response body."
        );
    }


    // --------------------------------------------------------
    // PRINT FIRST BYTES
    // --------------------------------------------------------

    const firstBytes =
        Array.from(
            body.subarray(
                0,
                Math.min(
                    body.length,
                    32
                )
            )
        )
            .map(
                byte =>
                    byte
                        .toString(16)
                        .padStart(
                            2,
                            "0"
                        )
            )
            .join(" ");

    console.log("");
    console.log("First response bytes:");
    console.log(firstBytes);


    // --------------------------------------------------------
    // PRINT FIRST TEXT
    // --------------------------------------------------------

    console.log("");
    console.log("First response text:");

    try {

        console.log(
            body
                .subarray(
                    0,
                    Math.min(
                        body.length,
                        500
                    )
                )
                .toString(
                    "utf8"
                )
        );

    } catch {

        console.log(
            "(Unable to decode response as text.)"
        );
    }


    // --------------------------------------------------------
    // HTTP ERROR
    // --------------------------------------------------------

    if (!response.ok()) {

        throw new Error(
            "Salesforce image request returned HTTP " +
            response.status()
        );
    }


    // --------------------------------------------------------
    // VALIDATE REAL IMAGE
    // --------------------------------------------------------

    let isImage = false;

    // JPEG
    if (
        body.length >= 3 &&
        body[0] === 0xFF &&
        body[1] === 0xD8 &&
        body[2] === 0xFF
    ) {
        isImage = true;
    }

    // PNG
    if (
        body.length >= 8 &&
        body[0] === 0x89 &&
        body[1] === 0x50 &&
        body[2] === 0x4E &&
        body[3] === 0x47 &&
        body[4] === 0x0D &&
        body[5] === 0x0A &&
        body[6] === 0x1A &&
        body[7] === 0x0A
    ) {
        isImage = true;
    }

    // GIF
    if (
        body.length >= 6 &&
        (
            body
                .subarray(0, 6)
                .toString("ascii") === "GIF87a" ||
            body
                .subarray(0, 6)
                .toString("ascii") === "GIF89a"
        )
    ) {
        isImage = true;
    }

    // WEBP
    if (
        body.length >= 12 &&
        body
            .subarray(0, 4)
            .toString("ascii") === "RIFF" &&
        body
            .subarray(8, 12)
            .toString("ascii") === "WEBP"
    ) {
        isImage = true;
    }

    // BMP
    if (
        body.length >= 2 &&
        body[0] === 0x42 &&
        body[1] === 0x4D
    ) {
        isImage = true;
    }


    if (!isImage) {

        throw new Error(
            "Salesforce returned HTTP 200, but the response is NOT a recognized image."
        );
    }


    console.log("");
    console.log(
        "REAL IMAGE DETECTED."
    );

    console.log("");
    console.log(
        "Image byte size:"
    );

    console.log(
        body.length
    );


    // --------------------------------------------------------
    // SEND BASE64 BACK TO NODE
    // --------------------------------------------------------

    const base64 =
        body.toString(
            "base64"
        );

    console.log("");
    console.log(
        "IMAGE_BASE64_START"
    );

    console.log(
        base64
    );

    console.log(
        "IMAGE_BASE64_END"
    );

    console.log("");

    console.log(
        "Salesforce image extraction completed."
    );

}
