const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
const sharp = require("sharp");

const PROJECT_DIR = __dirname;

const EXCEL_FILE = path.join(
    PROJECT_DIR,
    "downloads",
    "Customer Complaints-Generic_2026-08-01_to_2026-08-31.xlsx"
);

const TEMP_DIR = path.join(
    PROJECT_DIR,
    "temp-images"
);

const DOWNLOAD_DIR = path.join(
    process.env.USERPROFILE,
    "Downloads"
);

const DOCUFLOW_LOGIN_URL =
    "http://192.168.179.22:3000/api/auth/login";

const DOCUFLOW_SYNC_URL =
    "http://192.168.179.22:3000/api/sync/record";

const DOCUFLOW_USERNAME = "admin";
const DOCUFLOW_PASSWORD = "password123";

const RECORD_NUMBER = 3;

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}


// ============================================================
// HTTP REQUEST
// ============================================================

function httpRequest(url, options = {}, body = null) {

    return new Promise((resolve, reject) => {

        const parsed = new URL(url);

        const requestOptions = {
            hostname: parsed.hostname,
            port: parsed.port || 80,
            path: parsed.pathname + parsed.search,
            method: options.method || "GET",
            headers: options.headers || {}
        };

        const req = http.request(
            requestOptions,
            res => {

                let data = "";

                res.on("data", chunk => {
                    data += chunk;
                });

                res.on("end", () => {

                    let parsedData = data;

                    try {
                        parsedData = JSON.parse(data);
                    }
                    catch (_) {
                    }

                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: parsedData
                    });
                });
            }
        );

        req.on("error", reject);

        if (body) {
            req.write(body);
        }

        req.end();
    });
}


// ============================================================
// DOCUFLOW LOGIN
// ============================================================

async function loginToDocuFlow() {

    console.log("");
    console.log("========================================");
    console.log(" Logging into DocuFlow");
    console.log("========================================");

    const body = JSON.stringify({
        username: DOCUFLOW_USERNAME,
        password: DOCUFLOW_PASSWORD
    });

    const response = await httpRequest(
        DOCUFLOW_LOGIN_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
            }
        },
        body
    );

    if (
        response.status < 200 ||
        response.status >= 300
    ) {
        throw new Error(
            `DocuFlow login failed. HTTP ${response.status}\n` +
            JSON.stringify(response.data, null, 2)
        );
    }

    console.log("DocuFlow login successful.");

    console.log(
        "Login response:",
        JSON.stringify(response.data, null, 2)
    );

    const data = response.data || {};

    /*
     * Support common token response formats.
     */

    const token =
        data.access_token ||
        data.accessToken ||
        data.token ||
        data.service_token ||
        data.serviceToken ||
        data.data?.access_token ||
        data.data?.accessToken ||
        data.data?.token;

    if (!token) {

        throw new Error(
            "DocuFlow login succeeded, but no authentication token " +
            "was found in the login response."
        );
    }

    console.log("");
    console.log("DocuFlow authentication token received.");
    console.log("Token validity: expected approximately 60 minutes.");

    return token;
}


// ============================================================
// CREATE DOCUFLOW RECORD
// ============================================================

async function createDocuFlowRecord(record, token) {

    console.log("");
    console.log("Creating DocuFlow record...");

    const body = JSON.stringify({

        document_number:
            record["Invoice Number"] || "",

        invoice_number:
            record["Invoice Number"] || "",

        vendor_name:
            record["Dealer/Distributor Name"] ||
            "Unknown Vendor",

        amount: 1,

        base_amount: 1,

        tax_amount: 0,

        currency: "INR",

        division: "VCC",

        auto_route: false,

        metadata: {

            account_name:
                record["Account Name"] || "",

            business_partner_code:
                record["Business Partner Code"] || "",

            employee_name:
                record["Employee Name"] || "",

            employee_id:
                record["Employee ID"] || "",

            employee_division:
                record["Employee Division"] || "",

            employee_segment:
                record["Employee Segment"] || "",

            survey_date:
                record["Survey Date"] || "",

            subtype_of_complaint:
                record["Subtype of complaint"] || "",

            additional_comments:
                record["Additional Comments"] || "",

            dealer_distributor_name:
                record["Dealer/Distributor Name"] || "",

            bp_type:
                record["BP Type"] || "",

            type_of_complaint:
                record["Type of Complaint"] || "",

            customer_code:
                record["Customer Code"] || ""
        }
    });

    const response = await httpRequest(
        DOCUFLOW_SYNC_URL,
        {
            method: "POST",

            headers: {

                "Content-Type":
                    "application/json",

                "Authorization":
                    `Bearer ${token}`,

                "Content-Length":
                    Buffer.byteLength(body)
            }
        },
        body
    );

    if (
        response.status < 200 ||
        response.status >= 300
    ) {

        throw new Error(
            `DocuFlow record creation failed. HTTP ${response.status}\n` +
            JSON.stringify(response.data, null, 2)
        );
    }

    console.log("");
    console.log("DocuFlow record created.");

    console.log(
        "Response:",
        JSON.stringify(response.data, null, 2)
    );

    return response.data;
}


