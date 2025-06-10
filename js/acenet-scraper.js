const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class AceNetScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        this.browser = await puppeteer.launch({
            headless: false, // Set to true for production
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ]
        });
        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    }

    async getPartNumbersFromFile(inputFile) {
        const ext = path.extname(inputFile).toLowerCase();
        
        if (ext === '.txt') {
            const content = await fs.readFile(inputFile, 'utf-8');
            return content.split('\n').map(line => line.trim()).filter(line => line);
        } else if (ext === '.xlsx' || ext === '.xls') {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(inputFile);
            const worksheet = workbook.getWorksheet('Big Beautiful Order');
            const partNumbers = [];
            
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                const partNumber = row.getCell('A').value; // Assuming part number is in column A
                if (partNumber) partNumbers.push(partNumber.toString());
            });
            
            return partNumbers;
        }
        
        throw new Error('Unsupported file format');
    }

    async login(username, password) {
        // Implement AceNet login logic
        await this.page.goto('https://acenet-url.com/login'); // Replace with actual URL
        await this.page.type('#username', username);
        await this.page.type('#password', password);
        await this.page.click('#login-button');
        await this.page.waitForNavigation();
    }

    async checkPartNumber(partNumber) {
        try {
            // Implement part number checking logic
            await this.page.goto(`https://acenet-url.com/search?part=${partNumber}`);
            
            // Example logic - adapt to actual AceNet structure
            const result = {
                partNumber,
                status: 'found',
                hasAsterisk: false,
                isCancelled: false,
                isOnOrder: false,
                hasLocation: true,
                inAceNet: true,
                inRSC: true
            };

            // Add actual scraping logic here
            const pageContent = await this.page.content();
            
            // Check for various conditions
            if (pageContent.includes('not found')) {
                result.status = 'not_found';
                result.inAceNet = false;
            }
            
            if (pageContent.includes('*')) {
                result.hasAsterisk = true;
            }
            
            // Add more checks as needed
            
            return result;
        } catch (error) {
            return {
                partNumber,
                status: 'error',
                error: error.message
            };
        }
    }

    async processPartNumbers(partNumbers, progressCallback) {
        const results = [];
        
        for (let i = 0; i < partNumbers.length; i++) {
            const partNumber = partNumbers[i];
            
            if (progressCallback) {
                progressCallback(i + 1, partNumbers.length, `Processing ${partNumber}`);
            }
            
            const result = await this.checkPartNumber(partNumber);
            results.push(result);
            
            // Add delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return results;
    }

    async saveResults(results, outputFile) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Results');
        
        // Add headers
        worksheet.columns = [
            { header: 'Part Number', key: 'partNumber', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Has Asterisk', key: 'hasAsterisk', width: 15 },
            { header: 'Cancelled', key: 'isCancelled', width: 15 },
            { header: 'On Order', key: 'isOnOrder', width: 15 },
            { header: 'Has Location', key: 'hasLocation', width: 15 },
            { header: 'In AceNet', key: 'inAceNet', width: 15 },
            { header: 'In RSC', key: 'inRSC', width: 15 }
        ];
        
        // Add data
        results.forEach(result => {
            worksheet.addRow(result);
        });
        
        await workbook.xlsx.writeFile(outputFile);
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

async function runAceNetCheck(config) {
    const scraper = new AceNetScraper();
    
    try {
        await scraper.initialize();
        
        const partNumbers = await scraper.getPartNumbersFromFile(config.input_file);
        
        await scraper.login(config.username, config.password);
        
        const results = await scraper.processPartNumbers(partNumbers, (current, total, message) => {
            console.log(`PROGRESS:${current}/${total}:${message}`);
        });
        
        await scraper.saveResults(results, config.output_file);
        
        console.log(`SUCCESS: Output saved to ${config.output_file}`);
        return { main_output: config.output_file };
        
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    } finally {
        await scraper.close();
    }
}

module.exports = { runAceNetCheck }; 