const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class AceNetScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.mainWindow = null;
        this.popupWindow = null;
        this.maxRestarts = 50;
        this.restartCount = 0;
    }

    async initialize() {
        this.browser = await puppeteer.launch({
            headless: false, // Keep visible like Python script
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
            
            // Collect PARTNUMBERs and their columns (A, C, E, G, I)
            const partNumberColumns = {};
            const checkColumns = ['A', 'C', 'E', 'G', 'I'];
            
            checkColumns.forEach(col => {
                let row = 2;
                while (worksheet.getCell(`${col}${row}`).value) {
                    const partNumber = worksheet.getCell(`${col}${row}`).value;
                    if (!partNumberColumns[partNumber]) {
                        partNumberColumns[partNumber] = [];
                    }
                    partNumberColumns[partNumber].push({ col, row });
                    row++;
                }
            });
            
            // Apply red color to PARTNUMBERs in multiple columns
            Object.keys(partNumberColumns).forEach(partNumber => {
                const locations = partNumberColumns[partNumber];
                if (locations.length > 1) {
                    locations.forEach(({ col, row }) => {
                        worksheet.getCell(`${col}${row}`).font = { color: { argb: 'FFFF0000' } };
                        console.log(`Colored PARTNUMBER '${partNumber}' red in column ${col}, row ${row}`);
                    });
                }
            });
            
            await workbook.xlsx.writeFile(outputFile);
            console.log("Color-coding completed successfully.");
        } catch (error) {
            console.log(`Failed to color-code Excel: ${error.message}`);
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

    async findElementByXPath(frame, xpath) {
        try {
            const result = await frame.evaluate((xpathQuery) => {
                const result = document.evaluate(xpathQuery, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                return result.singleNodeValue ? { found: true, text: result.singleNodeValue.textContent.trim() } : { found: false, text: '' };
            }, xpath);
            return result;
        } catch (error) {
            console.log(`XPath error for ${xpath}: ${error.message}`);
            return { found: false, text: '' };
        }
    }

    async checkPartNumber(partNumber, outputFile, progressCallback) {
        console.log(`Processing PARTNUMBER: '${partNumber}'`);
        
        try {
            // Clear and enter part number in search box
            await this.page.waitForSelector('#tbxSearchBox', { timeout: 10000 });
            await this.page.evaluate(() => document.getElementById('tbxSearchBox').value = '');
            await this.page.type('#tbxSearchBox', partNumber);
            await this.page.keyboard.press('Enter');
            
            console.log("Entered PARTNUMBER in main window input field");
            
            // Wait for popup window
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Get all pages (windows)
            const pages = await this.browser.pages();
            console.log(`Found ${pages.length} pages/windows`);
            
            // Check if main window redirected to search page (part not found)
            const mainUrl = this.page.url();
            if (mainUrl.includes('/search/product?q=')) {
                console.log(`PARTNUMBER '${partNumber}' not found in AceNet (main window redirected to search page).`);
                await this.appendToExcel(outputFile, "Not in AceNet", partNumber);
                
                // Navigate back to main page
                await this.page.goto('https://acenet.aceservices.com/', { waitUntil: 'networkidle2' });
                await this.page.waitForSelector('#tbxSearchBox', { timeout: 20000 });
                return;
            }
            
            // Find popup window
            let popupPage = null;
            for (const page of pages) {
                if (page !== this.page) {
                    popupPage = page;
                    break;
                }
            }
            
            if (!popupPage) {
                console.log(`Error: Popup window not found for PARTNUMBER '${partNumber}'.`);
                await this.appendToExcel(outputFile, "Not in AceNet", partNumber);
                return;
            }
            
            console.log("Switched to popup window");
            
            // Debug popup page
            await this.debugPageContent(popupPage, "POPUP PAGE");
            
            // Check for iframes in popup
            const iframes = await popupPage.$$('iframe');
            console.log(`Found ${iframes.length} iframe(s). Attempting to switch...`);
            
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
                    
                    // Debug frame content
                    try {
                        const frameUrl = await frame.url();
                        console.log(`Iframe ${i}: URL='${frameUrl}'`);
                    } catch (e) {
                        console.log(`Iframe ${i}: Could not get URL: ${e.message}`);
                    }
                    
                    // Test if we can find the discovery element using XPath via evaluate
                    console.log(`Iframe ${i}: Looking for discovery element...`);
                    const discoveryElements = await frame.evaluate(() => {
                        const result = document.evaluate('/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        return result.snapshotLength;
                    });
                    console.log(`Iframe ${i}: Found ${discoveryElements} discovery elements`);
                    
                    if (discoveryElements > 0) {
                        frameFound = true;
                        console.log(`Found correct iframe (${i}) with discovery element`);
                        break;
                    } else {
                        // Try to find some key AceNet elements as fallback
                        const statusElement = await frame.$('#ctl00_ctl00_contentMainPlaceHolder_MainContent_imagesVideos_mainStatusDiv');
                        const orderElement = await frame.$('#spnQOO');
                        console.log(`Iframe ${i}: Status element=${statusElement ? 'YES' : 'NO'}, Order element=${orderElement ? 'YES' : 'NO'}`);
                        
                        // If we found key elements, use this iframe
                        if (statusElement || orderElement) {
                            frameFound = true;
                            console.log(`Using iframe ${i} based on key elements found`);
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`Failed to access iframe ${i}: ${error.message}`);
                    continue;
                }
            }
            
            if (!frameFound || !frame) {
                console.log(`PARTNUMBER '${partNumber}' not found in AceNet (no valid iframe content).`);
                console.log(`DEBUG: Iframe detection failed - frameFound=${frameFound}, frame=${frame ? 'exists' : 'null'}`);
                await this.appendToExcel(outputFile, "Not in AceNet", partNumber);
                await popupPage.close();
                return;
            }
            
            // Now perform the checks in the same order as Python script
            let isCancelled = false;
            let isNotInRSC = false;
            
            // Step 1: Check for "Not in RSC" and "Cancelled" status (priority checks)
            console.log("Step 1: Checking Cancelled and Not in RSC status...");
            try {
                const statusDiv = await frame.$('#ctl00_ctl00_contentMainPlaceHolder_MainContent_imagesVideos_mainStatusDiv');
                if (statusDiv) {
                    const statusText = await frame.evaluate(el => el.textContent.trim(), statusDiv);
                    console.log(`Status text: '${statusText}'`);
                    
                    if (statusText) {
                        // Check for Not in RSC first (highest priority)
                        const notInRSCRegex = /not\s+carried\s+in\s+your\s+rsc|not\s+carried\s+by\s+rsc|not\s+in\s+rsc/i;
                        if (notInRSCRegex.test(statusText)) {
                            console.log("Outputting PARTNUMBER to Not in RSC due to matching status.");
                            await this.appendToExcel(outputFile, "Not in RSC", partNumber);
                            isNotInRSC = true;
                        }
                        
                        // Check for Cancelled (if not Not in RSC)
                        if (!isNotInRSC) {
                            const cancelledRegex = /cancel(?:led|lation)?|close(?:out|-out|d out)/i;
                            const replacementRegex = /replacement|discontinued/i;
                            
                            if (cancelledRegex.test(statusText) && !replacementRegex.test(statusText)) {
                                console.log("Outputting PARTNUMBER to Cancelled due to matching status.");
                                await this.appendToExcel(outputFile, "Cancelled", partNumber);
                                isCancelled = true;
                            }
                        }
                    }
                }
            } catch (error) {
                console.log(`Status element not found, skipping: ${error.message}`);
            }
            
            // If Not in RSC or Cancelled, skip all other checks
            if (isNotInRSC || isCancelled) {
                await popupPage.close();
                return;
            }
            
            // Step 2: Check No Discovery element
            console.log("Step 2: Checking No Discovery element...");
            try {
                const discoveryResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]');
                console.log(`No Discovery element found: ${discoveryResult.found}, text: '${discoveryResult.text}'`);
                
                if (!discoveryResult.found || !discoveryResult.text.trim()) {
                    console.log("Outputting PARTNUMBER to No Discovery due to element absence or empty text.");
                    await this.appendToExcel(outputFile, "No Discovery", partNumber);
                }
            } catch (error) {
                console.log(`No Discovery element error: ${error.message}`);
                await this.appendToExcel(outputFile, "No Discovery", partNumber);
            }
            
            // Step 3: Check for non-blank text with no asterisk
            console.log("Step 3: Checking for non-blank text with no asterisk...");
            try {
                const linkResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]/a');
                console.log(`No Asterisk element found: ${linkResult.found}, text: '${linkResult.text}'`);
                
                if (linkResult.found && linkResult.text && !linkResult.text.includes('*')) {
                    console.log("Outputting PARTNUMBER to No Asterisk(*).");
                    await this.appendToExcel(outputFile, "No Asterisk(*)", partNumber);
                }
            } catch (error) {
                console.log("No Asterisk element error, skipping.");
            }
            
            // Step 4: Check On Order
            console.log("Step 4: Checking On Order...");
            try {
                const orderSpan = await frame.$('#spnQOO');
                if (orderSpan) {
                    const orderText = await frame.evaluate(el => el.textContent.trim(), orderSpan);
                    console.log(`On Order text: '${orderText}'`);
                    
                    try {
                        const orderValue = parseFloat(orderText);
                        if (!isNaN(orderValue) && orderValue > 0) {
                            console.log("Outputting PARTNUMBER to On Order due to value > 0.");
                            await this.appendToExcel(outputFile, "On Order", partNumber);
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
                console.log(`No Location element found: ${locationResult.found}, text: '${locationResult.text}' (raw: ${JSON.stringify(locationResult.text)})`);
                
                if (!locationResult.found) {
                    console.log("No Location element not found: outputting to No Location.");
                    await this.appendToExcel(outputFile, "No Location", partNumber);
                } else if (!locationResult.text) {
                    console.log("Outputting PARTNUMBER to No Location: element text is empty.");
                    await this.appendToExcel(outputFile, "No Location", partNumber);
                } else {
                    console.log(`Skipping No Location: element contains text '${locationResult.text}'.`);
                }
            } catch (error) {
                console.log(`No Location element error: ${error.message}`);
                console.log("Outputting PARTNUMBER to No Location: element error.");
                await this.appendToExcel(outputFile, "No Location", partNumber);
            }
            
            // Close popup window
            await popupPage.close();
            
        } catch (error) {
            console.log(`Error processing PARTNUMBER '${partNumber}': ${error.message}`);
            await this.appendToExcel(outputFile, "Not in AceNet", partNumber);
            
            // Close any popup windows
            const pages = await this.browser.pages();
            for (const page of pages) {
                if (page !== this.page) {
                    await page.close();
                }
            }
            
            // Restart browser if too many errors
            this.restartCount++;
            if (this.restartCount > this.maxRestarts) {
                throw new Error(`WebDriver has been restarted more than ${this.maxRestarts} times. Aborting script.`);
            }
        }
    }

    // Direct version of checkPartNumber that returns results instead of writing to Excel
    async checkPartNumberDirect(partNumber, isFirstSearch = false) {
        console.log(`DIRECT: Processing PARTNUMBER: '${partNumber}'${isFirstSearch ? ' (FIRST SEARCH)' : ''}`);
        
        try {
            // Debug current page state before search
            console.log(`DIRECT: Starting search for ${partNumber}`);
            const currentUrl = this.page.url();
            console.log(`DIRECT: Current URL before search: ${currentUrl}`);
            
            // Clear and enter part number in search box
            console.log(`DIRECT: Looking for search box...`);
            await this.page.waitForSelector('#tbxSearchBox', { timeout: 10000 });
            console.log(`DIRECT: Found search box, clearing and typing...`);
            await this.page.evaluate(() => document.getElementById('tbxSearchBox').value = '');
            await this.page.type('#tbxSearchBox', partNumber);
            await this.page.keyboard.press('Enter');
            
            console.log(`DIRECT: Entered PARTNUMBER '${partNumber}' in main window input field`);
            
            // Wait for popup window - longer delay for first search
            if (isFirstSearch) {
                console.log(`DIRECT: First search - waiting 5 seconds for system to fully load...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // For first search, retry if no popup appears
                let retryCount = 0;
                let popupFound = false;
                while (retryCount < 3 && !popupFound) {
                    const pages = await this.browser.pages();
                    console.log(`DIRECT: First search retry ${retryCount + 1}: Found ${pages.length} pages`);
                    
                    if (pages.length > 1) {
                        // Check if we have a valid popup
                        for (let i = 1; i < pages.length; i++) {
                            try {
                                const pageUrl = await pages[i].url();
                                if (pageUrl && pageUrl !== 'about:blank' && pageUrl.includes('acenet')) {
                                    console.log(`DIRECT: Valid popup found on retry ${retryCount + 1}: ${pageUrl}`);
                                    popupFound = true;
                                    break;
                                }
                            } catch (e) {
                                console.log(`DIRECT: Error checking page ${i}: ${e.message}`);
                            }
                        }
                    }
                    
                    if (!popupFound) {
                        console.log(`DIRECT: No valid popup found, retrying search...`);
                        // Clear and retry the search
                        await this.page.evaluate(() => document.getElementById('tbxSearchBox').value = '');
                        await this.page.type('#tbxSearchBox', partNumber);
                        await this.page.keyboard.press('Enter');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        retryCount++;
                    }
                }
            } else {
                console.log(`DIRECT: Waiting 2 seconds for popup...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Get all pages (windows)
            const pages = await this.browser.pages();
            console.log(`DIRECT: Found ${pages.length} pages/windows`);
            
            // Debug all page URLs
            for (let i = 0; i < pages.length; i++) {
                try {
                    const pageUrl = await pages[i].url();
                    const pageTitle = await pages[i].title();
                    console.log(`DIRECT: Page ${i}: URL='${pageUrl}', Title='${pageTitle}'`);
                } catch (e) {
                    console.log(`DIRECT: Page ${i}: Could not get URL/Title: ${e.message}`);
                }
            }
            
            // Check if main window redirected to search page (part not found)
            const mainUrl = this.page.url();
            console.log(`DIRECT: Main window URL after search: ${mainUrl}`);
            if (mainUrl.includes('/search/product?q=')) {
                console.log(`DIRECT: PARTNUMBER '${partNumber}' not found in AceNet (main window redirected to search page).`);
                
                // Navigate back to main page
                await this.page.goto('https://acenet.aceservices.com/', { waitUntil: 'networkidle2' });
                await this.page.waitForSelector('#tbxSearchBox', { timeout: 20000 });
                return [{ category: 'Not in AceNet', details: 'Redirected to search page' }];
            }
            
            // Find popup window - look for the item details page specifically
            let popupPage = null;
            console.log(`DIRECT: Looking for popup window among ${pages.length} pages...`);
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (page !== this.page) {
                    try {
                        const pageUrl = await page.url();
                        console.log(`DIRECT: Checking popup candidate ${i}: ${pageUrl}`);
                        // Look for the item-detail-direct-sku page specifically
                        if (pageUrl && pageUrl.includes('item-detail-direct-sku')) {
                            console.log(`DIRECT: Found correct popup at index ${i}`);
                            popupPage = page;
                            break;
                        } else if (pageUrl && pageUrl !== 'about:blank' && !popupPage) {
                            // Fallback to any non-blank page that's not the main page
                            console.log(`DIRECT: Using fallback popup at index ${i}`);
                            popupPage = page;
                        }
                    } catch (e) {
                        console.log(`DIRECT: Error checking page ${i}: ${e.message}`);
                    }
                }
            }
            
            if (!popupPage) {
                console.log(`DIRECT: Error: Popup window not found for PARTNUMBER '${partNumber}'.`);
                console.log(`DIRECT: Only found ${pages.length} total pages, main page is at index 0`);
                return [{ category: 'Not in AceNet', details: 'Popup window not found' }];
            }
            
            console.log(`DIRECT: Switched to popup window`);
            
            // Wait for popup to fully load, especially for first search
            if (isFirstSearch) {
                console.log(`DIRECT: First search - ensuring popup is fully loaded...`);
                try {
                    // Wait for the popup to have a proper URL (not about:blank)
                    let attempts = 0;
                    while (attempts < 10) {
                        const popupUrl = await popupPage.url();
                        console.log(`DIRECT: Popup URL check ${attempts + 1}: ${popupUrl}`);
                        if (popupUrl && popupUrl !== 'about:blank' && popupUrl.includes('acenet')) {
                            console.log(`DIRECT: Popup fully loaded with URL: ${popupUrl}`);
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        attempts++;
                    }
                    
                    // Additional wait for iframes to load
                    console.log(`DIRECT: Waiting for iframes to load...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.log(`DIRECT: Error waiting for popup to load: ${error.message}`);
                }
            }
            
            // Debug popup page
            await this.debugPageContent(popupPage, "POPUP PAGE DIRECT");
            
            // Check for iframes in popup
            const iframes = await popupPage.$$('iframe');
            console.log(`Found ${iframes.length} iframe(s). Attempting to switch...`);
            
            let frameFound = false;
            let frame = null;
            
            for (let i = 0; i < iframes.length; i++) {
                const iframe = iframes[i];
                try {
                    console.log(`DIRECT: Trying iframe ${i}...`);
                    frame = await iframe.contentFrame();
                    if (!frame) {
                        console.log(`DIRECT: Iframe ${i}: contentFrame is null`);
                        continue;
                    }
                    
                    // Debug frame content
                    try {
                        const frameUrl = await frame.url();
                        console.log(`DIRECT: Iframe ${i}: URL='${frameUrl}'`);
                    } catch (e) {
                        console.log(`DIRECT: Iframe ${i}: Could not get URL: ${e.message}`);
                    }
                    
                    // Test if we can find the discovery element using XPath via evaluate
                    console.log(`DIRECT: Iframe ${i}: Looking for discovery element...`);
                    const discoveryElements = await frame.evaluate(() => {
                        const result = document.evaluate('/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        return result.snapshotLength;
                    });
                    console.log(`DIRECT: Iframe ${i}: Found ${discoveryElements} discovery elements`);
                    
                    if (discoveryElements > 0) {
                        frameFound = true;
                        console.log(`DIRECT: Found correct iframe (${i}) with discovery element`);
                        break;
                    } else {
                        // Try to find some key AceNet elements as fallback
                        const statusElement = await frame.$('#ctl00_ctl00_contentMainPlaceHolder_MainContent_imagesVideos_mainStatusDiv');
                        const orderElement = await frame.$('#spnQOO');
                        console.log(`DIRECT: Iframe ${i}: Status element=${statusElement ? 'YES' : 'NO'}, Order element=${orderElement ? 'YES' : 'NO'}`);
                        
                        // If we found key elements, use this iframe
                        if (statusElement || orderElement) {
                            frameFound = true;
                            console.log(`DIRECT: Using iframe ${i} based on key elements found`);
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`DIRECT: Failed to access iframe ${i}: ${error.message}`);
                    continue;
                }
            }
            
            if (!frameFound || !frame) {
                console.log(`DIRECT: PARTNUMBER '${partNumber}' not found in AceNet (no valid iframe content).`);
                console.log(`DIRECT: DEBUG: Iframe detection failed - frameFound=${frameFound}, frame=${frame ? 'exists' : 'null'}`);
                console.log(`DIRECT: DEBUG: Total iframes checked: ${iframes.length}`);
                await popupPage.close();
                return [{ category: 'Not in AceNet', details: 'No valid iframe content' }];
            }
            
            // Now perform the checks and collect ALL applicable categories
            const categories = [];
            
            // Step 1: Check for "Not in RSC" and "Cancelled" status (priority checks)
            console.log("Step 1: Checking Cancelled and Not in RSC status...");
            try {
                const statusDiv = await frame.$('#ctl00_ctl00_contentMainPlaceHolder_MainContent_imagesVideos_mainStatusDiv');
                if (statusDiv) {
                    const statusText = await frame.evaluate(el => el.textContent.trim(), statusDiv);
                    console.log(`Status text: '${statusText}'`);
                    
                    if (statusText) {
                        // Check for Not in RSC first (highest priority)
                        const notInRSCRegex = /not\s+carried\s+in\s+your\s+rsc|not\s+carried\s+by\s+rsc|not\s+in\s+rsc/i;
                        if (notInRSCRegex.test(statusText)) {
                            console.log("PARTNUMBER categorized as Not in RSC due to matching status.");
                            categories.push({ category: 'Not in RSC', details: statusText });
                        }
                        
                        // Check for Cancelled (if not Not in RSC)
                        const cancelledRegex = /cancel(?:led|lation)?|close(?:out|-out|d out)/i;
                        const replacementRegex = /replacement|discontinued/i;
                        
                        if (cancelledRegex.test(statusText) && !replacementRegex.test(statusText)) {
                            console.log("PARTNUMBER categorized as Cancelled due to matching status.");
                            categories.push({ category: 'Cancelled', details: statusText });
                            // If Cancelled, skip all other checks and return immediately
                            await popupPage.close();
                            return categories;
                        }
                    }
                }
            } catch (error) {
                console.log(`Status element not found, skipping: ${error.message}`);
            }
            
            // If Not in RSC was found, still continue with other checks (unlike Cancelled)
            
            // Step 2: Check No Discovery element
            console.log("DIRECT: Step 2: Checking No Discovery element...");
            try {
                const discoveryResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]');
                console.log(`DIRECT: No Discovery element found: ${discoveryResult.found}, text: '${discoveryResult.text}'`);
                
                if (!discoveryResult.found || !discoveryResult.text.trim()) {
                    console.log("DIRECT: PARTNUMBER categorized as No Discovery due to element absence or empty text.");
                    categories.push({ category: 'No Discovery', details: discoveryResult.found ? 'Empty text' : 'Element not found' });
                }
            } catch (error) {
                console.log(`DIRECT: No Discovery element error: ${error.message}`);
                categories.push({ category: 'No Discovery', details: error.message });
            }
            
            // Step 3: Check for non-blank text with no asterisk
            console.log("DIRECT: Step 3: Checking for non-blank text with no asterisk...");
            try {
                const linkResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[1]/div[20]/div[2]/a');
                console.log(`DIRECT: No Asterisk element found: ${linkResult.found}, text: '${linkResult.text}'`);
                
                if (linkResult.found && linkResult.text && !linkResult.text.includes('*')) {
                    console.log("DIRECT: PARTNUMBER categorized as No Asterisk(*).");
                    categories.push({ category: 'No Asterisk(*)', details: linkResult.text });
                }
            } catch (error) {
                console.log("DIRECT: No Asterisk element error, skipping.");
            }
            
            // Step 4: Check On Order
            console.log("DIRECT: Step 4: Checking On Order...");
            try {
                const orderSpan = await frame.$('#spnQOO');
                if (orderSpan) {
                    const orderText = await frame.evaluate(el => el.textContent.trim(), orderSpan);
                    console.log(`DIRECT: On Order text: '${orderText}'`);
                    
                    try {
                        const orderValue = parseFloat(orderText);
                        if (!isNaN(orderValue) && orderValue > 0) {
                            console.log("DIRECT: PARTNUMBER categorized as On Order due to value > 0.");
                            categories.push({ category: 'On Order', details: `${orderValue} on order` });
                        } else {
                            console.log("DIRECT: Order value <= 0, skipping.");
                        }
                    } catch (error) {
                        console.log("DIRECT: Order text is not a number, skipping.");
                    }
                } else {
                    console.log("DIRECT: Order element (#spnQOO) not found.");
                }
            } catch (error) {
                console.log("DIRECT: On Order element error, skipping.");
            }
            
            // Step 5: Check No Location
            console.log("DIRECT: Step 5: Checking No Location...");
            try {
                const locationResult = await this.findElementByXPath(frame, '/html/body/form/div[4]/div[1]/div[11]/div[1]/div[3]/div[17]/div[2]');
                console.log(`DIRECT: No Location element found: ${locationResult.found}, text: '${locationResult.text}' (raw: ${JSON.stringify(locationResult.text)})`);
                
                if (!locationResult.found) {
                    console.log("DIRECT: No Location element not found: categorizing as No Location.");
                    categories.push({ category: 'No Location', details: 'Location element not found' });
                } else if (!locationResult.text) {
                    console.log("DIRECT: PARTNUMBER categorized as No Location: element text is empty.");
                    categories.push({ category: 'No Location', details: 'Empty location text' });
                } else {
                    console.log(`DIRECT: Skipping No Location: element contains text '${locationResult.text}'.`);
                }
            } catch (error) {
                console.log(`DIRECT: No Location element error: ${error.message}`);
                console.log("DIRECT: PARTNUMBER categorized as No Location: element error.");
                categories.push({ category: 'No Location', details: error.message });
            }
            
            // Close popup window
            await popupPage.close();
            
            // Return all categories found (or OK if none)
            if (categories.length > 0) {
                console.log(`DIRECT: Returning ${categories.length} categories for ${partNumber}:`, categories.map(c => c.category).join(', '));
                return categories;
            } else {
                console.log(`DIRECT: No issues found for ${partNumber}, returning OK`);
                return [{ category: 'OK', details: 'No issues found' }];
            }
            
        } catch (error) {
            console.log(`DIRECT: ERROR processing PARTNUMBER '${partNumber}': ${error.message}`);
            console.log(`DIRECT: ERROR stack: ${error.stack}`);
            
            // Close any popup windows
            try {
                const pages = await this.browser.pages();
                for (const page of pages) {
                    if (page !== this.page) {
                        await page.close();
                    }
                }
            } catch (closeError) {
                console.log(`DIRECT: Error closing pages: ${closeError.message}`);
            }
            
            return [{ category: 'Not in AceNet', details: error.message }];
        }
    }

    async processPartNumbers(partNumbers, config, progressCallback) {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const outputFile = path.join(desktopPath, `No Discovery Check ${new Date().toISOString().split('T')[0]}.xlsx`);
        
        // Initialize Excel output
        await this.initializeExcelOutput(outputFile);
        
        // Login to AceNet
        await this.loginAndSelectStore(config.username, config.password, config.store);
        
        // Process each part number
        for (let i = 0; i < partNumbers.length; i++) {
            const partNumber = partNumbers[i];
            
            if (progressCallback) {
                progressCallback(i + 1, partNumbers.length, `Processing ${partNumber}`);
            }
            
            await this.checkPartNumber(partNumber, outputFile, progressCallback);
            
            // Add delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
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
    }

    // Method to categorize results for both Excel and UI display
    categorizeResults(results) {
        const categories = [
            { name: 'No Discovery', key: 'noDiscovery', parts: [], color: '#ff6b6b' },
            { name: 'No Asterisk(*)', key: 'noAsterisk', parts: [], color: '#ffa500' },
            { name: 'Cancelled', key: 'cancelled', parts: [], color: '#ff1744' },
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
                categories.find(c => c.key === 'notInAceNet').parts.push(partNumber);
            }
        });
        
        return categories;
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
async function runAceNetCheckDirect(partNumbers, username, password, store) {
    console.error(`Starting direct AceNet check for ${partNumbers.length} part numbers`);
    console.error(`Store: ${store}`);
    
    const scraper = new AceNetScraper();
    
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
            const partNumber = partNumbers[i];
            
            console.error(`PROGRESS:${i + 1}/${partNumbers.length}:Processing ${partNumber}`);
            
            try {
                // Use the direct checking method (no Excel output) - now returns array of categories
                const categoryResults = await scraper.checkPartNumberDirect(partNumber, i === 0);
                
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
            
            // Add delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
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