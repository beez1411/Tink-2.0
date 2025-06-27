const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

class AceNetScraper {
    constructor() {
        /*
         * Phase 1 Performance Optimizations Implemented:
         * 1. Batch Excel Writing: All results buffered and written once at the end
         * 2. Reduced Processing Delays: 1000ms -> 150ms between part numbers  
         * 3. Balanced Wait Times: Critical waits adjusted for reliability (Phase 1.1)
         * 4. Smart Excel Write Logic: Only writes immediately in legacy mode
         * 
         * Phase 1.1 Adjustment: Restored critical timing for popup/iframe detection
         * Phase 1.2 Optimization: Further reduced inter-part delay (300ms -> 150ms)
         * Expected Performance Improvement: 35-50% faster processing with high reliability
         */
        
        this.browser = null;
        this.page = null;
        this.mainWindow = null;
        this.popupWindow = null;
        this.maxRestarts = 50;
        this.restartCount = 0;
        
        // Results buffer for batch Excel writing (Phase 1 optimization)
        this.resultsBuffer = [];
        
        // Configuration for double-checking behavior
        this.config = {
            enableDoubleCheck: true,        // Enable/disable double-check for "Not in AceNet"
            doubleCheckRetries: 2,          // Number of retry attempts during double-check
            doubleCheckDelay: 3000,         // Delay before double-check (ms)
            popupWaitTime: 2000,            // Standard popup wait time (ms)
            firstSearchWaitTime: 5000,      // Wait time for first search (ms) - reduced from 10000
            networkTimeoutRetry: true,      // Retry on network timeouts
            processingDelay: 150            // Further reduced delay between part numbers (Phase 1.2 optimization)
        };
    }

