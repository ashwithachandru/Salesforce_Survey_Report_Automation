const XLSX = require("xlsx");

const API_BASE = "http://192.168.179.22:3000";
const LOGIN_URL = `${API_BASE}/api/auth/login`;
const BATCH_URL = `${API_BASE}/api/sync/records/batch`;

const USERNAME = "admin";
const PASSWORD = "password123";

const EXCEL_FILE =
  "D:\\Ramraj_Intern\\salesforce-survey-downloader\\downloads\\Customer Complaints-Generic_2026-08-01_to_2026-08-31.xlsx";

// Exactly the 19 Salesforce fields.
const REQUIRED_FIELDS = [
  "Account Name",
  "Business Partner Code",
  "Employee Name",
  "Employee ID",
  "Employee Division",
  "Employee Segment",
  "Survey Date",
  "Subtype of complaint",
  "Additional Comments",
  "Dealer/Distributor Name",
  "BP Type",
  "Type of Complaint",
  "Customer Code",
  "Invoice Number",
  "Image 1",
  "Image 2",
  "Image 3",
  "Image 4",
  "Image 5"
];

function cleanValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (
      trimmed === "" ||
      trimmed === "—" ||
      trimmed === "-"
    ) {
      return null;
    }

    return trimmed;
  }

  return value;
}

async function login() {
  console.log("Logging in...");

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

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Login failed: HTTP ${response.status}\n${text}`
    );
  }

  const data = JSON.parse(text);

  const token =
    data.access_token ||
    data.token ||
    data.accessToken;

  if (!token) {
    throw new Error(
      "Login succeeded but no JWT token was found."
    );
  }

  console.log("Login successful.");
  console.log("JWT token received.");

  return token;
}

function readFirstRecord() {
  console.log("\nReading Excel...");

  const workbook = XLSX.readFile(EXCEL_FILE, {
    cellDates: true,
    defval: null
  });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: null
  });

  if (!rows.length) {
    throw new Error("Excel contains no records.");
  }

  console.log(`Sheet: ${sheetName}`);
  console.log(`Total records in Excel: ${rows.length}`);
  console.log("Using ONLY record 1.");

  return rows[0];
}

function buildDocument(row) {
  const customData = {};

  for (const field of REQUIRED_FIELDS) {
    customData[field] = cleanValue(row[field]);
  }

  const customerCode = cleanValue(row["Customer Code"]);
  const invoiceNumber = cleanValue(row["Invoice Number"]);
  const surveyDate = cleanValue(row["Survey Date"]);

  const parts = [
    customerCode,
    invoiceNumber,
    surveyDate
  ].filter(value => value !== null);

  const docKey =
    parts.length > 0
      ? parts.join("_")
      : "SF-CUSTOMER-COMPLAINT-TEST-ONE";

  return {
    DocKey: docKey,
    DocNum: null,
    DocEntry: null,
    CompanyCode: null,
    division: null,
    TransType: "CUSTOMER COMPLAINT",
    Category: cleanValue(row["Type of Complaint"]),
    CostCenter: null,
    Branch: null,
    CardName: cleanValue(row["Dealer/Distributor Name"]),
    CardCode: cleanValue(row["Customer Code"]),
    GSTIN: null,
    DocRefNo: cleanValue(row["Invoice Number"]),
    document_number: null,
    DocDate: cleanValue(row["Survey Date"]),
    PONumber: null,
    currency: "",
    payment_terms: "",
    line_items: null,
    custom_data: customData,
    auto_route: true
  };
}

async function sendOneRecord(token, document) {
  const payload = {
    documents: [document],
    sync_source: "Salesforce Customer Feedback - Test One"
  };

  console.log("\n========================================");
  console.log("SENDING ONE RECORD");
  console.log("========================================");

  console.log("Endpoint:");
  console.log(BATCH_URL);

  console.log("\nDocKey:");
  console.log(document.DocKey);

  console.log("\nSending...");

  const response = await fetch(BATCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();

  console.log("\n========================================");
  console.log("API RESPONSE");
  console.log("========================================");

  console.log(`HTTP Status: ${response.status}`);
  console.log(responseText);

  if (response.ok) {
    console.log("\nSUCCESS: One record was accepted by DocuFlow.");
  } else {
    console.log("\nFAILED: DocuFlow rejected the record.");
  }
}

async function main() {
  try {
    console.log("========================================");
    console.log("DOCUFLOW TEST - ONE RECORD");
    console.log("SALESFORCE CUSTOMER COMPLAINT");
    console.log("========================================");

    const token = await login();

    const row = readFirstRecord();

    const document = buildDocument(row);

    console.log("\nRecord prepared.");
    console.log(`Salesforce fields: ${REQUIRED_FIELDS.length}`);
    console.log(`Auto routing: ENABLED`);

    await sendOneRecord(token, document);

  } catch (error) {
    console.error("\n========================================");
    console.error("TEST FAILED");
    console.error("========================================");

    console.error(error.message);

    process.exitCode = 1;
  }
}

main();