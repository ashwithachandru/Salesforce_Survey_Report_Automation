$ProjectDir = "D:\Ramraj_Intern\salesforce-survey-downloader"
$SourceDir = "$env:USERPROFILE\Downloads"
$DestinationDir = "$ProjectDir\downloads"

$FromDate = "2026-08-01"
$ToDate = "2026-08-31"
$ReportName = "Customer Complaints-Generic"

$DestinationFile = Join-Path `
    $DestinationDir `
    "${ReportName}_${FromDate}_to_${ToDate}.xlsx"

# Make sure destination exists
if (!(Test-Path $DestinationDir)) {
    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
}

# Record time before starting Salesforce automation
$StartTime = Get-Date

Write-Host ""
Write-Host "========================================"
Write-Host " Salesforce Survey Report Automation"
Write-Host "========================================"
Write-Host ""

Set-Location $ProjectDir

Write-Host "Starting Playwright automation..."
Write-Host ""

playwright-cli -s=chrome run-code --filename=.\download-survey.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Salesforce automation failed."
    exit 1
}

Write-Host ""
Write-Host "Salesforce automation finished."
Write-Host "Waiting for Excel download..."
Write-Host ""

# Find the NEW SurveyReport file
$DownloadedFile = $null

for ($i = 1; $i -le 30; $i++) {

    Start-Sleep -Seconds 1

    $DownloadedFile = Get-ChildItem `
        "$SourceDir\SurveyReport*.xlsx" `
        -ErrorAction SilentlyContinue |
        Where-Object {
            $_.LastWriteTime -ge $StartTime
        } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($DownloadedFile) {
        break
    }

    Write-Host "Waiting for download... $i/30"
}

if (!$DownloadedFile) {
    Write-Host ""
    Write-Host "ERROR: New SurveyReport Excel file was not found."
    Write-Host "Checked: $SourceDir"
    exit 1
}

Write-Host ""
Write-Host "Download found:"
Write-Host "  $($DownloadedFile.FullName)"
Write-Host ""

# Give Chrome time to finish writing the file
Start-Sleep -Seconds 2

# Copy to project downloads folder
Copy-Item `
    -Path $DownloadedFile.FullName `
    -Destination $DestinationFile `
    -Force

# Verify
if (Test-Path $DestinationFile) {

    $FinalFile = Get-Item $DestinationFile

    Write-Host ""
    Write-Host "========================================"
    Write-Host " SUCCESS"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Saved to:"
    Write-Host "  $($FinalFile.FullName)"
    Write-Host ""
    Write-Host "File size:"
    Write-Host "  $($FinalFile.Length) bytes"
    Write-Host ""
}
else {

    Write-Host ""
    Write-Host "ERROR: File could not be copied."
    exit 1
}