const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const IMAGE_URL =
  "https://ramrajcotton--rrpartial.sandbox.my.salesforce.com/sfc/servlet.shepherd/version/download/068Bh000005U1S3IAK";

const OUTPUT_FILE = path.join(
  __dirname,
  "cust-feeback-img1-2026-08-19.jpg"
);

const TEMP_SCRIPT = path.join(
  __dirname,
  "fetch-salesforce-image.js"
);

const playwrightCode = `
const result = await page.evaluate(async (url) => {
  const response = await fetch(url, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(
      "Salesforce image request failed: HTTP " + response.status
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      "Response is not an image. Content-Type: " + contentType
    );
  }

  const buffer = await response.arrayBuffer();

  return {
    contentType,
    base64: Buffer.from(buffer).toString("base64")
  };
}, ${JSON.stringify(IMAGE_URL)});

console.log(JSON.stringify(result));
`;

try {
  console.log("========================================");
  console.log("SALESFORCE IMAGE CONVERTER");
  console.log("========================================");

  console.log("Image URL:");
  console.log(IMAGE_URL);

  console.log("\\nUsing existing Chrome session...");

  fs.writeFileSync(
    TEMP_SCRIPT,
    playwrightCode,
    "utf8"
  );

  // Use the same command that works from your terminal.
  const command =
    `playwright-cli -s=chrome run-code --filename=./fetch-salesforce-image.js`;

  const output = execSync(command, {
    cwd: __dirname,
    encoding: "utf8",
    shell: true,
    maxBuffer: 50 * 1024 * 1024
  });

  const lines = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  let result = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]);

      if (parsed && parsed.base64) {
        result = parsed;
        break;
      }
    } catch {}
  }

  if (!result) {
    throw new Error(
      "Image Base64 data was not returned by Playwright.\\n\\n" +
      output
    );
  }

  console.log("\\nContent-Type:");
  console.log(result.contentType);

  const imageBuffer = Buffer.from(
    result.base64,
    "base64"
  );

  console.log(
    "Downloaded bytes:",
    imageBuffer.length
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    imageBuffer
  );

  console.log("\\n========================================");
  console.log("IMAGE SAVED SUCCESSFULLY");
  console.log("========================================");

  console.log("File:");
  console.log(OUTPUT_FILE);

} catch (error) {
  console.log("\\n========================================");
  console.log("IMAGE CONVERSION FAILED");
  console.log("========================================");

  console.error(error.message);

} finally {
  if (fs.existsSync(TEMP_SCRIPT)) {
    fs.unlinkSync(TEMP_SCRIPT);
  }
}