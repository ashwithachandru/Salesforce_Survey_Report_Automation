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

// Existing Chrome user's Downloads folder.
const CHROME_DOWNLOADS_DIR =
    path.join(
        process.env.USERPROFILE ||
            "C:\\Users\\Ashwitha",
        "Downloads"
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


function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}


function detectImageType(buffer) {

    if (
        !buffer ||
        buffer.length < 4
    ) {
        return null;
    }

    // --------------------------------------------------------
    // JPEG
    // --------------------------------------------------------

    if (
        buffer.length >= 3 &&
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF
    ) {

        return {
            extension: ".jpg",
            mimeType: "image/jpeg"
        };
    }


    // --------------------------------------------------------
    // PNG
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // GIF
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // WEBP
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // BMP
    // --------------------------------------------------------

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
// DOWNLOAD FOLDER HELPERS
// ============================================================

function listDownloadFiles() {

    if (
        !fs.existsSync(
            CHROME_DOWNLOADS_DIR
        )
    ) {
        return new Map();
    }


    const files =
        fs.readdirSync(
            CHROME_DOWNLOADS_DIR,
            {
                withFileTypes: true
            }
        );


    const result =
        new Map();


    for (
        const entry of files
    ) {

        if (
            !entry.isFile()
        ) {
            continue;
        }


        const fullPath =
            path.join(
                CHROME_DOWNLOADS_DIR,
                entry.name
            );


        try {

            const stat =
                fs.statSync(
                    fullPath
                );


            result.set(
                entry.name,
                {
                    path: fullPath,
                    size: stat.size,
                    mtimeMs: stat.mtimeMs
                }
            );

        } catch {
            // File may disappear while Chrome is downloading.
        }
    }


    return result;
}


function isTemporaryDownload(
    filename
) {

    const lower =
        filename.toLowerCase();


    return (
        lower.endsWith(".crdownload") ||
        lower.endsWith(".tmp") ||
        lower.endsWith(".part")
    );
}


function isImageFilename(
    filename
) {

    const lower =
        filename.toLowerCase();


    return (
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".gif") ||
        lower.endsWith(".webp") ||
        lower.endsWith(".bmp")
    );
}


async function waitForNewChromeDownload(
    beforeFiles,
    timeoutMs = 60000
) {

    console.log("");
    console.log(
        "Waiting for Salesforce file in Chrome Downloads..."
    );

    console.log(
        CHROME_DOWNLOADS_DIR
    );


    const start =
        Date.now();


    while (
        Date.now() - start <
        timeoutMs
    ) {

        const currentFiles =
            listDownloadFiles();


        const candidates = [];


        for (
            const [
                name,
                info
            ] of currentFiles.entries()
        ) {

            if (
                beforeFiles.has(name)
            ) {
                continue;
            }


            if (
                isTemporaryDownload(name)
            ) {
                continue;
            }


            candidates.push({
                name,
                ...info
            });
        }


        // Prefer image files.
        candidates.sort(
            (a, b) => {

                const aImage =
                    isImageFilename(
                        a.name
                    );

                const bImage =
                    isImageFilename(
                        b.name
                    );


                if (
                    aImage &&
                    !bImage
                ) {
                    return -1;
                }


                if (
                    !aImage &&
                    bImage
                ) {
                    return 1;
                }


                return (
                    b.mtimeMs -
                    a.mtimeMs
                );
            }
        );


        if (
            candidates.length > 0
        ) {

            const candidate =
                candidates[0];


            const firstSize =
                candidate.size;


            // Give Chrome time to finish writing.
            await sleep(1000);


            if (
                !fs.existsSync(
                    candidate.path
                )
            ) {
                continue;
            }


            const secondStat =
                fs.statSync(
                    candidate.path
                );


            if (
                secondStat.size ===
                    firstSize &&
                secondStat.size > 0
            ) {

                console.log("");
                console.log(
                    "New Chrome download found:"
                );

                console.log(
                    candidate.path
                );


                console.log("");
                console.log(
                    "Downloaded size:"
                );

                console.log(
                    secondStat.size,
                    "bytes"
                );


                return candidate.path;
            }
        }


        await sleep(1000);
    }


    return null;
}


