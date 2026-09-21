const XLSX = require("xlsx");

// ============================================================
// DocuFlow API
// DO NOT MODIFY THESE ENDPOINTS
// ============================================================

const LOGIN_ENDPOINT =
  "http://192.168.179.22:3000/api/auth/login";

const SYNC_ENDPOINT =
  "http://192.168.179.22:3000/api/sync/record";

// ============================================================
// Credentials
// ============================================================

const USERNAME = "admin";
const PASSWORD = "password123";

// ============================================================
// Excel file
// ============================================================

const EXCEL_FILE =
  "D:\\Ramraj_Intern\\salesforce-survey-downloader\\downloads\\Customer Complaints-Generic_2026-08-01_to_2026-08-31.xlsx";

// ============================================================
// Helpers
// ============================================================

function cleanValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const str = String(value).trim();

  if (!str || str === "-" || str === "—") {
    return null;
  }

  return str;
}

// ============================================================
// Main
// ============================================================

async function main() {
  try {
    // ----------------------------------------------------------
    // 1. Read Excel
    // ----------------------------------------------------------

    console.log("1. Reading Excel file...");

    const workbook = XLSX.readFile(EXCEL_FILE);

    const sheetName = "Survey Report";

    if (!workbook.Sheets[sheetName]) {
      throw new Error(
        `Sheet "${sheetName}" was not found in the Excel file.`
      );
    }

    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: null
    });

    if (!rows.length) {
      throw new Error("No records found in the Excel file.");
    }

    // For now, sync only the first record.
    const row = rows[0];

    console.log("Excel record found.");
    console.log(
      `Account Name: ${cleanValue(row["Account Name"])}`
    );
    console.log(
      `Invoice Number: ${cleanValue(row["Invoice Number"])}`
    );

    // ----------------------------------------------------------
    // 2. Generate a NEW DocuFlow token
    // ----------------------------------------------------------

    console.log("\n2. Generating NEW DocuFlow token...");

    const loginResponse = await fetch(LOGIN_ENDPOINT, {
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

    const loginText = await loginResponse.text();

    if (!loginResponse.ok) {
      throw new Error(
        `DocuFlow login failed: HTTP ${loginResponse.status}\n${loginText}`
      );
    }

    let loginData;

    try {
      loginData = JSON.parse(loginText);
    } catch {
      throw new Error(
        `DocuFlow login returned invalid JSON:\n${loginText}`
      );
    }

    const token =
      loginData.access_token ||
      loginData.token;

    if (!token) {
      throw new Error(
        "DocuFlow login succeeded, but no access token was returned."
      );
    }

    console.log("NEW DocuFlow token generated successfully.");

    // ----------------------------------------------------------
    // 3. Build document
    // ----------------------------------------------------------

    console.log("\n3. Preparing survey record...");

    const surveyDate =
      cleanValue(row["Survey Date"]);

    const customerCode =
      cleanValue(row["Customer Code"]);

    const invoiceNumber =
      cleanValue(row["Invoice Number"]);

    const document = {
      // --------------------------------------------------------
      // Standard DocuFlow fields
      // --------------------------------------------------------

      DocKey:
        `${customerCode}_${invoiceNumber}_${surveyDate}`,

      DocNum:
        invoiceNumber,

      DocDate:
        surveyDate,

      party_name:
        cleanValue(row["Account Name"]),

      party_code:
        cleanValue(row["Business Partner Code"]),

      contact_person:
        cleanValue(row["Employee Name"]),

      division:
        cleanValue(row["Employee Division"]),

      CardName:
        cleanValue(row["Dealer/Distributor Name"]),

      CardCode:
        customerCode,

      DocRefNo:
        invoiceNumber,

      document_number:
        invoiceNumber,

      Category:
        cleanValue(row["Type of Complaint"]),

      TransType:
        "CUSTOMER COMPLAINT",

      // The current single-record endpoint requires
      // a positive amount.
      DocTotal: 1,

      base_amount: 1,

      tax_amount: 0,

      currency: "INR",

      payment_terms: "Net 30",

      auto_route: false,

      // --------------------------------------------------------
      // Salesforce Survey fields
      //
      // These names correspond to the physical columns
      // already present in dbo.documents.
      // --------------------------------------------------------

      account_name:
        cleanValue(row["Account Name"]),

      bp_code:
        cleanValue(row["Business Partner Code"]),

      employee_name:
        cleanValue(row["Employee Name"]),

      employee_id:
        cleanValue(row["Employee ID"]),

      employee_division:
        cleanValue(row["Employee Division"]),

      employee_segment:
        cleanValue(row["Employee Segment"]),

      survey_date:
        surveyDate,

      subtype_of_complaint:
        cleanValue(row["Subtype of complaint"]),

      additional_comments:
        cleanValue(row["Additional Comments"]),

      dealer_name:
        cleanValue(row["Dealer/Distributor Name"]),

      bp_type:
        cleanValue(row["BP Type"]),

      type_of_complaint:
        cleanValue(row["Type of Complaint"]),

      customer_code:
        customerCode,

      image_1:
        cleanValue(row["Image 1"]),

      image_2:
        cleanValue(row["Image 2"]),

      image_3:
        cleanValue(row["Image 3"]),

      image_4:
        cleanValue(row["Image 4"]),

      image_5:
        cleanValue(row["Image 5"])
    };

    console.log("\nSurvey fields being sent:");

    console.log(
      JSON.stringify(
        {
          account_name: document.account_name,
          bp_code: document.bp_code,
          employee_name: document.employee_name,
          employee_id: document.employee_id,
          employee_division: document.employee_division,
          employee_segment: document.employee_segment,
          survey_date: document.survey_date,
          subtype_of_complaint:
            document.subtype_of_complaint,
          additional_comments:
            document.additional_comments,
          dealer_name: document.dealer_name,
          bp_type: document.bp_type,
          type_of_complaint:
            document.type_of_complaint,
          customer_code: document.customer_code,
          invoice_number: document.invoice_number,
          image_1: document.image_1,
          image_2: document.image_2,
          image_3: document.image_3,
          image_4: document.image_4,
          image_5: document.image_5
        },
        null,
        2
      )
    );

    // ----------------------------------------------------------
    // 4. Sync using EXACT endpoint
    // ----------------------------------------------------------

    console.log(
      "\n4. Syncing record using /api/sync/record..."
    );

    const syncResponse = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(document)
    });

    const syncText = await syncResponse.text();

    if (!syncResponse.ok) {
      throw new Error(
        `DocuFlow sync failed: HTTP ${syncResponse.status}\n${syncText}`
      );
    }

    let syncData;

    try {
      syncData = JSON.parse(syncText);
    } catch {
      syncData = syncText;
    }

    // ----------------------------------------------------------
    // 5. Result
    // ----------------------------------------------------------

    console.log("\n========================================");
    console.log("SYNC SUCCESSFUL");
    console.log("========================================");

    console.log(
      JSON.stringify(syncData, null, 2)
    );

    console.log("\nRecord sent successfully to:");
    console.log(SYNC_ENDPOINT);

    console.log("\nA new token was generated for this run.");
  } catch (error) {
    console.log("\n========================================");
    console.log("ERROR");
    console.log("========================================");

    console.error(error.message);
  }
}

main();