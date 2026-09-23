const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { execFileSync } = require("child_process");
const XLSX = require("xlsx");
const sharp = require("sharp");

// ============================================================
// CONFIGURATION
// ============================================================

const PROJECT_DIR =
  "D:\\Ramraj_Intern\\salesforce-survey-downloader";

const DOWNLOAD_DIR =
  path.join(PROJECT_DIR, "downloads");

const TEMP_DIR =
  path.join(PROJECT_DIR, "temp-image");

const EXCEL_FILE =
  path.join(
    DOWNLOAD_DIR,
    "Customer Complaints-Generic_2026-08-01_to_2026-08-31.xlsx"
  );

// DocuFlow
const LOGIN_ENDPOINT =
  "http://192.168.179.22:3000/api/auth/login";

const SYNC_ENDPOINT =
  "http://192.168.179.22:3000/api/sync/record";

const ATTACHMENT_ENDPOINT_BASE =
  "http://192.168.179.22:3000/api/sync/record";

const USERNAME = "admin";
const PASSWORD = "password123";

// Salesforce Playwright CLI
const PLAYWRIGHT_CLI =
  "C:\\Users\\Ashwitha\\AppData\\Roaming\\npm\\playwright-cli.cmd";

// ============================================================
// CREATE TEMP DIRECTORY
// ============================================================

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, {
      recursive: true
    });
  }
}

// ============================================================
// READ THIRD EXCEL RECORD
// ============================================================

function readThirdRecord() {
  if (!fs.existsSync(EXCEL_FILE)) {
    throw new Error(
      `Excel file not found:\n${EXCEL_FILE}`
    );
  }

  const workbook =
    XLSX.readFile(EXCEL_FILE);

  const sheetName =
    workbook.SheetNames[0];

  const worksheet =
    workbook.Sheets[sheetName];

  const rows =
    XLSX.utils.sheet_to_json(
      worksheet,
      {
        defval: ""
      }
    );

  console.log(
    `Total Excel data rows: ${rows.length}`
  );

  if (rows.length < 3) {
    throw new Error(
      "Excel file contains fewer than 3 data rows."
    );
  }

  // Excel data row #3
  const record = rows[2];

  console.log(
    "Selected record: Excel data row #3"
  );

  console.log(
    "Account Name:",
    record["Account Name"]
  );

  console.log(
    "Business Partner Code:",
    record["Business Partner Code"]
  );

  console.log(
    "Employee Name:",
    record["Employee Name"]
  );

  console.log(
    "Survey Date:",
    record["Survey Date"]
  );

  console.log(
    "Image 1:",
    record["Image 1"]
  );

  console.log(
    "Image 2:",
    record["Image 2"]
  );

  console.log(
    "Image 3:",
    record["Image 3"]
  );

  console.log(
    "Image 4:",
    record["Image 4"]
  );

  console.log(
    "Image 5:",
    record["Image 5"]
  );

  return record;
}

// ============================================================
// LOGIN TO DOCUFLOW
// ============================================================

async function loginToDocuFlow() {
  const response =
    await fetch(
      LOGIN_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          username: USERNAME,
          password: PASSWORD
        })
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `DocuFlow login failed. HTTP ${response.status}\n${text}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `DocuFlow login returned invalid JSON:\n${text}`
    );
  }

  const token =
    data.access_token ||
    data.token ||
    data.accessToken;

  if (!token) {
    throw new Error(
      `DocuFlow login succeeded but no token was returned.\nResponse:\n${text}`
    );
  }

  console.log(
    "DocuFlow login successful."
  );

  return token;
}

// ============================================================
// CREATE DOCUFLOW RECORD
// ============================================================

async function createDocuFlowRecord(
  record,
  token
) {
  // Build the normal record payload.
  //
  // IMPORTANT:
  // Image URLs are NOT sent as the final image attachments.
  // They are processed separately below.

  const document = {
    ...record
  };

  const response =
    await fetch(
      SYNC_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },

        body: JSON.stringify(document)
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `DocuFlow record creation failed. HTTP ${response.status}\n${text}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `DocuFlow record creation returned invalid JSON:\n${text}`
    );
  }

  const documentId =
    data.document_id ||
    data.id ||
    data.record_id;

  if (!documentId) {
    throw new Error(
      `DocuFlow record created but no document ID was returned.\nResponse:\n${text}`
    );
  }

  console.log(
    "DocuFlow record created successfully."
  );

  console.log(
    "Document ID:",
    documentId
  );

  return documentId;
}

// ============================================================
// FETCH IMAGE USING EXISTING PLAYWRIGHT CHROME SESSION
// ============================================================