// ============================================================
// DOWNLOAD SALESFORCE IMAGE
// ============================================================

async function downloadSalesforceImage(
    imageUrl,
    outputFile
) {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        " DOWNLOADING SALESFORCE IMAGE"
    );

    console.log(
        "========================================"
    );


    console.log("");
    console.log(
        "Salesforce URL:"
    );

    console.log(
        imageUrl
    );


    console.log("");
    console.log(
        "Output file:"
    );

    console.log(
        outputFile
    );


    console.log("");
    console.log(
        "Chrome Downloads folder:"
    );

    console.log(
        CHROME_DOWNLOADS_DIR
    );


    fs.mkdirSync(
        IMAGE_DIR,
        {
            recursive: true
        }
    );


    fs.mkdirSync(
        CHROME_DOWNLOADS_DIR,
        {
            recursive: true
        }
    );


    // --------------------------------------------------------
    // REMOVE OLD OUTPUT IMAGE
    // --------------------------------------------------------

    if (
        fs.existsSync(
            outputFile
        )
    ) {

        fs.unlinkSync(
            outputFile
        );


        console.log("");
        console.log(
            "Removed previous output image."
        );
    }


    // --------------------------------------------------------
    // RECORD CURRENT DOWNLOADS
    // --------------------------------------------------------

    const beforeFiles =
        listDownloadFiles();


    // --------------------------------------------------------
    // CREATE TEMPORARY PLAYWRIGHT SCRIPT
    // --------------------------------------------------------

    const tempScript =
        path.join(
            IMAGE_DIR,
            `salesforce-image-${Date.now()}.js`
        );


    /*
     * IMPORTANT:
     *
     * playwright-cli run-code expects the file
     * itself to be a function expression.
     *
     * Therefore the generated file MUST be:
     *
     * async page => {
     *     ...
     * }
     *
     * NOT:
     *
     * await (async page => {
     *     ...
     * })(page);
     */


    const playwrightScript = `
async page => {

    const imageUrl =
        ${JSON.stringify(imageUrl)};


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        " SALESFORCE IMAGE DOWNLOAD"
    );

    console.log(
        "========================================"
    );


    console.log("");
    console.log(
        "Current Salesforce page:"
    );

    console.log(
        await page.url()
    );


    console.log("");
    console.log(
        "Opening Salesforce image URL:"
    );

    console.log(
        imageUrl
    );


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
            "Salesforce image URL opened."
        );

    } catch (error) {

        console.log("");
        console.log(
            "Salesforce navigation message:"
        );

        console.log(
            error.message
        );


        console.log("");
        console.log(
            "The browser may have started the download."
        );
    }


    console.log("");
    console.log(
        "Salesforce image request completed."
    );
}
`;


    fs.writeFileSync(
        tempScript,
        playwrightScript,
        "utf8"
    );


    console.log("");
    console.log(
        "Temporary Playwright script:"
    );

    console.log(
        tempScript
    );


    console.log("");
    console.log(
        "Running Playwright:"
    );


    const command =
        `playwright-cli -s=chrome run-code --filename="${tempScript}"`;


    console.log(
        command
    );


    // --------------------------------------------------------
    // RUN PLAYWRIGHT
    // --------------------------------------------------------

    let playwrightFailed =
        false;


    try {

        const stdout =
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
            "Playwright output:"
        );

        console.log(
            stdout
        );

    } catch (error) {

        playwrightFailed =
            true;


        console.log("");
        console.log(
            "Playwright returned an error/message:"
        );


        if (
            error.stdout
        ) {

            console.log(
                error.stdout.toString()
            );
        }


        if (
            error.stderr
        ) {

            console.log(
                error.stderr.toString()
            );
        }


        console.log("");
        console.log(
            "Continuing to inspect Chrome Downloads..."
        );
    }


    // --------------------------------------------------------
    // WAIT FOR DOWNLOAD
    // --------------------------------------------------------

    const downloadedFile =
        await waitForNewChromeDownload(
            beforeFiles,
            60000
        );


    if (
        !downloadedFile
    ) {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            " FAILED"
        );

        console.log(
            "========================================"
        );


        console.log("");
        console.log(
            "No new file was found in:"
        );

        console.log(
            CHROME_DOWNLOADS_DIR
        );


        console.log("");
        console.log(
            "Playwright error occurred:",
            playwrightFailed
        );


        console.log("");
        console.log(
            "Check Chrome Downloads manually."
        );


        throw new Error(
            "Salesforce image was not found in Chrome Downloads folder."
        );
    }


    // --------------------------------------------------------
    // READ DOWNLOADED FILE
    // --------------------------------------------------------

    const buffer =
        fs.readFileSync(
            downloadedFile
        );


    if (
        buffer.length === 0
    ) {

        throw new Error(
            "Salesforce downloaded an empty file."
        );
    }


    // --------------------------------------------------------
    // VERIFY IMAGE TYPE
    // --------------------------------------------------------

    const imageType =
        detectImageType(
            buffer
        );


    if (
        !imageType
    ) {

        console.log("");
        console.log(
            "Downloaded file is NOT recognized as an image."
        );


        console.log("");
        console.log(
            "Downloaded file:"
        );

        console.log(
            downloadedFile
        );


        console.log("");
        console.log(
            "Downloaded size:"
        );

        console.log(
            buffer.length,
            "bytes"
        );


        console.log("");
        console.log(
            "First bytes:"
        );


        console.log(
            Array.from(
                buffer.subarray(
                    0,
                    Math.min(
                        buffer.length,
                        64
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
            "Salesforce downloaded a file, but it is not a valid image."
        );
    }


    // --------------------------------------------------------
    // COPY IMAGE TO PROJECT
    // --------------------------------------------------------

    fs.copyFileSync(
        downloadedFile,
        outputFile
    );


    // --------------------------------------------------------
    // VERIFY OUTPUT
    // --------------------------------------------------------

    if (
        !fs.existsSync(
            outputFile
        )
    ) {

        throw new Error(
            "Image was downloaded but could not be copied to project."
        );
    }


    const outputBuffer =
        fs.readFileSync(
            outputFile
        );


    if (
        outputBuffer.length === 0
    ) {

        throw new Error(
            "Copied image file is empty."
        );
    }


    const outputImageType =
        detectImageType(
            outputBuffer
        );


    if (
        !outputImageType
    ) {

        throw new Error(
            "Copied file is not a valid image."
        );
    }


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        " REAL IMAGE RECEIVED"
    );

    console.log(
        "========================================"
    );


    console.log("");
    console.log(
        "Downloaded from:"
    );

    console.log(
        downloadedFile
    );


    console.log("");
    console.log(
        "Image type:"
    );

    console.log(
        outputImageType.mimeType
    );


    console.log("");
    console.log(
        "Image size:"
    );

    console.log(
        outputBuffer.length,
        "bytes"
    );


    console.log("");
    console.log(
        "Saved to:"
    );

    console.log(
        outputFile
    );


    // --------------------------------------------------------
    // REMOVE TEMPORARY CHROME DOWNLOAD
    // --------------------------------------------------------

    try {

        fs.unlinkSync(
            downloadedFile
        );


        console.log("");
        console.log(
            "Temporary Chrome download removed."
        );

    } catch (error) {

        console.log("");
        console.log(
            "Could not remove temporary Chrome download:"
        );

        console.log(
            error.message
        );
    }


    // --------------------------------------------------------
    // REMOVE TEMP PLAYWRIGHT SCRIPT
    // --------------------------------------------------------

    try {

        fs.unlinkSync(
            tempScript
        );

    } catch {
        // Ignore cleanup failure.
    }


    return outputFile;
}


// ============================================================
// DOCUFLOW LOGIN
// ============================================================

async function loginToDocuFlow() {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        " LOGGING INTO DOCUFLOW"
    );

    console.log(
        "========================================"
    );


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


    if (
        !response.ok
    ) {

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


    if (
        !token
    ) {

        throw new Error(
            "DocuFlow login succeeded but no token was returned."
        );
    }


    console.log("");
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
    console.log(
        "========================================"
    );

    console.log(
        " UPLOADING IMAGE TO DOCUFLOW"
    );

    console.log(
        "========================================"
    );


    if (
        !fs.existsSync(
            imageFile
        )
    ) {

        throw new Error(
            `Image file not found: ${imageFile}`
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


    if (
        !imageType
    ) {

        throw new Error(
            "Image file is not a valid image."
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
        fileBuffer.length,
        "bytes"
    );


    const url =
        `${DOCUFLOW_BASE_URL}/api/sync/record/${encodeURIComponent(documentId)}/attachment/base64`;


    console.log("");
    console.log(
        "Attachment endpoint:"
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


    if (
        !response.ok
    ) {

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
    console.log(
        "========================================"
    );

    console.log(
        " Salesforce → DocuFlow"
    );

    console.log(
        " Survey Image Upload"
    );

    console.log(
        "========================================"
    );


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


        if (
            !sheetName
        ) {

            throw new Error(
                "Excel workbook has no sheets."
            );
        }


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
        // SELECT RECORD #3
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
        // IMAGE 1
        // ----------------------------------------------------

        const imageUrl =
            cleanValue(
                row["Image 1"]
            );


        if (
            !imageUrl
        ) {

            throw new Error(
                "Image 1 is empty in Excel."
            );
        }


        console.log("");
        console.log(
            "Image 1 URL found."
        );


        // ----------------------------------------------------
        // IMAGE OUTPUT DIRECTORY
        // ----------------------------------------------------

        fs.mkdirSync(
            IMAGE_DIR,
            {
                recursive: true
            }
        );


        const outputFile =
            path.join(
                IMAGE_DIR,
                "survey-image-1.jpg"
            );


        if (
            fs.existsSync(
                outputFile
            )
        ) {

            fs.unlinkSync(
                outputFile
            );


            console.log("");
            console.log(
                "Old survey image removed."
            );
        }


        // ----------------------------------------------------
        // DOWNLOAD SALESFORCE IMAGE
        // ----------------------------------------------------

        console.log("");
        console.log(
            "Downloading Salesforce Image 1..."
        );


        await downloadSalesforceImage(
            imageUrl,
            outputFile
        );


        // ----------------------------------------------------
        // LOGIN DOCUFLOW
        // ----------------------------------------------------

        const token =
            await loginToDocuFlow();


        // ----------------------------------------------------
        // UPLOAD IMAGE
        // ----------------------------------------------------

        await uploadImage(
            token,
            DOCUFLOW_DOCUMENT_ID,
            outputFile
        );


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            " SUCCESS"
        );

        console.log(
            "========================================"
        );


        console.log("");
        console.log(
            "Salesforce Image 1 downloaded successfully."
        );


        console.log("");
        console.log(
            "Image uploaded to DocuFlow successfully."
        );


        console.log("");
        console.log(
            "DocuFlow Record:"
        );

        console.log(
            DOCUFLOW_DOCUMENT_ID
        );


        console.log("");
        console.log(
            "Local image:"
        );

        console.log(
            outputFile
        );


        console.log("");
        console.log(
            "Done."
        );

    } catch (error) {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            " AUTOMATION FAILED"
        );

        console.log(
            "========================================"
        );


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