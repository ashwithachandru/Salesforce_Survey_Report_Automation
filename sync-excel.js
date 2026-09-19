const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIGURATION
// ============================================================

const LOGIN_URL = "http://192.168.179.22:3000/api/auth/login";
const SYNC_URL = "http://192.168.179.22:3000/api/sync/record";

const USERNAME = "admin";
const PASSWORD = "password123";

// Excel file to sync
const EXCEL_FILE =
    "D:\\Ramraj_Intern\\salesforce-survey-downloader\\downloads\\Customer Complaints-Generic_2026-08-01_to_2026-08-31.xlsx";

// JSON file generated from Excel
const JSON_FILE =
    "D:\\Ramraj_Intern\\salesforce-survey-downloader\\downloads\\survey-data.json";

// Sync result log
const RESULT_FILE =
    "D:\\Ramraj_Intern\\salesforce-survey-downloader\\downloads\\sync-results.json";


// ============================================================
// 1. LOGIN AND GET JWT TOKEN
// ============================================================

async function getToken() {

    console.log("");
    console.log("========================================");
    console.log(" STEP 1 - LOGIN");
    console.log("========================================");

    const response = await fetch(LOGIN_URL, {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            username: USERNAME,
            password: PASSWORD,
            force_login: true
        })
    });

    const responseText = await response.text();

    let data;

    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(
            `Login returned invalid JSON:\n${responseText}`
        );
    }

    if (!response.ok) {
        throw new Error(
            `Login failed.\nHTTP Status: ${response.status}\nResponse: ${JSON.stringify(data)}`
        );
    }

    // Try the common token property names.
    const token =
        data.token ||
        data.accessToken ||
        data.access_token ||
        data.jwt ||
        data.data?.token ||
        data.data?.accessToken ||
        data.data?.access_token;

    if (!token) {

        console.log("Login response:");
        console.log(JSON.stringify(data, null, 2));

        throw new Error(
            "Login succeeded, but no JWT token was found in the response."
        );
    }

    console.log("Login successful.");
    console.log("JWT token received.");

    return token;
}


// ============================================================
// 2. READ EXCEL
// ============================================================

function readExcel() {

    console.log("");
    console.log("========================================");
    console.log(" STEP 2 - READ EXCEL");
    console.log("========================================");

    if (!fs.existsSync(EXCEL_FILE)) {

        throw new Error(
            `Excel file not found:\n${EXCEL_FILE}`
        );
    }

    console.log(`Excel file:\n${EXCEL_FILE}`);

    const workbook = XLSX.readFile(EXCEL_FILE);

    console.log(
        `Sheets found: ${workbook.SheetNames.join(", ")}`
    );

    // Use the first sheet
    const sheetName = workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];

    const records = XLSX.utils.sheet_to_json(
        worksheet,
        {
            defval: ""
        }
    );

    console.log(`Using sheet: ${sheetName}`);
    console.log(`Records found: ${records.length}`);

    return records;
}


// ============================================================
// 3. SAVE EXCEL DATA AS JSON
// ============================================================

function saveJson(records) {

    console.log("");
    console.log("========================================");
    console.log(" STEP 3 - CREATE JSON");
    console.log("========================================");

    fs.writeFileSync(
        JSON_FILE,
        JSON.stringify(records, null, 2),
        "utf8"
    );

    console.log("JSON file created:");
    console.log(JSON_FILE);
}


// ============================================================
// 4. SYNC ONE RECORD
// ============================================================

async function syncRecord(token, record, index, total) {

    console.log("");
    console.log("----------------------------------------");
    console.log(`Syncing record ${index} of ${total}`);
    console.log("----------------------------------------");

    console.log("JSON being sent:");

    console.log(
        JSON.stringify(record, null, 2)
    );

    const response = await fetch(SYNC_URL, {

        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },

        body: JSON.stringify(record)
    });

    const responseText = await response.text();

    let responseData;

    try {
        responseData = JSON.parse(responseText);
    } catch {
        responseData = responseText;
    }

    if (!response.ok) {

        console.log("");
        console.log(`FAILED - Record ${index}`);
        console.log(`HTTP Status: ${response.status}`);
        console.log("API Response:");
        console.log(
            JSON.stringify(responseData, null, 2)
        );

        return {
            success: false,
            recordNumber: index,
            status: response.status,
            record: record,
            response: responseData
        };
    }

    console.log("");
    console.log(`SUCCESS - Record ${index}`);
    console.log("API Response:");

    console.log(
        JSON.stringify(responseData, null, 2)
    );

    return {
        success: true,
        recordNumber: index,
        status: response.status,
        record: record,
        response: responseData
    };
}


// ============================================================
// 5. MAIN
// ============================================================

async function main() {

    try {

        console.log("");
        console.log("========================================");
        console.log(" SALESFORCE EXCEL → JSON → API SYNC");
        console.log("========================================");


        // ----------------------------------------------------
        // STEP 1
        // Login and get JWT
        // ----------------------------------------------------

        const token = await getToken();


        // ----------------------------------------------------
        // STEP 2
        // Read Excel
        // ----------------------------------------------------

        const records = readExcel();


        if (records.length === 0) {

            console.log("");
            console.log("Excel contains no records.");
            return;
        }


        // ----------------------------------------------------
        // STEP 3
        // Convert Excel → JSON
        // ----------------------------------------------------

        saveJson(records);


        // ----------------------------------------------------
        // STEP 4
        // Send JSON records to API
        // ----------------------------------------------------

        console.log("");
        console.log("========================================");
        console.log(" STEP 4 - SYNC DATA");
        console.log("========================================");

        console.log(
            `Total records to sync: ${records.length}`
        );

        const results = [];


        for (let i = 0; i < records.length; i++) {

            const result = await syncRecord(
                token,
                records[i],
                i + 1,
                records.length
            );

            results.push(result);
        }


        // ----------------------------------------------------
        // STEP 5
        // Save results
        // ----------------------------------------------------

        fs.writeFileSync(
            RESULT_FILE,
            JSON.stringify(results, null, 2),
            "utf8"
        );


        // ----------------------------------------------------
        // STEP 6
        // Summary
        // ----------------------------------------------------

        const successful =
            results.filter(
                result => result.success
            ).length;

        const failed =
            results.filter(
                result => !result.success
            ).length;


        console.log("");
        console.log("========================================");
        console.log(" SYNC COMPLETED");
        console.log("========================================");

        console.log(
            `Total records : ${records.length}`
        );

        console.log(
            `Successful    : ${successful}`
        );

        console.log(
            `Failed        : ${failed}`
        );

        console.log("");
        console.log("JSON file:");
        console.log(JSON_FILE);

        console.log("");
        console.log("Sync results:");
        console.log(RESULT_FILE);

        console.log("========================================");


    } catch (error) {

        console.log("");
        console.log("========================================");
        console.log(" SYNC FAILED");
        console.log("========================================");

        console.error(error.message);

        console.log("========================================");

        process.exit(1);
    }
}


// ============================================================
// START
// ============================================================

main();