function fetchImageUsingExistingChrome(
  imageUrl
) {
  console.log("");
  console.log(
    "Fetching image using existing Chrome session..."
  );

  console.log(
    "URL:",
    imageUrl
  );

  if (
    !fs.existsSync(PLAYWRIGHT_CLI)
  ) {
    throw new Error(
      `playwright-cli was not found at:\n${PLAYWRIGHT_CLI}`
    );
  }

  const safeUrl =
    JSON.stringify(imageUrl);

  /*
   * This code runs INSIDE the existing Playwright
   * Chrome session.
   *
   * It therefore has access to the Salesforce
   * authenticated browser session/cookies.
   */

  const script = `
// ============================================================
// TEMPORARY PLAYWRIGHT-CLI IMAGE FETCHER
// ============================================================

const imageUrl = ${safeUrl};

console.log(
  "Requesting Salesforce image..."
);

const response = await fetch(
  imageUrl,
  {
    credentials: "include"
  }
);

if (!response.ok) {
  throw new Error(
    "Salesforce image request failed. HTTP " +
    response.status
  );
}

const contentType =
  response.headers.get(
    "content-type"
  ) || "";

console.log(
  "Salesforce response Content-Type:",
  contentType
);

if (
  !contentType
    .toLowerCase()
    .startsWith("image/")
) {
  const text =
    await response.text();

  throw new Error(
    "Salesforce URL did not return an image. " +
    "Content-Type: " +
    contentType +
    ". Response starts with: " +
    text.substring(0, 200)
  );
}

const buffer =
  await response.arrayBuffer();

const bytes =
  new Uint8Array(buffer);

let binary = "";

const chunkSize = 8192;

for (
  let i = 0;
  i < bytes.length;
  i += chunkSize
) {
  const chunk =
    bytes.subarray(
      i,
      Math.min(
        i + chunkSize,
        bytes.length
      )
    );

  binary +=
    String.fromCharCode(...chunk);
}

const base64 =
  btoa(binary);

console.log(
  JSON.stringify({
    success: true,
    contentType,
    base64
  })
);
`;

  ensureTempDir();

  const tempScript =
    path.join(
      TEMP_DIR,
      `fetch-image-${Date.now()}.js`
    );

  fs.writeFileSync(
    tempScript,
    script,
    "utf8"
  );

  try {
    /*
     * Windows cannot directly spawn a .cmd file
     * with spawnSync/execFileSync in this situation.
     *
     * Therefore:
     *
     * Node
     *   -> cmd.exe
     *      -> playwright-cli.cmd
     *         -> -s=chrome
     *            -> existing Chrome session
     */

    const command =
      `"${PLAYWRIGHT_CLI}" -s=chrome run-code --filename=".\\${path.basename(tempScript)}"`;

    console.log(
      "Running Playwright CLI..."
    );

    const output =
      execFileSync(
        "cmd.exe",
        [
          "/d",
          "/s",
          "/c",
          command
        ],
        {
          cwd: TEMP_DIR,

          encoding: "utf8",

          maxBuffer:
            100 * 1024 * 1024,

          windowsHide: true
        }
      );

    const lines =
      output
        .split(/\r?\n/)
        .map(
          line => line.trim()
        )
        .filter(Boolean);

    /*
     * Find the JSON line generated by
     * the temporary Playwright script.
     */

    let result = null;

    for (
      const line of lines
    ) {
      try {
        const parsed =
          JSON.parse(line);

        if (
          parsed &&
          parsed.success === true &&
          parsed.base64
        ) {
          result = parsed;
        }
      } catch {
        // Ignore non-JSON Playwright output.
      }
    }

    if (!result) {
      throw new Error(
        "Could not find image Base64 data in Playwright output.\n\n" +
        output
      );
    }

    console.log(
      "Salesforce image downloaded successfully."
    );

    console.log(
      "Original Content-Type:",
      result.contentType
    );

    return {
      base64:
        result.base64,

      contentType:
        result.contentType
    };
  } finally {
    /*
     * Delete temporary Playwright script.
     */

    try {
      if (
        fs.existsSync(tempScript)
      ) {
        fs.unlinkSync(
          tempScript
        );
      }
    } catch {
      // Ignore cleanup errors.
    }
  }
}

// ============================================================
// CONVERT IMAGE TO JPEG
// ============================================================

async function convertBase64ToJpeg(
  base64,
  outputFile
) {
  const inputBuffer =
    Buffer.from(
      base64,
      "base64"
    );

  await sharp(inputBuffer)
    .jpeg({
      quality: 90
    })
    .toFile(outputFile);

  console.log(
    "Image converted to JPEG."
  );

  return outputFile;
}

// ============================================================
// UPLOAD BASE64 ATTACHMENT
// ============================================================

