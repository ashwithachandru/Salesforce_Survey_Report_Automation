const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { execSync } = require("child_process");

// ============================================================
// CONFIGURATION
// ============================================================

const PROJECT_DIR = __dirname;

const EXCEL_FILE = path.join(
    PROJECT_DIR,
    "downloads",
    "Customer Complaints-Generic_2026-08-01_to_2026-08-31.xlsx"
);

const DOCUFLOW_DOCUMENT_ID = "DOC-00000054";

const DOCUFLOW_BASE_URL =
    "http://192.168.179.22:3000";

const DOCUFLOW_USERNAME =
    "admin";

const DOCUFLOW_PASSWORD =
    "password123";

const IMAGE_DIR =
    path.join(
        PROJECT_DIR,
        "temp-images"
    );


// ============================================================
// HELPERS
// ============================================================

function cleanValue(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}


function detectImageType(buffer) {

    if (!buffer || buffer.length < 4) {
        return null;
    }

    // JPEG
    if (
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF
    ) {
        return {
            extension: ".jpg",
            mimeType: "image/jpeg"
        };
    }

    // PNG
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0D &&
        buffer[5] === 0x0A &&
        buffer[6] === 0x1A &&
        buffer[7] === 0x0A
    ) {
        return {
            extension: ".png",
            mimeType: "image/png"
        };
    }

    // GIF
    if (
        buffer.length >= 6 &&
        (
            buffer
                .subarray(0, 6)
                .toString("ascii") === "GIF87a" ||
            buffer
                .subarray(0, 6)
                .toString("ascii") === "GIF89a"
        )
    ) {
        return {
            extension: ".gif",
            mimeType: "image/gif"
        };
    }

    // WEBP
    if (
        buffer.length >= 12 &&
        buffer
            .subarray(0, 4)
            .toString("ascii") === "RIFF" &&
        buffer
            .subarray(8, 12)
            .toString("ascii") === "WEBP"
    ) {
        return {
            extension: ".webp",
            mimeType: "image/webp"
        };
    }

    // BMP
    if (
        buffer.length >= 2 &&
        buffer[0] === 0x42 &&
        buffer[1] === 0x4D
    ) {
        return {
            extension: ".bmp",
            mimeType: "image/bmp"
        };
    }

    return null;
}


// ============================================================
// DOWNLOAD SALESFORCE IMAGE
//
// IMPORTANT:
// Uses the EXISTING ATTACHED CHROME session.
//
// Salesforce Shepherd URLs are handled as browser downloads.
// We do NOT use context.request.get().
// ============================================================

