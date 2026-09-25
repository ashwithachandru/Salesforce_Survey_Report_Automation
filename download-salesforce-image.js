async page => {

  const downloadPage =
    await page.context().newPage();

  console.log(
    "DOWNLOAD_TAB_CREATED"
  );

  const downloadPromise =
    downloadPage.waitForEvent(
      "download",
      {
        timeout: 600000
      }
    );

  try {

    await downloadPage.goto(
      "https://ramrajcotton--rrpartial.sandbox.my.salesforce.com/sfc/servlet.shepherd/version/download/068Bh000005U1S3IAK",
      {
        waitUntil: "commit",
        timeout: 60000
      }
    );

  } catch (navigationError) {

    console.log(
      "NAVIGATION_ERROR=" +
      navigationError.message
    );
  }

  let download = null;

  try {

    download =
      await downloadPromise;

  } catch (downloadError) {

    console.log(
      "DOWNLOAD_WAIT_ERROR=" +
      downloadError.message
    );
  }

  if (!download) {

    console.log(
      "NO_DOWNLOAD_EVENT"
    );

  } else {

    console.log(
      "DOWNLOAD_FILENAME=" +
      download.suggestedFilename()
    );

    try {

      await download.saveAs(
        "D:\\Ramraj_Intern\\salesforce-survey-downloader\\temp-images\\salesforce-image-download"
      );

      console.log(
        "DOWNLOAD_SAVED"
      );

    } catch (saveError) {

      console.log(
        "SAVE_ERROR=" +
        saveError.message
      );
    }
  }

  try {

    await downloadPage.close();

  } catch (_) {}

  console.log(
    "DOWNLOAD_PROCESS_FINISHED"
  );
}