async function uploadAttachment(
  documentId,
  filePath,
  fileName,
  token
) {
  const fileBuffer =
    fs.readFileSync(
      filePath
    );

  const base64 =
    fileBuffer.toString(
      "base64"
    );

  const endpoint =
    `${ATTACHMENT_ENDPOINT_BASE}/${encodeURIComponent(documentId)}/attachment/base64`;

  console.log(
    "Uploading attachment..."
  );

  console.log(
    "Filename:",
    fileName
  );

  const response =
    await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },

        body: JSON.stringify({
          file_name: fileName,

          file_content_base64:
            base64,

          attachment_type:
            "Original Invoice",

          uploaded_by:
            "ERP AutoSync"
        })
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Attachment upload failed. HTTP ${response.status}\n${text}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  console.log(
    "Attachment uploaded successfully."
  );

  return data;
}

// ============================================================
// DATE FOR IMAGE FILENAME
// ============================================================

function getSurveyDateOnly(
  surveyDate
) {
  if (!surveyDate) {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  /*
   * Handles:
   *
   * 2026-08-19 16:33:45
   *
   * and avoids changing the date because
   * of timezone conversion.
   */

  const value =
    String(surveyDate)
      .trim();

  const match =
    value.match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  if (match) {
    return match[1];
  }

  return new Date()
    .toISOString()
    .slice(0, 10);
}

// ============================================================
// PROCESS ONE IMAGE
// ============================================================

async function processImage(
  imageUrl,
  imageNumber,
  surveyDate,
  documentId,
  token
) {
  if (
    !imageUrl ||
    !String(imageUrl).trim()
  ) {
    console.log(
      `Image ${imageNumber}: empty - skipping`
    );

    return;
  }

  console.log("");
  console.log(
    `---------- IMAGE ${imageNumber} ----------`
  );

  console.log(
    "Original Excel value:"
  );

  console.log(
    imageUrl
  );

  let temporaryJpeg = null;

  try {
    /*
     * 1. Fetch actual image bytes
     *    using existing Chrome session.
     */

    const image =
      fetchImageUsingExistingChrome(
        String(imageUrl).trim()
      );

    /*
     * 2. Create temporary JPEG.
     */

    ensureTempDir();

    const surveyDateOnly =
      getSurveyDateOnly(
        surveyDate
      );

    /*
     * Example:
     *
     * cust-feeback-img1-2026-08-19.jpg
     */

    const fileName =
      `cust-feeback-img${imageNumber}-${surveyDateOnly}.jpg`;

    temporaryJpeg =
      path.join(
        TEMP_DIR,
        `${Date.now()}-${fileName}`
      );

    await convertBase64ToJpeg(
      image.base64,
      temporaryJpeg
    );

    /*
     * 3. Upload actual image to
     *    the DocuFlow record.
     */

    await uploadAttachment(
      documentId,
      temporaryJpeg,
      fileName,
      token
    );

    console.log(
      `Image ${imageNumber} completed successfully.`
    );

  } catch (error) {
    console.error(
      `IMAGE ${imageNumber} FAILED`
    );

    console.error(
      error.message
    );
  } finally {
    /*
     * Delete temporary JPEG.
     *
     * Original Excel is NOT modified.
     */

    if (
      temporaryJpeg &&
      fs.existsSync(
        temporaryJpeg
      )
    ) {
      try {
        fs.unlinkSync(
          temporaryJpeg
        );

        console.log(
          "Temporary image deleted."
        );
      } catch {
        // Ignore cleanup failure.
      }
    }
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(
    "Using existing Playwright Chrome session."
  );

  /*
   * Read third Excel record.
   */

  const record =
    readThirdRecord();

  /*
   * Login to DocuFlow.
   */

  const token =
    await loginToDocuFlow();

  /*
   * Create normal DocuFlow record.
   */

  const documentId =
    await createDocuFlowRecord(
      record,
      token
    );

  /*
   * Process Image 1-5.
   */

  await processImage(
    record["Image 1"],
    1,
    record["Survey Date"],
    documentId,
    token
  );

  await processImage(
    record["Image 2"],
    2,
    record["Survey Date"],
    documentId,
    token
  );

  await processImage(
    record["Image 3"],
    3,
    record["Survey Date"],
    documentId,
    token
  );

  await processImage(
    record["Image 4"],
    4,
    record["Survey Date"],
    documentId,
    token
  );

  await processImage(
    record["Image 5"],
    5,
    record["Survey Date"],
    documentId,
    token
  );

  console.log("");
  console.log(
    "============================================================"
  );

  console.log(
    "THIRD RECORD PROCESSING COMPLETED"
  );

  console.log(
    "DocuFlow Document ID:",
    documentId
  );

  console.log(
    "============================================================"
  );
}

// ============================================================
// ERROR HANDLER
// ============================================================

main()
  .catch(
    error => {
      console.error("");
      console.error(
        "AUTOMATION FAILED"
      );

      console.error(
        error.message
      );

      process.exit(
        1
      );
    }
  );