    async initialize() {
        // Clean up any leftover flag files from previous runs
        this.cleanupControlFlags();
        
        // Get the bundled Chromium path for Electron apps
        const chromiumPath = await this.getChromiumPath();
        
        this.browser = await puppeteer.launch({
            headless: false, // Keep visible like Python script
            executablePath: chromiumPath, // Use bundled Chromium
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--ignore-certificate-errors',
                '--disable-extensions',
                '--disable-features=VoiceTranscription,SpeechRecognition',
                '--disable-media-stream',
                '--disable-webrtc',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
            ]
        });
        this.page = await this.browser.newPage();
    }

    async getChromiumPath() {
        const puppeteerConfig = require('puppeteer');
        const fs = require('fs');
        
        try {
            // First, try to use bundled Chromium from Puppeteer
            console.log('Attempting to find bundled Chromium...');
            
            // Check if we're in a packaged Electron app
            const isPackaged = process.mainModule && process.mainModule.filename.includes('app.asar');
            const appPath = isPackaged ? process.resourcesPath : process.cwd();
            
            // Try multiple strategies to find Chromium
            const strategies = [
                // Strategy 1: Use Puppeteer's browser fetcher
                async () => {
                    const browserFetcher = puppeteerConfig.createBrowserFetcher();
                    const revisionInfo = await browserFetcher.localRevisions();
                    if (revisionInfo.length > 0) {
                        const latestRevision = revisionInfo[revisionInfo.length - 1];
                        const revisionData = browserFetcher.revisionInfo(latestRevision);
                        if (fs.existsSync(revisionData.executablePath)) {
                            console.log(`Found bundled Chromium: ${revisionData.executablePath}`);
                            return revisionData.executablePath;
                        }
                    }
                    throw new Error('No local Chromium found');
                },
                
                // Strategy 2: Download if needed
                async () => {
                    console.log('Downloading Chromium...');
                    const browserFetcher = puppeteerConfig.createBrowserFetcher();
                    const revisionInfo = await browserFetcher.download();
                    console.log(`Downloaded Chromium: ${revisionInfo.executablePath}`);
                    return revisionInfo.executablePath;
                },
                
                // Strategy 3: Look for system Chrome installation
                async () => {
                    const possiblePaths = [
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                        process.env.CHROME_BIN,
                        process.env.CHROMIUM_BIN,
                    ].filter(Boolean);
                    
                    for (const chromePath of possiblePaths) {
                        if (fs.existsSync(chromePath)) {
                            console.log(`Found system Chrome: ${chromePath}`);
                            return chromePath;
                        }
                    }
                    throw new Error('No system Chrome found');
                }
            ];
            
            // Try each strategy in order
            for (let i = 0; i < strategies.length; i++) {
                try {
                    const result = await strategies[i]();
                    if (result) return result;
                } catch (error) {
                    console.log(`Strategy ${i + 1} failed: ${error.message}`);
                    if (i === strategies.length - 1) {
                        // If all strategies failed, throw a comprehensive error
                        throw new Error(
                            'Chrome/Chromium not found. To fix this issue:\n\n' +
                            '1. Install Google Chrome from https://www.google.com/chrome/\n' +
                            '2. Or set CHROME_BIN environment variable to Chrome executable path\n' +
                            '3. Or run "npx puppeteer browsers install chrome" to download Chromium\n\n' +
                            'If you continue having issues, please restart the application after installing Chrome.'
                        );
                    }
                }
            }
            
        } catch (error) {
            console.error('Failed to get Chromium path:', error.message);
            throw error;
        }
    }

    async getPartNumbersFromFile(inputFile) {
        const ext = path.extname(inputFile).toLowerCase();
        
        if (ext === '.txt') {
            const content = await fs.readFile(inputFile, 'utf-8');
            return content.split('\n').map(line => line.trim()).filter(line => line);
        } else if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsm') {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(inputFile);
            const worksheet = workbook.getWorksheet('Big Beautiful Order');
            if (!worksheet) {
                throw new Error("Sheet 'Big Beautiful Order' not found in the file.");
            }
            
            const partNumbers = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                const partNumber = row.getCell('A').value; // PARTNUMBER column
                if (partNumber) {
                    // Clean part number like Python script
                    let cleanedPartNumber;
                    if (typeof partNumber === 'number' && Number.isInteger(partNumber)) {
                        cleanedPartNumber = partNumber.toString();
                    } else {
                        cleanedPartNumber = partNumber.toString();
                    }
                    partNumbers.push(cleanedPartNumber);
                }
            });
            
            console.log(`Retrieved ${partNumbers.length} PARTNUMBERs`);
            return partNumbers;
        }
        
        throw new Error('Unsupported file format');
    }

    async initializeExcelOutput(outputFile) {
        console.log(`Initializing new Excel file: ${outputFile}`);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('No Discovery Check');
        
        // Initialize headers in columns A, C, E, G, I, K, M (blank columns B, D, F, H, J, L)
        worksheet.getCell('A1').value = "No Discovery";
        worksheet.getCell('C1').value = "No Asterisk(*)";
        worksheet.getCell('E1').value = "Cancelled";
        worksheet.getCell('G1').value = "On Order";
        worksheet.getCell('I1').value = "No Location";
        worksheet.getCell('K1').value = "Not in AceNet";
        worksheet.getCell('M1').value = "Not in RSC";
        
        // Set header formatting and column widths
        const headerColumns = ['A', 'C', 'E', 'G', 'I', 'K', 'M'];
        headerColumns.forEach(col => {
            const cell = worksheet.getCell(`${col}1`);
            cell.font = { bold: true };
            const headerText = cell.value;
            worksheet.getColumn(col).width = headerText.length * 1.2;
        });
        
        // Set minimal width for blank columns
        const blankColumns = ['B', 'D', 'F', 'H', 'J', 'L'];
        blankColumns.forEach(col => {
            worksheet.getColumn(col).width = 2;
        });
        
        await workbook.xlsx.writeFile(outputFile);
        console.log(`Initialized Excel file with headers`);
    }

    async appendToExcel(outputFile, category, partNumber) {
        const columnMap = {
            "No Discovery": 'A',
            "No Asterisk(*)": 'C',
            "Cancelled": 'E',
            "On Order": 'G',
            "No Location": 'I',
            "Not in AceNet": 'K',
            "Not in RSC": 'M'
        };
        
        const colLetter = columnMap[category];
        if (!colLetter) {
            console.log(`Error: Invalid column '${category}'`);
            return;
        }
        
        console.log(`Appending to Excel: ${category}, Part: ${partNumber}`);
        
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(outputFile);
            const worksheet = workbook.getWorksheet('No Discovery Check');
            
            // Find the first empty row in the column (starting from row 2)
            let currentRow = 2;
            while (worksheet.getCell(`${colLetter}${currentRow}`).value) {
                currentRow++;
            }
            
            worksheet.getCell(`${colLetter}${currentRow}`).value = partNumber;
            
            // Auto-size column based on max content length
            const header = worksheet.getCell(`${colLetter}1`).value;
            let maxLength = header.length;
            for (let row = 2; row <= currentRow; row++) {
                const cellValue = worksheet.getCell(`${colLetter}${row}`).value;
                if (cellValue) {
                    maxLength = Math.max(maxLength, cellValue.toString().length);
                }
            }
            worksheet.getColumn(colLetter).width = maxLength * 1.2;
            
            await workbook.xlsx.writeFile(outputFile);
            console.log(`Appended PARTNUMBER '${partNumber}' to column ${colLetter}, row ${currentRow}`);
            return currentRow;
        } catch (error) {
            console.log(`Error appending to Excel: ${error.message}`);
        }
    }

    async colorCodeMultiColumnEntries(outputFile) {
        console.log(`Color-coding multi-column PARTNUMBERs in ${outputFile}`);
        
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(outputFile);
            const worksheet = workbook.getWorksheet('No Discovery Check');
            
            if (!worksheet) {
                console.log("Worksheet 'No Discovery Check' not found.");
                return;
            }
            
            // Collect PARTNUMBERs and their columns (A, C, E, G, I)
            const partNumberColumns = {};
            ['A', 'C', 'E', 'G', 'I'].forEach(col => {
                let row = 2;
                while (true) {
                    const cell = worksheet.getCell(`${col}${row}`);
                    if (!cell.value) break;
                    
                    const partNumber = cell.value.toString();
                    if (!partNumberColumns[partNumber]) {
                        partNumberColumns[partNumber] = [];
                    }
                    partNumberColumns[partNumber].push({ col, row });
                    row++;
                }
            });
            
            // Apply red color to PARTNUMBERs in multiple columns
            Object.entries(partNumberColumns).forEach(([partNumber, locations]) => {
                if (locations.length > 1) {
                    locations.forEach(({ col, row }) => {
                        const cell = worksheet.getCell(`${col}${row}`);
                        cell.font = { ...cell.font, color: { argb: 'FFFF0000' } };
                        console.log(`Colored PARTNUMBER '${partNumber}' red in column ${col}, row ${row}`);
                    });
                }
            });
            
            await workbook.xlsx.writeFile(outputFile);
            console.log("Color-coding completed successfully.");
        } catch (error) {
            console.error("Error during color-coding:", error);
        }
    }

    // Phase 1 optimization: Batch write all results to Excel at once
    async batchWriteToExcel(outputFile, results) {
        console.log(`Batch writing ${results.length} results to Excel...`);
        
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(outputFile);
            const worksheet = workbook.getWorksheet('No Discovery Check');
            
            if (!worksheet) {
                console.log("Worksheet 'No Discovery Check' not found.");
                return;
            }
            
            // Column mapping
            const columnMap = {
                "No Discovery": 'A',
                "No Asterisk(*)": 'C',
                "Cancelled": 'E',
                "On Order": 'G',
                "No Location": 'I',
                "Not in AceNet": 'K',
                "Not in RSC": 'M'
            };
            
            // Track current row for each column
            const columnRows = {};
            Object.values(columnMap).forEach(col => {
                columnRows[col] = 2; // Start at row 2 (after header)
                // Find existing data to determine next row
                let row = 2;
                while (worksheet.getCell(`${col}${row}`).value) {
                    row++;
                }
                columnRows[col] = row;
            });
            
            // Write all results
            results.forEach(result => {
                const col = columnMap[result.category];
                if (col) {
                    const row = columnRows[col];
                    worksheet.getCell(`${col}${row}`).value = result.partNumber;
                    columnRows[col]++;
                    console.log(`Batch wrote ${result.partNumber} to ${result.category} (column ${col}, row ${row})`);
                }
            });
            
            // Auto-size columns
            Object.entries(columnMap).forEach(([category, col]) => {
                const maxLength = Math.max(
                    category.length,
                    ...Array.from({ length: columnRows[col] - 2 }, (_, i) => {
                        const cell = worksheet.getCell(`${col}${i + 2}`);
                        return cell.value ? cell.value.toString().length : 0;
                    })
                );
                worksheet.getColumn(col).width = maxLength * 1.2;
            });
            
            await workbook.xlsx.writeFile(outputFile);
            console.log(`Successfully batch wrote ${results.length} results to Excel`);
        } catch (error) {
            console.error("Error during batch Excel write:", error);
            throw error;
        }
    }

    async loginAndSelectStore(username, password, store) {
        console.log(`Logging in to AceNet with store ${store}`);
        
        // Navigate to AceNet login page
        await this.page.goto('https://acenet.aceservices.com/', { waitUntil: 'networkidle2' });
        
        // Handle login form - using the same selectors as Python script
        try {
            // Enter username using the correct ID from Python script
            await this.page.waitForSelector('#userNameInput', { timeout: 20000 });
            await this.page.type('#userNameInput', username);
            
            // Enter password and press Enter (like Python script)
            const passwordField = await this.page.waitForSelector('#passwordInput', { timeout: 20000 });
            await this.page.type('#passwordInput', password);
            await this.page.keyboard.press('Enter');
            
            console.log('Entered credentials and submitted login');
            
            // Wait for store dropdown to be clickable (bootstrap dropdown)
            const storeDropdown = await this.page.waitForSelector('.filter-option-inner-inner', { timeout: 20000 });
            await storeDropdown.click();
            
            console.log('Clicked store dropdown');
            
            // Wait for the dropdown list to appear
            await this.page.waitForSelector('div[role="listbox"] ul.dropdown-menu', { timeout: 10000 });
            
            // Find the store by number in the dropdown
            const storeItems = await this.page.$$('div[role="listbox"] ul.dropdown-menu a');
            let storeFound = false;
            
            for (const storeItem of storeItems) {
                try {
                    const storeSpan = await storeItem.$('span.store-number');
                    if (storeSpan) {
                        const storeText = await this.page.evaluate(el => el.textContent.trim(), storeSpan);
                        if (storeText.startsWith(store)) {
                            await storeItem.click();
                            console.log(`Selected store ${store}`);
                            storeFound = true;
                            break;
                        }
                    }
                } catch (error) {
                    // Continue to next store item
                    continue;
                }
            }
            
            if (!storeFound) {
                throw new Error(`Store number ${store} not found in dropdown!`);
            }
            
            // Wait for the page to refresh and the search box to appear
            await this.page.waitForSelector('#tbxSearchBox', { timeout: 20000 });
            console.log('Successfully logged in to AceNet and selected store');
            
        } catch (error) {
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    async debugPageContent(page, title) {
        try {
            const url = await page.url();
            const pageTitle = await page.title();
            console.log(`=== DEBUG ${title} ===`);
            console.log(`URL: ${url}`);
            console.log(`Title: ${pageTitle}`);
            
            // Check for common elements
            const searchBox = await page.$('#tbxSearchBox');
            console.log(`Search box found: ${searchBox ? 'YES' : 'NO'}`);
            
            const iframes = await page.$$('iframe');
            console.log(`Iframes found: ${iframes.length}`);
            
            console.log(`=== END DEBUG ${title} ===`);
        } catch (error) {
            console.log(`Debug error for ${title}: ${error.message}`);
        }
    }

    cleanupControlFlags() {
        const tempDir = os.tmpdir();
        const pauseFlag = path.join(tempDir, 'acenet_pause.flag');
        const cancelFlag = path.join(tempDir, 'acenet_cancel.flag');
        
        try {
            if (fsSync.existsSync(pauseFlag)) {
                fsSync.unlinkSync(pauseFlag);
                console.log('Cleaned up leftover pause flag');
            }
            if (fsSync.existsSync(cancelFlag)) {
                fsSync.unlinkSync(cancelFlag);
                console.log('Cleaned up leftover cancel flag');
            }
        } catch (e) {
            console.warn('Warning: Could not clean up flag files:', e.message);
        }
    }

    async checkControlFlags() {
        const tempDir = os.tmpdir();
        const pauseFlag = path.join(tempDir, 'acenet_pause.flag');
        const cancelFlag = path.join(tempDir, 'acenet_cancel.flag');
        
        // Check for cancellation first
        if (fsSync.existsSync(cancelFlag)) {
            console.log('Process cancelled by user');
            throw new Error('Process cancelled by user');
        }
        
        // Check for pause and wait if paused
        while (fsSync.existsSync(pauseFlag)) {
            console.log('Process paused - waiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check for cancellation while paused
            if (fsSync.existsSync(cancelFlag)) {
                console.log('Process cancelled while paused');
                throw new Error('Process cancelled by user');
            }
        }
    }

    async findElementByXPath(frame, xpath, maxAttempts = 1, retryDelay = 3000) {
        let lastError = null;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const element = await frame.evaluate((xpath) => {
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    const node = result.singleNodeValue;
                    if (node) {
                        return {
                            found: true,
                            text: node.textContent?.trim() || '',
                            innerHTML: node.innerHTML
                        };
                    }
                    return { found: false, text: '', innerHTML: '' };
                }, xpath);
                
                console.log(`XPath search (attempt ${attempt + 1}/${maxAttempts}): found=${element.found}, text='${element.text}'`);
                
                if (element.found) {
                    return element;
                }
                
                // If not found and we have more attempts, wait and retry
                if (attempt < maxAttempts - 1) {
                    console.log(`Element not found, retrying after ${retryDelay}ms delay...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
                
            } catch (error) {
                console.log(`XPath search attempt ${attempt + 1}/${maxAttempts} failed: ${error.message}`);
                lastError = error;
                
                // If not the last attempt, wait and retry
                if (attempt < maxAttempts - 1) {
                    console.log(`Retrying after ${retryDelay}ms delay...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        
        // All attempts failed
        if (lastError) {
            throw lastError;
        }
        return { found: false, text: '', innerHTML: '' };
    }

    // Unified method to check part numbers - can output to Excel or return results
    async checkPartNumber(partNumber, options = {}) {
        const { 
            outputFile = null,           // If provided, writes to Excel
            isFirstSearch = false,       // First search gets longer waits
            returnResults = false        // If true, returns result objects instead of writing to Excel
        } = options;
        
        console.log(`Processing PARTNUMBER: '${partNumber}'${isFirstSearch ? ' (FIRST SEARCH)' : ''}`);
        
        // Check for pause/cancel flags at the start of processing
        await this.checkControlFlags();
        
        try {
            // Clear and enter part number in search box
            await this.page.waitForSelector('#tbxSearchBox', { timeout: 10000 });
            await this.page.evaluate(() => document.getElementById('tbxSearchBox').value = '');
            await this.page.type('#tbxSearchBox', partNumber);
            await this.page.keyboard.press('Enter');
            
            console.log("Entered PARTNUMBER in main window input field");
            
            // Wait for popup window - balanced timing (Phase 1.1 adjustment)
            const waitTime = isFirstSearch ? this.config.firstSearchWaitTime : 3000; // Restored to 3000 for reliability
            console.log(`Waiting ${waitTime}ms for popup window...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Get all pages (windows)
            const pages = await this.browser.pages();
            console.log(`Found ${pages.length} pages/windows`);
            
            // Check if main window redirected to search page (part not found)
            const mainUrl = this.page.url();
            if (mainUrl.includes('/search/product?q=')) {
                console.log(`PARTNUMBER '${partNumber}' not found in AceNet (main window redirected to search page).`);
                
                // Handle double-check if enabled and returning results
                if (returnResults && this.config.enableDoubleCheck) {
                    console.log(`Double-checking enabled - re-verifying...`);
                    const doubleCheckResult = await this.doubleCheckPartNumber(partNumber, 'Search page redirect');
                    return [doubleCheckResult];
                }
                
                // Handle result - Phase 1 optimization: no immediate Excel writing
                const result = { category: 'Not in AceNet', details: 'Redirected to search page' };
                if (returnResults) {
                    return [result];
                } else if (outputFile) {
                    // Legacy mode: direct Excel writing (kept for compatibility)
                    await this.appendToExcel(outputFile, "Not in AceNet", partNumber);
                }
                
                // Navigate back to main page
                await this.page.goto('https://acenet.aceservices.com/', { waitUntil: 'networkidle2' });
                await this.page.waitForSelector('#tbxSearchBox', { timeout: 20000 });
                return returnResults ? [result] : undefined;
            }
            
            // Find popup window - look for the correct one like double-check does
            let popupPage = null;
            console.log("Looking for popup window...");
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (page !== this.page) {
                    try {
                        const pageUrl = await page.url();
                        console.log(`Checking popup candidate ${i}: ${pageUrl}`);
                        
                        // Look for the item-detail-direct-sku page specifically or valid AceNet content
                        if (pageUrl && (
                            pageUrl.includes('item-detail-direct-sku') ||
                            (pageUrl.includes('acenet') && !pageUrl.includes('search') && pageUrl !== 'about:blank')
                        )) {
                            // Verify the page has loaded content (like double-check does)
                            const hasContent = await page.evaluate(() => {
                                return document.body && document.body.innerHTML.length > 1000;
                            });
                            
                            if (hasContent) {
                                popupPage = page;
                                console.log(`Found valid popup with content at ${pageUrl}`);
                                break;
                            } else {
                                console.log(`Page ${pageUrl} doesn't have sufficient content yet, checking next...`);
                            }
                        } else if (pageUrl === 'about:blank') {
                            // If it's about:blank, wait a bit more and check again - balanced timing (Phase 1.1)
                            console.log(`Page ${i} is about:blank, waiting for it to load...`);
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            const newUrl = await page.url();
                            console.log(`After waiting, page ${i} URL is now: ${newUrl}`);
                            if (newUrl && newUrl !== 'about:blank' && newUrl.includes('acenet')) {
                                const hasContent = await page.evaluate(() => {
                                    return document.body && document.body.innerHTML.length > 1000;
                                });
                                if (hasContent) {
                                    popupPage = page;
                                    console.log(`Found valid popup after waiting: ${newUrl}`);
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        console.log(`Error checking page ${i}: ${e.message}`);
                    }
                }
            }
            
            // If no popup found, fallback to first non-main page
            if (!popupPage) {
                for (const page of pages) {
                    if (page !== this.page) {
                        popupPage = page;
                        console.log("Using fallback popup (first non-main page)");
                        break;
                    }
                }
            }
            
            if (!popupPage) {
                console.log(`Error: Popup window not found for PARTNUMBER '${partNumber}'.`);
                
                // Handle double-check if enabled and returning results
                if (returnResults && this.config.enableDoubleCheck) {
                    console.log(`Double-checking enabled - re-verifying...`);
                    const doubleCheckResult = await this.doubleCheckPartNumber(partNumber, 'Popup window not found');
                    return [doubleCheckResult];
                }
                
                // Handle result - Phase 1 optimization: no immediate Excel writing
                const result = { category: 'Not in AceNet', details: 'Popup window not found' };
                if (returnResults) {
                    return [result];
                } else if (outputFile) {
                    // Legacy mode: direct Excel writing (kept for compatibility)
                    await this.appendToExcel(outputFile, "Not in AceNet", partNumber);
                }
                return returnResults ? [result] : undefined;
            }
            
            console.log("Switched to popup window");
            
            // Wait for iframes to load before processing - balanced timing (Phase 1.1 adjustment)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Debug popup page
            await this.debugPageContent(popupPage, "POPUP PAGE");
            
            // Check for iframes in popup
            const iframes = await popupPage.$$('iframe');
            console.log(`Found ${iframes.length} iframe(s). Attempting to switch...`);
            
            // Wait for iframes to have content - balanced timing (Phase 1.1 adjustment)
            if (iframes.length > 0) {
                console.log("Waiting for iframes to load content...");
                await new Promise(resolve => setTimeout(resolve, 800));
            }
            
            let frameFound = false;
            let frame = null;
            
            for (let i = 0; i < iframes.length; i++) {
                const iframe = iframes[i];
                try {
                    console.log(`Trying iframe ${i}...`);
                    frame = await iframe.contentFrame();
                    if (!frame) {
                        console.log(`Iframe ${i}: contentFrame is null`);
                        continue;
                    }
                    
                    console.log(`Switched to iframe ${i}`);
                    
                    // Primary test: Look for the discovery element specifically (like Python)
                    console.log(`Iframe ${i}: Looking for discovery element...`);
                    try {
                        const discoveryElement = await frame.evaluate(() => {
                            const result = document.evaluate('/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                            return result.singleNodeValue ? true : false;
                        });
                        
                        if (discoveryElement) {
                            frameFound = true;
                            console.log(`Found correct iframe (${i}) with discovery element`);
                            break;
                        } else {
                            console.log(`No Discovery element not found in iframe ${i}`);
                            
                            // Check if iframe has substantial content but discovery element not loaded yet
                            const hasSubstantialContent = await frame.evaluate(() => {
                                const htmlLength = document.documentElement.outerHTML.length;
                                const hasForm = document.querySelector('form');
                                const hasInputs = document.querySelectorAll('input').length > 5;
                                return htmlLength > 2000 || (hasForm && hasInputs);
                            });
                            
                            if (hasSubstantialContent) {
                                console.log(`Iframe ${i} has substantial content, waiting for elements to load...`);
                                await new Promise(resolve => setTimeout(resolve, 1500)); // Balanced timing (Phase 1.1 adjustment)
                                
                                // Try discovery element again
                                const retryDiscovery = await frame.evaluate(() => {
                                    const result = document.evaluate('/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                    return result.singleNodeValue ? true : false;
                                });
                                
                                if (retryDiscovery) {
                                    frameFound = true;
                                    console.log(`Found correct iframe (${i}) with discovery element after retry`);
                                    break;
                                }
                            }
                            
                            // Debug iframe content like Python script
                            try {
                                const htmlContent = await frame.evaluate(() => document.documentElement.outerHTML.substring(0, 500));
                                console.log(`--- DEBUG: First 500 chars of iframe ${i} HTML ---`);
                                console.log(htmlContent);
                                console.log(`--- END DEBUG ---`);
                            } catch (debugError) {
                                console.log(`Could not get iframe ${i} HTML for debug: ${debugError.message}`);
                            }
                        }
                    } catch (error) {
                        console.log(`Failed to check discovery element in iframe ${i}: ${error.message}`);
                    }
                } catch (error) {
                    console.log(`Failed to switch to iframe ${i}: ${error.message}`);
                    continue;
                }
            }
            
            if (!frameFound || !frame) {
                console.log(`PARTNUMBER '${partNumber}' not found in AceNet (no valid iframe content).`);
                console.log(`DEBUG: Iframe detection failed - frameFound=${frameFound}, frame=${frame ? 'exists' : 'null'}`);
                
                // Handle double-check if enabled and returning results
                if (returnResults && this.config.enableDoubleCheck) {
                    console.log(`Double-checking enabled - re-verifying...`);
                    const doubleCheckResult = await this.doubleCheckPartNumber(partNumber, 'No valid iframe content');
                    await popupPage.close();
                    return [doubleCheckResult];
                }
                
                // Handle result - Phase 1 optimization: no immediate Excel writing
                const result = { category: 'Not in AceNet', details: 'No valid iframe content' };
                await popupPage.close();
                if (returnResults) {
                    return [result];
                } else if (outputFile) {
                    // Legacy mode: direct Excel writing (kept for compatibility)
                    await this.appendToExcel(outputFile, "Not in AceNet", partNumber);
                }
                return returnResults ? [result] : undefined;
            }
            
            // Check control flags before starting detailed processing
            await this.checkControlFlags();
            
            // Now perform the checks in the same order as Python script
            const categories = [];
            let isCancelled = false;
            let isNotInRSC = false;
            
            // Step 1: Check for "Not in RSC" and "Cancelled" status (priority checks with explicit wait)
            console.log("Step 1: Checking Cancelled and Not in RSC status...");
            try {
                // Wait for status element like Python script does with WebDriverWait
                await frame.waitForSelector('#ctl00_ctl00_contentMainPlaceHolder_MainContent_imagesVideos_mainStatusDiv', { timeout: 10000 });
                const statusDiv = await frame.$('#ctl00_ctl00_contentMainPlaceHolder_MainContent_imagesVideos_mainStatusDiv');
                if (statusDiv) {
                    const statusText = await frame.evaluate(el => el.textContent.trim(), statusDiv);
                    console.log(`Status text: '${statusText}'`);
                    
                    if (statusText) {
                        // Check for Not in RSC first (highest priority)
                        const notInRSCRegex = /not\s+carried\s+in\s+your\s+rsc|not\s+carried\s+by\s+rsc|not\s+in\s+rsc/i;
                        if (notInRSCRegex.test(statusText)) {
                            console.log("Outputting PARTNUMBER to Not in RSC due to matching status.");
                            categories.push({ category: 'Not in RSC', details: statusText });
                            // Phase 1 optimization: batch writing, no immediate Excel write unless legacy mode
                            if (!returnResults && outputFile) {
                                await this.appendToExcel(outputFile, "Not in RSC", partNumber);
                            }
                            isNotInRSC = true;
                        }
                        
                        // If Not in RSC, skip all other checks for this PARTNUMBER (like Python)
                        if (isNotInRSC) {
                            await popupPage.close();
                            return returnResults ? categories : undefined;
                        }
                        
                        // Check for Cancelled/Closeout (if not Not in RSC) - This takes priority over all other categories
                        const cancelledRegex = /cancel(?:led|lation)?|close(?:out|-out|d out)|item\s+cancelled\s+by\s+ace|closeout:\s*check\s+availability/i;
                        
                        if (cancelledRegex.test(statusText)) {
                            console.log("Outputting PARTNUMBER to Cancelled due to matching status.");
                            categories.push({ category: 'Cancelled', details: statusText });
                            // Phase 1 optimization: batch writing, no immediate Excel write unless legacy mode
                            if (!returnResults && outputFile) {
                                await this.appendToExcel(outputFile, "Cancelled", partNumber);
                            }
                            isCancelled = true;
                        }
                    }
                }
            } catch (error) {
                console.log(`Status element not found, skipping: ${error.message}`);
            }
            
            // If Cancelled, skip all other checks for this PARTNUMBER (like Python)
            if (isCancelled) {
                await popupPage.close();
                return returnResults ? categories : undefined;
            }
            
            // Step 2: Check No Discovery element (with retry logic like Python)
            console.log("Step 2: Checking No Discovery element...");
            let elementFound = false;
            let discoveryText = "";
            const maxAttempts = isFirstSearch ? 3 : 2;
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    const discoveryResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]', 1, 3000);
                    discoveryText = discoveryResult.text ? discoveryResult.text.trim() : "";
                    elementFound = discoveryResult.found;
                    console.log(`No Discovery element found with text: '${discoveryText}' (attempt ${attempt + 1})`);
                    if (elementFound) break;
                } catch (error) {
                    console.log(`No Discovery element not found (attempt ${attempt + 1}): ${error.message}`);
                    if (attempt < maxAttempts - 1) {
                        console.log("Retrying after 3-second delay...");
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    continue;
                }
            }
            
            // Only add to "No Discovery" if element is not found OR text is empty (like Python)
            if ((!elementFound || !discoveryText.trim()) && !isCancelled) {
                console.log("Outputting PARTNUMBER to No Discovery due to element absence or empty text.");
                categories.push({ category: 'No Discovery', details: elementFound ? 'Empty text' : 'Element not found' });
                // Phase 1 optimization: batch writing, no immediate Excel write unless legacy mode
                if (!returnResults && outputFile) {
                    await this.appendToExcel(outputFile, "No Discovery", partNumber);
                }
            }
            
            // Step 3: Check for non-blank text with no asterisk
            console.log("Step 3: Checking for non-blank text with no asterisk...");
            try {
                const linkResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]/a');
                console.log(`No Asterisk element found: ${linkResult.found}, text: '${linkResult.text}'`);
                
                if (linkResult.found && linkResult.text && !linkResult.text.includes('*')) {
                    console.log("Outputting PARTNUMBER to No Asterisk(*).");
                    categories.push({ category: 'No Asterisk(*)', details: linkResult.text });
                    // Phase 1 optimization: batch writing, no immediate Excel write unless legacy mode
                    if (!returnResults && outputFile) {
                        await this.appendToExcel(outputFile, "No Asterisk(*)", partNumber);
                    }
                }
            } catch (error) {
                console.log("No Asterisk element error, skipping.");
            }
            
            // Step 4: Check On Order (with wait like Python script)
            console.log("Step 4: Checking On Order...");
            try {
                // Wait for element like Python script does with WebDriverWait
                await frame.waitForSelector('#spnQOO', { timeout: 10000 });
                const orderSpan = await frame.$('#spnQOO');
                if (orderSpan) {
                    const orderText = await frame.evaluate(el => el.textContent.trim(), orderSpan);
                    console.log(`On Order text: '${orderText}'`);
                    
                    try {
                        const orderValue = parseFloat(orderText);
                        if (!isNaN(orderValue) && orderValue > 0) {
                            console.log("Outputting PARTNUMBER to On Order due to value > 0.");
                            categories.push({ category: 'On Order', details: `${orderValue} on order` });
                            // Phase 1 optimization: batch writing, no immediate Excel write unless legacy mode
                            if (!returnResults && outputFile) {
                                await this.appendToExcel(outputFile, "On Order", partNumber);
                            }
                        } else {
                            console.log("Order value <= 0, skipping.");
                        }
                    } catch (error) {
                        console.log("Order text is not a number, skipping.");
                    }
                }
            } catch (error) {
                console.log("On Order element not found, skipping.");
            }
            
            // Step 5: Check No Location
            console.log("Step 5: Checking No Location...");
            try {
                const locationResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[3]/div[17]/div[2]');
                const locationText = locationResult.text ? locationResult.text.trim() : "";
                console.log(`No Location text: '${locationText}' (raw: ${JSON.stringify(locationText)})`);
                
                if (!locationText) {
                    if (!locationResult.found) {
                        console.log("Outputting PARTNUMBER to No Location: element not found.");
                        categories.push({ category: 'No Location', details: 'Location element not found' });
                        // Phase 1 optimization: batch writing, no immediate Excel write unless legacy mode
                        if (!returnResults && outputFile) {
                            await this.appendToExcel(outputFile, "No Location", partNumber);
                        }
                    } else {
                        console.log("Outputting PARTNUMBER to No Location: element text is empty.");
                        categories.push({ category: 'No Location', details: 'Empty location text' });
                        // Phase 1 optimization: batch writing, no immediate Excel write unless legacy mode
                        if (!returnResults && outputFile) {
                            await this.appendToExcel(outputFile, "No Location", partNumber);
                        }
                    }
                } else {
                    console.log(`Skipping No Location: element contains text '${locationText}'.`);
                }
            } catch (error) {
                console.log(`No Location element not found: ${error.message}`);
                console.log("Outputting PARTNUMBER to No Location: element not found.");
                categories.push({ category: 'No Location', details: 'Location element not found' });
                // Phase 1 optimization: batch writing, no immediate Excel write unless legacy mode
                if (!returnResults && outputFile) {
                    await this.appendToExcel(outputFile, "No Location", partNumber);
                }
            }
            
            // Close popup window
            await popupPage.close();
            
            // Return results if requested, or undefined for Excel-only mode
            if (returnResults) {
                if (categories.length > 0) {
                    console.log(`Returning ${categories.length} categories for ${partNumber}:`, categories.map(c => c.category).join(', '));
                    return categories;
                } else {
                    console.log(`No issues found for ${partNumber}, returning OK`);
                    return [{ category: 'OK', details: 'No issues found' }];
                }
            }
            
        } catch (error) {
            console.log(`Error processing PARTNUMBER '${partNumber}': ${error.message}`);
            
            // Close any popup windows
            const pages = await this.browser.pages();
            for (const page of pages) {
                if (page !== this.page) {
                    await page.close();
                }
            }
            
            // Handle error result
            const result = { category: 'Not in AceNet', details: error.message };
            
            // For serious errors with results mode, attempt a double-check with retry if enabled
            if (returnResults && this.config.enableDoubleCheck && (error.message.includes('timeout') || error.message.includes('navigation') || error.message.includes('disconnected'))) {
                console.log(`Network/timeout error detected. Double-checking enabled - attempting re-verification...`);
                try {
                    const doubleCheckResult = await this.doubleCheckPartNumber(partNumber, error.message);
                    return [doubleCheckResult];
                } catch (doubleCheckError) {
                    console.log(`Double-check also failed: ${doubleCheckError.message}`);
                    return [{ 
                        category: 'Not in AceNet', 
                        details: `Error: ${error.message}`, 
                        needsManualReview: true 
                    }];
                }
            }
            
            // Handle result - Phase 1 optimization: no immediate Excel writing
            if (returnResults) {
                return [result];
            } else if (outputFile) {
                // Legacy mode: direct Excel writing (kept for compatibility)
                await this.appendToExcel(outputFile, "Not in AceNet", partNumber);
            }
            
            // Restart browser if too many errors (Excel mode only)
            if (!returnResults) {
                this.restartCount++;
                if (this.restartCount > this.maxRestarts) {
                    throw new Error(`WebDriver has been restarted more than ${this.maxRestarts} times. Aborting script.`);
                }
            }
        }
    }

    // New method to double-check parts marked as "Not in AceNet"
    async doubleCheckPartNumber(partNumber, originalError) {
        console.log(`DOUBLE CHECK: Re-verifying PARTNUMBER '${partNumber}' due to: ${originalError}`);
        
        try {
            // Wait a bit longer for system to stabilize
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Clear any potential cached states
            await this.page.evaluate(() => {
                if (document.getElementById('tbxSearchBox')) {
                    document.getElementById('tbxSearchBox').value = '';
                }
            });
            
            // Navigate back to main page to ensure clean state
            await this.page.goto('https://acenet.aceservices.com/', { waitUntil: 'networkidle2' });
            await this.page.waitForSelector('#tbxSearchBox', { timeout: 20000 });
            
            // Perform the search again with more patience
            console.log(`DOUBLE CHECK: Performing search for '${partNumber}'`);
            await this.page.type('#tbxSearchBox', partNumber);
            await this.page.keyboard.press('Enter');
            
            // Wait longer for popup
            console.log(`DOUBLE CHECK: Waiting 5 seconds for popup...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const pages = await this.browser.pages();
            console.log(`DOUBLE CHECK: Found ${pages.length} pages after search`);
            
            // Check if main window redirected to search (legitimate "not found")
            const mainUrl = this.page.url();
            if (mainUrl.includes('/search/product?q=')) {
                console.log(`DOUBLE CHECK: Confirmed - '${partNumber}' truly not found (search redirect)`);
                await this.page.goto('https://acenet.aceservices.com/', { waitUntil: 'networkidle2' });
                await this.page.waitForSelector('#tbxSearchBox', { timeout: 20000 });
                return { category: 'Not in AceNet', details: 'Confirmed: Search redirect', verified: true };
            }
            
            // Look for popup with more thorough checking
            let popupPage = null;
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (page !== this.page) {
                    try {
                        const pageUrl = await page.url();
                        console.log(`DOUBLE CHECK: Checking page ${i}: ${pageUrl}`);
                        
                        // More flexible popup detection
                        if (pageUrl && (
                            pageUrl.includes('item-detail-direct-sku') ||
                            pageUrl.includes('acenet') && !pageUrl.includes('search')
                        )) {
                            // Verify the page has loaded content
                            const hasContent = await page.evaluate(() => {
                                return document.body && document.body.innerHTML.length > 1000;
                            });
                            
                            if (hasContent) {
                                popupPage = page;
                                console.log(`DOUBLE CHECK: Found valid popup with content`);
                                break;
                            }
                        }
                    } catch (e) {
                        console.log(`DOUBLE CHECK: Error checking page ${i}: ${e.message}`);
                    }
                }
            }
            
            if (!popupPage) {
                // Try one more time with different approach
                console.log(`DOUBLE CHECK: No popup found, trying alternative search method...`);
                
                // Close all extra pages
                for (let i = 1; i < pages.length; i++) {
                    try {
                        await pages[i].close();
                    } catch (e) {}
                }
                
                // Try clicking the search button instead of pressing Enter
                await this.page.evaluate(() => document.getElementById('tbxSearchBox').value = '');
                await this.page.type('#tbxSearchBox', partNumber);
                
                // Look for search button and click it
                try {
                    const searchBtn = await this.page.$('#btnSearch');
                    if (searchBtn) {
                        await searchBtn.click();
                    } else {
                        await this.page.keyboard.press('Enter');
                    }
                } catch (e) {
                    await this.page.keyboard.press('Enter');
                }
                
                await new Promise(resolve => setTimeout(resolve, 4000));
                
                const newPages = await this.browser.pages();
                if (newPages.length > 1) {
                    popupPage = newPages[1];
                    console.log(`DOUBLE CHECK: Found popup using alternative method`);
                } else {
                    console.log(`DOUBLE CHECK: Still no popup - confirming Not in AceNet`);
                    return { category: 'Not in AceNet', details: 'Confirmed: No popup after multiple attempts', verified: true };
                }
            }
            
            // If we have a popup, try to verify it has valid part data
            if (popupPage) {
                try {
                    // Wait for iframe to load
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const iframes = await popupPage.$$('iframe');
                    if (iframes.length > 0) {
                        const frame = await iframes[0].contentFrame();
                        if (frame) {
                            // Look for any indication this is a valid part page
                            const hasPartData = await frame.evaluate(() => {
                                // Look for common AceNet part page elements
                                const indicators = [
                                    document.querySelector('#spnQOO'), // On Order quantity
                                    document.querySelector('#ctl00_ctl00_contentMainPlaceHolder_MainContent_imagesVideos_mainStatusDiv'), // Status
                                    document.querySelector('div[class*="location"]'), // Location info
                                    document.querySelector('div[class*="discovery"]') // Discovery info
                                ];
                                return indicators.some(el => el !== null);
                            });
                            
                            if (hasPartData) {
                                console.log(`DOUBLE CHECK: Found valid part data - processing directly`);
                                
                                // Process the part directly here instead of calling checkPartNumber again
                                try {
                                    const categories = [];
                                    
                                    // Check for status (Not in RSC / Cancelled)
                                    try {
                                        const statusDiv = await frame.$('#ctl00_ctl00_contentMainPlaceHolder_MainContent_imagesVideos_mainStatusDiv');
                                        if (statusDiv) {
                                            const statusText = await frame.evaluate(el => el.textContent.trim(), statusDiv);
                                            
                                            if (statusText) {
                                                // Check for Not in RSC
                                                const notInRSCRegex = /not\s+carried\s+in\s+your\s+rsc|not\s+carried\s+by\s+rsc|not\s+in\s+rsc/i;
                                                if (notInRSCRegex.test(statusText)) {
                                                    categories.push({ category: 'Not in RSC', details: statusText });
                                                    await popupPage.close();
                                                    return categories.length > 0 ? categories : [{ category: 'OK', details: 'No issues found' }];
                                                }
                                                
                                                // Check for Cancelled/Closeout - This takes priority over all other categories
                                                const cancelledRegex = /cancel(?:led|lation)?|close(?:out|-out|d out)|item\s+cancelled\s+by\s+ace|closeout:\s*check\s+availability/i;
                                                if (cancelledRegex.test(statusText)) {
                                                    categories.push({ category: 'Cancelled', details: statusText });
                                                    await popupPage.close();
                                                    return categories.length > 0 ? categories : [{ category: 'OK', details: 'No issues found' }];
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        console.log(`DOUBLE CHECK: Error checking status: ${e.message}`);
                                    }
                                    
                                    // Check Discovery
                                    try {
                                        const discoveryResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]');
                                        if (!discoveryResult.found || !discoveryResult.text.trim()) {
                                            categories.push({ category: 'No Discovery', details: 'Element not found or empty' });
                                        }
                                    } catch (e) {
                                        categories.push({ category: 'No Discovery', details: 'Element not found' });
                                    }
                                    
                                    // Check Asterisk
                                    try {
                                        const linkResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]/a');
                                        if (linkResult.found && linkResult.text && !linkResult.text.includes('*')) {
                                            categories.push({ category: 'No Asterisk(*)', details: linkResult.text });
                                        }
                                    } catch (e) {
                                        // Skip if error
                                    }
                                    
                                    // Check On Order
                                    try {
                                        const orderSpan = await frame.$('#spnQOO');
                                        if (orderSpan) {
                                            const orderText = await frame.evaluate(el => el.textContent.trim(), orderSpan);
                                            const orderValue = parseFloat(orderText);
                                            if (!isNaN(orderValue) && orderValue > 0) {
                                                categories.push({ category: 'On Order', details: `${orderValue} on order` });
                                            }
                                        }
                                    } catch (e) {
                                        // Skip if error
                                    }
                                    
                                    // Check Location
                                    try {
                                        const locationResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[3]/div[17]/div[2]');
                                        const locationText = locationResult.text ? locationResult.text.trim() : "";
                                        if (!locationText) {
                                            categories.push({ category: 'No Location', details: 'Location element not found or empty' });
                                        }
                                    } catch (e) {
                                        categories.push({ category: 'No Location', details: 'Location element not found' });
                                    }
                                    
                                    await popupPage.close();
                                    return categories.length > 0 ? categories : [{ category: 'OK', details: 'No issues found' }];
                                    
                                } catch (processError) {
                                    console.log(`DOUBLE CHECK: Error processing part data: ${processError.message}`);
                                    await popupPage.close();
                                    return [{ category: 'Not in AceNet', details: 'Error processing part data', verified: false }];
                                }
                            }
                        }
                    }
                    
                    await popupPage.close();
                } catch (e) {
                    console.log(`DOUBLE CHECK: Error analyzing popup: ${e.message}`);
                    try {
                        await popupPage.close();
                    } catch (e2) {}
                }
            }
            
            // If we get here, it's likely a legitimate "Not in AceNet"
            console.log(`DOUBLE CHECK: Confirmed - '${partNumber}' is Not in AceNet`);
            return { category: 'Not in AceNet', details: 'Confirmed after double-check', verified: true };
            
        } catch (error) {
            console.log(`DOUBLE CHECK: Error during double-check: ${error.message}`);
            // If double-check fails, default to marking as Not in AceNet but flag for manual review
            return { 
                category: 'Not in AceNet', 
                details: `Double-check failed: ${error.message}`, 
                verified: false,
                needsManualReview: true
            };
        }
    }

    async processPartNumbers(partNumbers, config, progressCallback) {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const outputFile = path.join(desktopPath, `No Discovery Check ${new Date().toISOString().split('T')[0]}.xlsx`);
        
        // Initialize Excel output
        await this.initializeExcelOutput(outputFile);
        
        // Clear results buffer for this run (Phase 1 optimization)
        this.resultsBuffer = [];
        
        // Login to AceNet
        await this.loginAndSelectStore(config.username, config.password, config.store);
        
        // Process each part number
        for (let i = 0; i < partNumbers.length; i++) {
            // Check for pause/cancel flags before processing each part number
            await this.checkControlFlags();
            
            const partNumber = partNumbers[i];
            
            if (progressCallback) {
                progressCallback(i + 1, partNumbers.length, `Processing ${partNumber}`);
            }
            
            // Process part number and collect results instead of writing immediately (Phase 1 optimization)
            const categories = await this.checkPartNumber(partNumber, { 
                isFirstSearch: i === 0, 
                returnResults: true  // Always return results for batching
            });
            
            // Add results to buffer
            if (categories && categories.length > 0) {
                categories.forEach(categoryResult => {
                    if (categoryResult.category !== 'OK') {  // Don't buffer 'OK' results
                        this.resultsBuffer.push({
                            partNumber: partNumber,
                            category: categoryResult.category,
                            details: categoryResult.details
                        });
                    }
                });
            }
            
            // Reduced delay to avoid overwhelming server (Phase 1 optimization)
            await new Promise(resolve => setTimeout(resolve, this.config.processingDelay));
        }
        
        // Batch write all results to Excel at once (Phase 1 optimization)
        if (this.resultsBuffer.length > 0) {
            console.log(`Writing ${this.resultsBuffer.length} results to Excel in batch...`);
            await this.batchWriteToExcel(outputFile, this.resultsBuffer);
        } else {
            console.log("No results to write to Excel.");
        }
        
        // Color-code multi-column entries
        console.log("Color-coding multi-column PARTNUMBERs...");
        await this.colorCodeMultiColumnEntries(outputFile);
        
        return outputFile;
    }

    async close() {
        if (this.browser) {
            // Close browser to allow process to complete
            console.log("Processing completed successfully. Closing browser.");
            await this.browser.close();
            this.browser = null;
        }
        
        // Clean up flag files on close
        this.cleanupControlFlags();
    }

    // Method to categorize results for both Excel and UI display
    categorizeResults(results) {
        // Define categories in the desired display order
        const categories = [
            { name: 'Cancelled', key: 'cancelled', parts: [], color: '#ff1744' },
            { name: 'No Discovery', key: 'noDiscovery', parts: [], color: '#ff6b6b' },
            { name: 'No Asterisk(*)', key: 'noAsterisk', parts: [], color: '#ffa500' },
            { name: 'On Order', key: 'onOrder', parts: [], color: '#4caf50' },
            { name: 'No Location', key: 'noLocation', parts: [], color: '#9c27b0' },
            { name: 'Not in AceNet', key: 'notInAceNet', parts: [], color: '#2196f3' },
            { name: 'Not in RSC', key: 'notInRSC', parts: [], color: '#f44336' }
        ];
        
        // Sort results into categories based on priority
        results.forEach(result => {
            const partNumber = result.partNumber;
            
            // Priority 1: Not in RSC (highest priority)
            if (result.category === 'Not in RSC') {
                categories.find(c => c.key === 'notInRSC').parts.push(partNumber);
                return;
            }
            
            // Priority 2: Cancelled (skip other checks)
            if (result.category === 'Cancelled') {
                categories.find(c => c.key === 'cancelled').parts.push(partNumber);
                return;
            }
            
            // Other categories
            if (result.category === 'No Discovery') {
                categories.find(c => c.key === 'noDiscovery').parts.push(partNumber);
            } else if (result.category === 'No Asterisk(*)') {
                categories.find(c => c.key === 'noAsterisk').parts.push(partNumber);
            } else if (result.category === 'On Order') {
                categories.find(c => c.key === 'onOrder').parts.push(partNumber);
            } else if (result.category === 'No Location') {
                categories.find(c => c.key === 'noLocation').parts.push(partNumber);
            } else if (result.category === 'Not in AceNet') {
                const partData = result.needsManualReview ? 
                    { partNumber: partNumber, needsManualReview: true, details: result.details } : 
                    partNumber;
                categories.find(c => c.key === 'notInAceNet').parts.push(partData);
            }
        });
        
        // Filter out empty categories - only return categories with parts
        return categories.filter(category => category.parts && category.parts.length > 0);
    }
}

async function runAceNetCheck(config) {
    const scraper = new AceNetScraper();
    
    try {
        await scraper.initialize();
        
        const partNumbers = await scraper.getPartNumbersFromFile(config.input_file);
        console.log(`Found ${partNumbers.length} part numbers to process`);
        
        const outputFile = await scraper.processPartNumbers(partNumbers, config, (current, total, message) => {
            console.error(`PROGRESS:${current}/${total}:${message}`);
        });
        
        console.log(`SUCCESS: Output saved to ${outputFile}`);
        return { 
            main_output: outputFile,
            success: true,
            outputFile: outputFile
        };
        
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    } finally {
        await scraper.close();
    }
}

// Main function to run AceNet check with direct part numbers (no file)
async function runAceNetCheckDirect(partNumbers, username, password, store, progressCallback) {
    console.error(`Starting direct AceNet check for ${partNumbers.length} part numbers (Double-check enabled)`);
    console.error(`Store: ${store}`);
    
    const scraper = new AceNetScraper();
    
    // Double-check is always enabled
    scraper.config.enableDoubleCheck = true;
    
    try {
        if (!partNumbers || partNumbers.length === 0) {
            throw new Error('No part numbers provided');
        }
        
        console.error(`Processing ${partNumbers.length} part numbers directly`);
        
        // Initialize browser
        await scraper.initialize();
        
        // Login to AceNet
        await scraper.loginAndSelectStore(username, password, store);
        
        // Process all part numbers with results tracking (no Excel file)
        const results = [];
        
        for (let i = 0; i < partNumbers.length; i++) {
            // Check for pause/cancel flags before processing each part number
            await scraper.checkControlFlags();
            
            const partNumber = partNumbers[i];
            
            // Report progress to callback if available
            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: partNumbers.length,
                    message: `Processing ${partNumber}`
                });
            }
            
            console.error(`PROGRESS:${i + 1}/${partNumbers.length}:Processing ${partNumber}`);
            
            try {
                // Use the unified checking method (no Excel output) - now returns array of categories
                const categoryResults = await scraper.checkPartNumber(partNumber, { 
                    isFirstSearch: i === 0, 
                    returnResults: true 
                });
                
                // Add each category as a separate result entry
                categoryResults.forEach(categoryResult => {
                    results.push({
                        partNumber: partNumber,
                        category: categoryResult.category,
                        details: categoryResult.details
                    });
                });
                
            } catch (error) {
                console.error(`Error processing ${partNumber}: ${error.message}`);
                results.push({
                    partNumber: partNumber,
                    category: 'Not in AceNet',
                    details: error.message
                });
            }
            
            // Reduced delay to avoid overwhelming server (Phase 1 optimization)
            await new Promise(resolve => setTimeout(resolve, scraper.config.processingDelay));
        }
        
        // Return categorized results for UI display only
        const categorizedResults = scraper.categorizeResults(results);
        
        return {
            success: true,
            totalProcessed: partNumbers.length,
            results: results,
            categorizedResults: categorizedResults
        };
        
    } catch (error) {
        console.error('Direct AceNet check failed:', error);
        throw error;
    } finally {
        // Keep browser open for troubleshooting (like Python script)
        console.error('Browser kept open for troubleshooting');
        
        // Close browser after a delay to allow process to complete properly
        setTimeout(async () => {
            try {
                await scraper.close();
            } catch (e) {
                // Ignore close errors
            }
        }, 5000);
    }
}

// Export the new function
module.exports = { AceNetScraper, runAceNetCheck, runAceNetCheckDirect };