const XLSX = require("xlsx");

const API_BASE = "http://192.168.179.22:3000";

const USERNAME = "admin";
const PASSWORD = "password123";

const EXCEL_FILE =
  "D:\\Ramraj_Intern\\salesforce-survey-downloader\\downloads\\Customer Complaints-Generic_2026-08-01_to_2026-08-31.xlsx";

function cleanValue(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === "" ||
    String(value).trim() === "—" ||
    String(value).trim() === "-"
  ) {
    return null;
  }

  return String(value).trim();
}

async function main() {

  // ==========================================================
  // 1. LOGIN / GET TOKEN
  // ==========================================================

  console.log("1. Logging into DocuFlow...");

  const loginResponse = await fetch(
    `${API_BASE}/api/auth/login`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD,
        force_login: true
      })
    }
  );

  const loginText = await loginResponse.text();

  let loginData;

  try {
    loginData = JSON.parse(loginText);
  } catch {
    throw new Error(
      `Login returned invalid JSON.\nHTTP ${loginResponse.status}\n${loginText}`
    );
  }

  if (!loginResponse.ok) {
    throw new Error(
      `Login failed: ${loginResponse.status}\n` +
      JSON.stringify(loginData, null, 2)
    );
  }

  const token =
    loginData.access_token ||
    loginData.token ||
    loginData.accessToken;

  if (!token) {
    throw new Error(
      "Login succeeded but no access token was returned:\n" +
      JSON.stringify(loginData, null, 2)
    );
  }

  console.log("Login successful.");
  console.log("Token received.");

  // ==========================================================
  // 2. READ EXCEL
  // ==========================================================

  console.log("\n2. Reading Excel...");

  const workbook = XLSX.readFile(EXCEL_FILE);

  const sheet = workbook.Sheets["Survey Report"];

  if (!sheet) {
    throw new Error(
      "Sheet 'Survey Report' was not found."
    );
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: null
  });

  if (rows.length === 0) {
    throw new Error(
      "No records found in the Survey Report sheet."
    );
  }

  // IMPORTANT:
  // Send ONLY the first record.
  const row = rows[0];

  console.log("Using ONLY Excel row 1.");

  console.log("\nSalesforce record:");

  console.log(
    JSON.stringify(row, null, 2)
  );

  // ==========================================================
  // 3. BUILD ONE DOCUFLOW DOCUMENT
  // ==========================================================

  console.log("\n3. Mapping Salesforce fields...");

  const document = {

    // dbo.documents.doc_key
    DocKey:
      `${cleanValue(row["Customer Code"])}_${cleanValue(row["Invoice Number"])}_${cleanValue(row["Survey Date"])}`,

    // dbo.documents.doc_num
    DocNum:
      cleanValue(row["Invoice Number"]),

    // dbo.documents.doc_date
    DocDate:
      cleanValue(row["Survey Date"]),

    // dbo.documents.party_name
    party_name:
      cleanValue(row["Account Name"]),

    // dbo.documents.party_code
    party_code:
      cleanValue(row["Business Partner Code"]),

    // dbo.documents.contact_person
    contact_person:
      cleanValue(row["Employee Name"]),

    // dbo.documents.division
    division:
      cleanValue(row["Employee Division"]),

    // dbo.documents.vendor_name
    CardName:
      cleanValue(row["Dealer/Distributor Name"]),

    // dbo.documents.vendor_code
    CardCode:
      cleanValue(row["Customer Code"]),

    // dbo.documents.invoice_number
    DocRefNo:
      cleanValue(row["Invoice Number"]),

    // General document number
    document_number:
      cleanValue(row["Invoice Number"]),

    // dbo.documents.category
    Category:
      cleanValue(row["Type of Complaint"]),

    // dbo.documents.document_type
    TransType:
      "CUSTOMER COMPLAINT",

    // Required by current /api/sync/record validation
    DocTotal: 1,

    base_amount: 1,

    tax_amount: 0,

    currency: "INR",

    payment_terms: "Net 30",

    // Do not run workflow rules for this test.
    auto_route: false
  };

  console.log("\nDocument being sent:");

  console.log(
    JSON.stringify(document, null, 2)
  );

  // ==========================================================
  // 4. SEND ONE RECORD
  // ==========================================================

  console.log(
    "\n4. Sending ONE record to /api/sync/record..."
  );

  const syncResponse = await fetch(
    `${API_BASE}/api/sync/record`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },

      body: JSON.stringify(document)
    }
  );

  const syncText = await syncResponse.text();

  let syncData;

  try {
    syncData = JSON.parse(syncText);
  } catch {
    throw new Error(
      `Sync returned invalid JSON.\n` +
      `HTTP ${syncResponse.status}\n` +
      syncText
    );
  }

  console.log("\nHTTP STATUS:");
  console.log(syncResponse.status);

  console.log("\nSYNC RESPONSE:");

  console.log(
    JSON.stringify(syncData, null, 2)
  );

  if (!syncResponse.ok) {
    throw new Error(
      `Record sync failed: ${syncResponse.status}`
    );
  }

  console.log(
    "\nSUCCESS: ONE RECORD SENT TO DOCUFLOW."
  );
}

main().catch(error => {

  console.error("\nERROR:");
  console.error(error.message);

  process.exit(1);
});