function downloadSalesforceImage(
    imageUrl,
    outputFile
) {

    console.log("");
    console.log("========================================");
    console.log(" DOWNLOADING SALESFORCE IMAGE");
    console.log("========================================");

    console.log("");
    console.log("Salesforce URL:");
    console.log(imageUrl);

    console.log("");
    console.log("Output file:");
    console.log(outputFile);


    fs.mkdirSync(
        IMAGE_DIR,
        {
            recursive: true
        }
    );


    const tempScript =
        path.join(
            IMAGE_DIR,
            `download-salesforce-image-${Date.now()}.js`
        );


    // --------------------------------------------------------
    // PLAYWRIGHT CODE
    // --------------------------------------------------------

    const playwrightCode = `
async page => {

    const imageUrl =
        ${JSON.stringify(imageUrl)};

    const outputFile =
        ${JSON.stringify(outputFile)};

    console.log("");
    console.log("========================================");
    console.log(" SALESFORCE BROWSER DOWNLOAD");
    console.log("========================================");

    console.log("");
    console.log("Current page:");
    console.log(
        await page.url()
    );

    console.log("");
    console.log("Image URL:");
    console.log(imageUrl);

    console.log("");
    console.log("Waiting for Salesforce download...");

    // --------------------------------------------------------
    // START LISTENING BEFORE NAVIGATION
    // --------------------------------------------------------

    const downloadPromise =
        page.waitForEvent(
            "download",
            {
                timeout: 60000
            }
        );


    // --------------------------------------------------------
    // NAVIGATE TO SALESFORCE SHEPHERD URL
    // --------------------------------------------------------

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
            "page.goto completed normally."
        );

    } catch (error) {

        // Salesforce download URLs can cause Playwright
        // navigation to report that a download started.
        // That is expected here.

        console.log("");
        console.log(
            "Navigation message:"
        );

        console.log(
            error.message
        );
    }


    // --------------------------------------------------------
    // WAIT FOR ACTUAL DOWNLOAD
    // --------------------------------------------------------

    const download =
        await downloadPromise;


    console.log("");
    console.log(
        "Salesforce download event received."
    );


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
            "Salesforce browser download failed: " +
            failure
        );
    }


    // --------------------------------------------------------
    // SAVE DOWNLOAD
    // --------------------------------------------------------

    console.log("");
    console.log(
        "Saving Salesforce download..."
    );

    await download.saveAs(
        outputFile
    );


    console.log("");
    console.log(
        "Salesforce file saved:"
    );

    console.log(
        outputFile
    );


    // --------------------------------------------------------
    // VERIFY FILE
    // --------------------------------------------------------

    const fs =
        require("fs");


    if (
        !fs.existsSync(
            outputFile
        )
    ) {

        throw new Error(
            "Salesforce download completed but file does not exist."
        );
    }


    const stats =
        fs.statSync(
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
        "DOWNLOAD_SUCCESS"
    );
}
`;


    // --------------------------------------------------------
    // WRITE TEMP PLAYWRIGHT SCRIPT
    // --------------------------------------------------------

    fs.writeFileSync(
        tempScript,
        playwrightCode,
        "utf8"
    );


    console.log("");
    console.log(
        "Temporary Playwright script:"
    );

    console.log(
        tempScript
    );


    // --------------------------------------------------------
    // RUN PLAYWRIGHT
    // --------------------------------------------------------

    const command =
        `playwright-cli -s=chrome run-code --filename="${tempScript}"`;


    console.log("");
    console.log(
        "Running:"
    );

    console.log(
        command
    );


    let stdout = "";


    try {

        stdout =
            execSync(
                command,
                {
                    cwd: PROJECT_DIR,
                    encoding: "utf8",
                    shell: true,
                    maxBuffer:
                        100 * 1024 * 1024
                }
            );


        console.log("");
        console.log(
            "Playwright completed."
        );


        console.log("");
        console.log(
            "Playwright output:"
        );

        console.log(
            stdout
        );


    } catch (error) {

        console.log("");
        console.log("========================================");
        console.log(" SALESFORCE DOWNLOAD FAILED");
        console.log("========================================");


        console.log("");
        console.log(
            "Command:"
        );

        console.log(
            command
        );


        console.log("");
        console.log(
            "Exit code:"
        );

        console.log(
            error.status !== undefined
                ? error.status
                : "unknown"
        );


        console.log("");
        console.log(
            "Playwright STDOUT:"
        );

        console.log(
            error.stdout
                ? error.stdout.toString()
                : "(none)"
        );


        console.log("");
        console.log(
            "Playwright STDERR:"
        );

        console.log(
            error.stderr
                ? error.stderr.toString()
                : "(none)"
        );


        console.log("");
        console.log(
            "Temporary script kept at:"
        );

        console.log(
            tempScript
        );


        throw new Error(
            "Salesforce image browser download failed."
        );
    }


    // --------------------------------------------------------
    // VERIFY DOWNLOAD
    // --------------------------------------------------------

    if (
        !fs.existsSync(
            outputFile
        )
    ) {

        throw new Error(
            "Salesforce download command completed but output file was not created."
        );
    }


    const buffer =
        fs.readFileSync(
            outputFile
        );


    if (
        buffer.length === 0
    ) {

        throw new Error(
            "Salesforce downloaded file is empty."
        );
    }


    // --------------------------------------------------------
    // DETECT IMAGE
    // --------------------------------------------------------

    const imageType =
        detectImageType(
            buffer
        );


    if (!imageType) {

        console.log("");
        console.log(
            "First bytes of downloaded file:"
        );

        console.log(
            Array.from(
                buffer.subarray(
                    0,
                    Math.min(
                        buffer.length,
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
                .join(" ")
        );


        throw new Error(
            "Salesforce downloaded a file, but it is not a recognized image."
        );
    }


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        " REAL SALESFORCE IMAGE DETECTED"
    );

    console.log(
        "========================================"
    );


    console.log("");
    console.log(
        "Image type:"
    );

    console.log(
        imageType.mimeType
    );


    console.log("");
    console.log(
        "Image size:"
    );

    console.log(
        buffer.length,
        "bytes"
    );


    return outputFile;
}


// ============================================================
// DOCUFLOW LOGIN
// ============================================================

async function loginToDocuFlow() {

    console.log("");
    console.log("========================================");
    console.log(" LOGGING INTO DOCUFLOW");
    console.log("========================================");


    const loginUrl =
        `${DOCUFLOW_BASE_URL}/api/auth/login`;


    const response =
        await fetch(
            loginUrl,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        username:
                            DOCUFLOW_USERNAME,

                        password:
                            DOCUFLOW_PASSWORD
                    })
            }
        );


    const responseText =
        await response.text();


    if (!response.ok) {

        throw new Error(
            `DocuFlow login failed (${response.status}): ${responseText}`
        );
    }


    let data;


    try {

        data =
            JSON.parse(
                responseText
            );

    } catch {

        throw new Error(
            "DocuFlow login returned invalid JSON:\n" +
            responseText
        );
    }


    const token =
        data.access_token ||
        data.token;


    if (!token) {

        throw new Error(
            "DocuFlow login succeeded but no token was returned."
        );
    }


    console.log(
        "DocuFlow login successful."
    );


    return token;
}