// ============================================================
// WAIT FOR NEW CHROME DOWNLOAD
// ============================================================

function waitForNewDownload(
    startTime,
    timeoutSeconds = 30
) {

    return new Promise((resolve, reject) => {

        let elapsed = 0;

        const interval = setInterval(() => {

            elapsed++;

            let files = [];

            try {

                files = fs.readdirSync(
                    DOWNLOAD_DIR
                )
                .map(fileName => {

                    const fullPath =
                        path.join(
                            DOWNLOAD_DIR,
                            fileName
                        );

                    try {

                        const stat =
                            fs.statSync(fullPath);

                        return {
                            fileName,
                            fullPath,
                            stat
                        };

                    }
                    catch (_) {

                        return null;
                    }
                })
                .filter(Boolean)
                .filter(item =>
                    item.stat.isFile()
                )
                .filter(item =>
                    item.stat.mtimeMs >= startTime
                )
                .filter(item =>
                    !item.fileName.endsWith(".crdownload")
                )
                .sort(
                    (a, b) =>
                        b.stat.mtimeMs -
                        a.stat.mtimeMs
                );

            }
            catch (_) {
            }

            if (files.length > 0) {

                clearInterval(interval);

                resolve(files[0]);

                return;
            }

            if (elapsed >= timeoutSeconds) {

                clearInterval(interval);

                reject(
                    new Error(
                        `No new downloaded file found in:\n${DOWNLOAD_DIR}`
                    )
                );
            }

        }, 1000);
    });
}


// ============================================================
// DOWNLOAD SALESFORCE IMAGE
// ============================================================

async function downloadSalesforceImage(
    imageUrl,
    imageNumber
) {

    console.log("");
    console.log(
        `Downloading Salesforce Image ${imageNumber}...`
    );

    const playwrightFile = path.join(
        TEMP_DIR,
        `open-image-${imageNumber}.js`
    );

    const script = `
async page => {

    const imageUrl =
        ${JSON.stringify(imageUrl)};

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
`;

    fs.writeFileSync(
        playwrightFile,
        script,
        "utf8"
    );

    const startTime = Date.now();

    const command =
        `playwright-cli -s=chrome run-code --filename="${playwrightFile}"`;

    console.log("");
    console.log("Running Playwright:");
    console.log(command);

    try {

        const output =
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

        console.log(output);
    }
    catch (error) {

        /*
         * "Download is starting" is expected
         * for Salesforce Shepherd download URLs.
         */

        const output =
            (error.stdout || "") +
            "\n" +
            (error.stderr || "");

        console.log(output);
    }

    console.log("");
    console.log(
        "Waiting for Salesforce download..."
    );

    const downloaded =
        await waitForNewDownload(
            startTime,
            30
        );

    console.log("");
    console.log(
        "Salesforce download found:"
    );

    console.log(
        downloaded.fullPath
    );

    return downloaded.fullPath;
}


// ============================================================
// CONVERT IMAGE TO JPEG
// ============================================================

async function convertImageToJpeg(
    sourcePath,
    imageNumber
) {

    const outputPath = path.join(
        TEMP_DIR,
        `salesforce-image-${imageNumber}.jpg`
    );

    console.log("");
    console.log(
        `Converting Image ${imageNumber} to JPEG...`
    );

    await sharp(sourcePath)
        .jpeg({
            quality: 90
        })
        .toFile(outputPath);

    if (!fs.existsSync(outputPath)) {

        throw new Error(
            "JPEG conversion failed. Output file was not created."
        );
    }

    const stat =
        fs.statSync(outputPath);

    if (stat.size === 0) {

        throw new Error(
            "JPEG conversion failed. Output file is empty."
        );
    }

    console.log(
        "Converted image:"
    );

    console.log(outputPath);

    console.log(
        `JPEG size: ${stat.size} bytes`
    );

    return outputPath;
}


// ============================================================
// UPLOAD ATTACHMENT
// ============================================================

