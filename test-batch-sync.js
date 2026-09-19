const XLSX = require("xlsx");

const API_BASE = "http://192.168.179.22:3000";
const LOGIN_URL = `${API_BASE}/api/auth/login`;
const BATCH_URL = `${API_BASE}/api/sync/records/batch`;

const USERNAME = "admin";
const PASSWORD = "password123";

const EXCEL_FILE =
  "D:\\Ramraj_Intern\\salesforce-survey-downloader\\downloads\\Customer Complaints-Generic_2026-08-01_to_2026-08-31.xlsx";

// Exactly the 19 Salesforce fields requested.
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

function convertRecordToCustomData(row) {
  const customData = {};

  for (const field of REQUIRED_FIELDS) {
    customData[field] = cleanValue(row[field]);
  }

  return customData;
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

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Login returned invalid JSON:\n${text}`
    );
  }

  const token =
    data.access_token ||
    data.token ||
    data.accessToken;

  if (!token) {
    throw new Error(
      `Login succeeded but no JWT token was found.\nResponse:\n${JSON.stringify(data, null, 2)}`
    );
  }

  console.log("Login successful.");
  console.log("JWT token received.");

  return token;
}

function readAllRecords() {
  console.log("\nReading Excel...");

  const workbook = XLSX.readFile(EXCEL_FILE, {
    cellDates: true,
    defval: null
  });

  const sheetName = workbook.SheetNames[0];

  console.log(`Sheet: ${sheetName}`);

  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: null
  });

  if (!rows.length) {
    throw new Error("Excel contains no records.");
  }

  console.log(`Total records in Excel: ${rows.length}`);

  return rows;
}

function createDocKey(row, index) {
  const customerCode = cleanValue(row["Customer Code"]);
  const invoiceNumber = cleanValue(row["Invoice Number"]);
  const surveyDate = cleanValue(row["Survey Date"]);

  /*
   * Use the available Salesforce values to create
   * a more specific key for each complaint.
   *
   * No business data is invented.
   */
  const parts = [
    customerCode,
    invoiceNumber,
    surveyDate
  ].filter(value => value !== null);

  if (parts.length > 0) {
    return parts.join("_");
  }

  /*
   * Fallback only if the row has none of the above values.
   * This uses the Excel row number to keep the key unique
   * within this import.
   */
  return `SF-CUSTOMER-COMPLAINT-${index + 1}`;
}

function buildDocument(row, index) {
  const customData = convertRecordToCustomData(row);

  return {
    DocKey: createDocKey(row, index),

    DocNum: null,

    DocEntry: null,

    CompanyCode: null,

    division: null,

    TransType: "CUSTOMER COMPLAINT",

    Category: cleanValue(row["Type of Complaint"]),

    CostCenter: null,

    Branch: null,

    CardName: cleanValue(
      row["Dealer/Distributor Name"]
    ),

    CardCode: cleanValue(
      row["Customer Code"]
    ),

    GSTIN: null,

    DocRefNo: cleanValue(
      row["Invoice Number"]
    ),

    document_number: null,

    DocDate: cleanValue(
      row["Survey Date"]
    ),

    PONumber: null,

    /*
     * Do not invent financial values.
     *
     * The API requires these fields to be strings,
     * so empty strings are used.
     */
    currency: "",

    payment_terms: "",

    line_items: null,

    custom_data: customData,

    /*
     * This allows DocuFlow's existing routing
     * mechanism to process the document.
     */
    auto_route: true
  };
}

async function sendBatch(token, documents) {
  const payload = {
    documents: documents,
    sync_source: "Salesforce Customer Feedback"
  };

  console.log("\n========================================");
  console.log("BATCH REQUEST");
  console.log("========================================");

  console.log(
    `Total documents being sent: ${documents.length}`
  );

  console.log("\nSending records to:");
  console.log(BATCH_URL);

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

  let parsed;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = null;
  }

  return {
    status: response.status,
    body: parsed || responseText
  };
}

async function main() {
  try {
    console.log("========================================");
    console.log("DOCUFLOW BATCH SYNC");
    console.log("SALESFORCE CUSTOMER COMPLAINTS");
    console.log("========================================");

    // 1. Login
    const token = await login();

    // 2. Read ALL Excel records
    const rows = readAllRecords();

    // 3. Convert every Excel row into a DocuFlow document
    console.log(
      `\nBuilding ${rows.length} documents...`
    );

    const documents = rows.map((row, index) => {
      console.log(
        `Building record ${index + 1}/${rows.length}`
      );

      return buildDocument(row, index);
    });

    // 4. Show a summary before sending
    console.log("\n========================================");
    console.log("SYNC SUMMARY");
    console.log("========================================");

    console.log(
      `Excel records: ${rows.length}`
    );

    console.log(
      `Documents prepared: ${documents.length}`
    );

    console.log(
      `Auto routing: ENABLED`
    );

    console.log(
      `Salesforce fields per record: ${REQUIRED_FIELDS.length}`
    );

    // 5. Send ALL records in one batch
    const result = await sendBatch(
      token,
      documents
    );

    // 6. Final result
    console.log("\n========================================");
    console.log("SYNC COMPLETE");
    console.log("========================================");

    if (
      result.status >= 200 &&
      result.status < 300
    ) {
      console.log(
        "SUCCESS: DocuFlow accepted the batch request."
      );

      if (
        result.body &&
        typeof result.body === "object"
      ) {
        console.log(
          `Total received: ${
            result.body.total_received ?? "N/A"
          }`
        );

        console.log(
          `Successful: ${
            result.body.successful_count ?? "N/A"
          }`
        );

        console.log(
          `Failed: ${
            result.body.failed_count ?? "N/A"
          }`
        );

        if (
          Array.isArray(result.body.results)
        ) {
          console.log("\nIndividual results:");

          result.body.results.forEach(item => {
            console.log(
              `Record ${item.index + 1}: ` +
              `${item.status} | ` +
              `DocKey: ${item.doc_key} | ` +
              `Document ID: ${item.document_id} | ` +
              `Error: ${item.error}`
            );
          });
        }
      }
    } else {
      console.log(
        "DocuFlow rejected the batch request."
      );
    }

  } catch (error) {
    console.error("\n========================================");
    console.error("SYNC FAILED");
    console.error("========================================");

    console.error(error.message);

    process.exitCode = 1;
  }
}

main();