// ============================================================
// UPLOAD IMAGE TO DOCUFLOW
// ============================================================

async function uploadImage(
    token,
    documentId,
    imageFile
) {

    console.log("");
    console.log("========================================");
    console.log(" UPLOADING IMAGE TO DOCUFLOW");
    console.log("========================================");


    if (
        !fs.existsSync(
            imageFile
        )
    ) {

        throw new Error(
            `Image file does not exist: ${imageFile}`
        );
    }


    const fileBuffer =
        fs.readFileSync(
            imageFile
        );


    if (
        fileBuffer.length === 0
    ) {

        throw new Error(
            "Image file is empty."
        );
    }


    const imageType =
        detectImageType(
            fileBuffer
        );


    if (!imageType) {

        throw new Error(
            "Image file is not a valid recognized image."
        );
    }


    const base64 =
        fileBuffer.toString(
            "base64"
        );


    const fileName =
        path.basename(
            imageFile
        );


    console.log("");
    console.log(
        "File name:"
    );

    console.log(
        fileName
    );


    console.log("");
    console.log(
        "File type:"
    );

    console.log(
        imageType.mimeType
    );


    console.log("");
    console.log(
        "File size:"
    );

    console.log(
        fileBuffer.length,
        "bytes"
    );


    console.log("");
    console.log(
        "Base64 size:"
    );

    console.log(
        base64.length
    );


    const url =
        `${DOCUFLOW_BASE_URL}/api/sync/record/${encodeURIComponent(documentId)}/attachment/base64`;


    console.log("");
    console.log(
        "DocuFlow attachment endpoint:"
    );

    console.log(
        url
    );


    const payload = {

        file_name:
            fileName,

        file_content_base64:
            base64,

        attachment_type:
            "Survey Image",

        uploaded_by:
            "Salesforce Automation"
    };


    const response =
        await fetch(
            url,
            {
                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${token}`
                },

                body:
                    JSON.stringify(
                        payload
                    )
            }
        );


    const responseText =
        await response.text();


    console.log("");
    console.log(
        `DocuFlow HTTP status: ${response.status}`
    );


    console.log("");
    console.log(
        "DocuFlow response:"
    );

    console.log(
        responseText
    );


    if (!response.ok) {

        throw new Error(
            `DocuFlow image upload failed (${response.status}): ${responseText}`
        );
    }


    return responseText;
}


// ============================================================
// MAIN
// ============================================================

(async () => {

    console.log("");
    console.log("========================================");
    console.log(" Salesforce → DocuFlow");
    console.log(" Survey Image Upload");
    console.log("========================================");


    try {

        // ----------------------------------------------------
        // READ EXCEL
        // ----------------------------------------------------

        console.log("");
        console.log(
            "Reading Excel:"
        );

        console.log(
            EXCEL_FILE
        );


        if (
            !fs.existsSync(
                EXCEL_FILE
            )
        ) {

            throw new Error(
                `Excel file not found:\n${EXCEL_FILE}`
            );
        }


        const workbook =
            xlsx.readFile(
                EXCEL_FILE
            );


        const sheetName =
            workbook.SheetNames[0];


        const worksheet =
            workbook.Sheets[
                sheetName
            ];


        const rows =
            xlsx.utils.sheet_to_json(
                worksheet,
                {
                    defval: ""
                }
            );


        if (
            rows.length < 3
        ) {

            throw new Error(
                "Excel does not contain record #3."
            );
        }


        // ----------------------------------------------------
        // SELECT THIRD RECORD
        // ----------------------------------------------------

        const row =
            rows[2];


        console.log("");
        console.log(
            "Using Excel record #3:"
        );


        console.log(
            JSON.stringify(
                row,
                null,
                2
            )
        );


        // ----------------------------------------------------
        // GET IMAGE 1
        // ----------------------------------------------------

        const imageUrl =
            cleanValue(
                row["Image 1"]
            );


        if (!imageUrl) {

            throw new Error(
                "Image 1 is empty in Excel."
            );
        }


        console.log("");
        console.log(
            "Image 1 URL found."
        );


        // ----------------------------------------------------
        // IMAGE DIRECTORY
        // ----------------------------------------------------

        fs.mkdirSync(
            IMAGE_DIR,
            {
                recursive: true
            }
        );


        // ----------------------------------------------------
        // CLEAN OLD IMAGE
        // ----------------------------------------------------

        const oldFiles = [
            "survey-image-1.jpg",
            "survey-image-1.jpeg",
            "survey-image-1.png",
            "survey-image-1.gif",
            "survey-image-1.webp",
            "survey-image-1.bmp"
        ];


        for (
            const fileName of oldFiles
        ) {

            const filePath =
                path.join(
                    IMAGE_DIR,
                    fileName
                );


            if (
                fs.existsSync(
                    filePath
                )
            ) {

                fs.unlinkSync(
                    filePath
                );
            }
        }


        // ----------------------------------------------------
        // DOWNLOAD FROM SALESFORCE
        // ----------------------------------------------------

        const imageFile =
            path.join(
                IMAGE_DIR,
                "survey-image-1.jpg"
            );


        const downloadedImage =
            await downloadSalesforceImage(
                imageUrl,
                imageFile
            );


        // ----------------------------------------------------
        // LOGIN DOCUFLOW
        // ----------------------------------------------------

        const token =
            await loginToDocuFlow();


        // ----------------------------------------------------
        // UPLOAD
        // ----------------------------------------------------

        console.log("");
        console.log(
            `Target DocuFlow record: ${DOCUFLOW_DOCUMENT_ID}`
        );


        await uploadImage(
            token,
            DOCUFLOW_DOCUMENT_ID,
            downloadedImage
        );


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        console.log("");
        console.log("========================================");
        console.log(" SUCCESS");
        console.log("========================================");


        console.log("");
        console.log(
            `DocuFlow Document ID: ${DOCUFLOW_DOCUMENT_ID}`
        );


        console.log("");
        console.log(
            `Image saved at: ${downloadedImage}`
        );


        console.log("");
        console.log(
            "IMAGE 1 UPLOADED SUCCESSFULLY."
        );


        console.log("");
        console.log(
            "Refresh DOC-00000054 in DocuFlow."
        );


    } catch (error) {

        console.log("");
        console.log("========================================");
        console.log(" FAILED");
        console.log("========================================");

        console.log("");

        console.log(
            error &&
            error.stack
                ? error.stack
                : error
        );

        process.exitCode = 1;
    }

})();