async function uploadAttachment(
    documentId,
    imagePath,
    imageNumber,
    token
) {

    const fileBuffer =
        fs.readFileSync(imagePath);

    const base64 =
        fileBuffer.toString("base64");

    const fileName =
        path.basename(imagePath);

    const attachmentUrl =
        `http://192.168.179.22:3000/api/sync/record/` +
        `${encodeURIComponent(documentId)}/attachment/base64`;

    console.log("");
    console.log(
        `Uploading Image ${imageNumber} to DocuFlow...`
    );

    const body = JSON.stringify({

        file_name:
            fileName,

        file_content_base64:
            base64,

        attachment_type:
            "Survey Image",

        uploaded_by:
            "Salesforce Automation"
    });

    const response = await httpRequest(
        attachmentUrl,
        {
            method: "POST",

            headers: {

                "Content-Type":
                    "application/json",

                "Authorization":
                    `Bearer ${token}`,

                "Content-Length":
                    Buffer.byteLength(body)
            }
        },
        body
    );

    if (
        response.status < 200 ||
        response.status >= 300
    ) {

        throw new Error(
            `Attachment upload failed. HTTP ${response.status}\n` +
            JSON.stringify(response.data, null, 2)
        );
    }

    console.log("");
    console.log(
        `Image ${imageNumber} uploaded successfully.`
    );

    console.log(
        JSON.stringify(
            response.data,
            null,
            2
        )
    );
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    console.log("");
    console.log("========================================");
    console.log(" Salesforce → DocuFlow");
    console.log(" Survey Image Upload");
    console.log("========================================");

    console.log("");
    console.log("Reading Excel:");
    console.log(EXCEL_FILE);

    if (!fs.existsSync(EXCEL_FILE)) {

        throw new Error(
            `Excel file not found:\n${EXCEL_FILE}`
        );
    }

    const workbook =
        XLSX.readFile(EXCEL_FILE);

    const sheet =
        workbook.Sheets[
            workbook.SheetNames[0]
        ];

    const rows =
        XLSX.utils.sheet_to_json(
            sheet,
            {
                defval: ""
            }
        );

    if (rows.length < RECORD_NUMBER) {

        throw new Error(
            `Excel contains only ${rows.length} records.`
        );
    }

    const record =
        rows[RECORD_NUMBER - 1];

    console.log("");
    console.log(
        `Using Excel record #${RECORD_NUMBER}`
    );

    console.log(
        JSON.stringify(
            record,
            null,
            2
        )
    );


    // ========================================================
    // STEP 1
    // DOWNLOAD + CONVERT ALL SALESFORCE IMAGES FIRST
    // ========================================================

    console.log("");
    console.log("========================================");
    console.log(" STEP 1: PROCESS SALESFORCE IMAGES");
    console.log("========================================");

    const convertedImages = [];

    for (let i = 1; i <= 5; i++) {

        const columnName =
            `Image ${i}`;

        const imageUrl =
            String(
                record[columnName] || ""
            ).trim();

        if (!imageUrl) {

            console.log("");
            console.log(
                `Image ${i}: empty`
            );

            continue;
        }

        console.log("");
        console.log("----------------------------------------");
        console.log(`IMAGE ${i}`);
        console.log("----------------------------------------");

        console.log(
            "Salesforce URL:"
        );

        console.log(imageUrl);

        try {

            const downloadedPath =
                await downloadSalesforceImage(
                    imageUrl,
                    i
                );

            const convertedPath =
                await convertImageToJpeg(
                    downloadedPath,
                    i
                );

            convertedImages.push({
                imageNumber: i,
                path: convertedPath
            });

        }
        catch (error) {

            throw new Error(
                `Image ${i} could not be downloaded and converted.\n` +
                error.message +
                "\n\nDocuFlow record will NOT be created."
            );
        }
    }


    // ========================================================
    // SAFETY CHECK
    // ========================================================

    console.log("");
    console.log("========================================");
    console.log(" IMAGE VALIDATION");
    console.log("========================================");

    for (const image of convertedImages) {

        if (!fs.existsSync(image.path)) {

            throw new Error(
                `Converted image does not exist: ${image.path}`
            );
        }

        const stat =
            fs.statSync(image.path);

        if (stat.size === 0) {

            throw new Error(
                `Converted image is empty: ${image.path}`
            );
        }

        console.log(
            `Image ${image.imageNumber}: READY`
        );

        console.log(
            `  ${image.path}`
        );

        console.log(
            `  ${stat.size} bytes`
        );
    }


    // ========================================================
    // STEP 2
    // ONLY NOW LOGIN TO DOCUFLOW
    // ========================================================

    console.log("");
    console.log("========================================");
    console.log(" STEP 2: DOCUFLOW");
    console.log("========================================");

    const token =
        await loginToDocuFlow();


    // ========================================================
    // STEP 3
    // CREATE RECORD
    // ========================================================

    const docuFlowResponse =
        await createDocuFlowRecord(
            record,
            token
        );

    const documentId =
        docuFlowResponse.document_id;

    console.log("");
    console.log(
        `DocuFlow Document ID: ${documentId}`
    );


    // ========================================================
    // STEP 4
    // UPLOAD CONVERTED IMAGES
    // ========================================================

    let uploaded = 0;

    for (const image of convertedImages) {

        await uploadAttachment(
            documentId,
            image.path,
            image.imageNumber,
            token
        );

        uploaded++;
    }


    // ========================================================
    // FINAL
    // ========================================================

    console.log("");
    console.log("========================================");
    console.log(" AUTOMATION COMPLETED");
    console.log("========================================");

    console.log("");
    console.log(
        `DocuFlow Document ID: ${documentId}`
    );

    console.log(
        `Images uploaded: ${uploaded}`
    );

    console.log("");
    console.log(
        "All required images were converted before " +
        "the DocuFlow record was created."
    );
}


main().catch(error => {

    console.error("");
    console.error("========================================");
    console.error(" AUTOMATION FAILED");
    console.error("========================================");
    console.error("");

    console.error(
        error.message || error
    );

    console.error("");

    process.exit(1);
});