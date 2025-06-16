const fs = require('fs').promises;
const path = require('path');
const { runAceNetCheck, runAceNetCheckDirect } = require('./acenet-scraper');
const { generateSuggestedOrder } = require('./inventory-analyzer');

async function main() {
    const args = process.argv.slice(2);
    
    // Check if we're receiving a config file (new format) or traditional args
    let config;
    let scriptType;
    let filePath;
    
    if (args.length === 1 && args[0].endsWith('.json')) {
        // New format: config file path
        const configPath = args[0];
        try {
            const configData = await fs.readFile(configPath, 'utf8');
            config = JSON.parse(configData);
            scriptType = config.script_type;
            filePath = config.input_file;
        } catch (error) {
            throw new Error(`Failed to read config file: ${error.message}`);
        }
    } else {
        // Traditional format: script type as first arg, file path as second
        scriptType = args[0];
        filePath = args[1];
    }
    
    let result = {};
    
    try {
                 if (scriptType === 'suggested_order') {
             try {
                 let skipFileOutput, daysThreshold, outputFile;
                 
                 if (config) {
                     // Using config file format
                     skipFileOutput = config.output_file === 'SKIP_FILE_OUTPUT';
                     daysThreshold = config.days_threshold || 14;
                     outputFile = config.output_file;
                 } else {
                     // Using traditional args format
                     skipFileOutput = args.includes('--skip-file-output');
                     const daysIndex = args.indexOf('--days');
                     daysThreshold = daysIndex !== -1 ? parseInt(args[daysIndex + 1]) : 14;
                     outputFile = skipFileOutput ? 'SKIP_FILE_OUTPUT' : `suggested_order_output_${Date.now()}.xlsx`;
                 }
                 
                 const orderResult = await generateSuggestedOrder({
                     inputFile: filePath,
                     outputFile: outputFile,
                     supplierNumber: 10,
                     daysThreshold: daysThreshold,
                     currentMonth: config ? config.current_month : null
                 });
                
                // Handle the new return format (no file output) and set the main result
                if (orderResult && (orderResult.orderData || orderResult.processed_items !== undefined)) {
                    // Send debug info to stderr so it doesn't interfere with JSON parsing
                    console.error(`SUCCESS: Generated ${orderResult.processed_items || 0} order recommendations`);
                    
                    // Set the main result object for final JSON output
                    result = {
                        success: true,
                        output: `Generated ${orderResult.processed_items || 0} order recommendations`,
                        orderData: orderResult.orderData || [],
                        processed_items: orderResult.processed_items || 0,
                        debug: orderResult.debug || {}
                    };
                } else {
                    console.error("ERROR: No output generated");
                    process.exit(1);
                }
                
            } catch (error) {
                console.error(`Processing failed: ${error.message}`);
                console.error(error.stack);
                process.exit(1);
            }
        } else if (scriptType === 'check_acenet_direct') {
            // Direct processing with part numbers array
            const usernameIndex = args.indexOf('--username');
            const passwordIndex = args.indexOf('--password');
            const storeIndex = args.indexOf('--store');
            const partNumbersIndex = args.indexOf('--part-numbers');
            
            if (usernameIndex !== -1 && passwordIndex !== -1 && storeIndex !== -1 && partNumbersIndex !== -1) {
                const username = args[usernameIndex + 1];
                const password = args[passwordIndex + 1];
                const store = args[storeIndex + 1];
                const partNumbersJson = args[partNumbersIndex + 1];
                
                try {
                    const partNumbers = JSON.parse(partNumbersJson);
                    result = await runAceNetCheckDirect(partNumbers, username, password, store);
                } catch (parseError) {
                    throw new Error(`Failed to parse part numbers: ${parseError.message}`);
                }
            } else {
                throw new Error('Missing required arguments for direct AceNet processing');
            }
        } else if (scriptType.includes('check_acenet')) {
            // File-based processing
            let username, password, store, sheetName;
            
            if (config) {
                // Using config file format
                username = config.username;
                password = config.password;
                store = config.store;
                sheetName = config.sheet_name || 'Big Beautiful Order';
            } else {
                // Using traditional args format
                const usernameIndex = args.indexOf('--username');
                const passwordIndex = args.indexOf('--password');
                const storeIndex = args.indexOf('--store');
                const sheetIndex = args.indexOf('--sheet');
                
                if (usernameIndex !== -1 && passwordIndex !== -1 && storeIndex !== -1) {
                    username = args[usernameIndex + 1];
                    password = args[passwordIndex + 1];
                    store = args[storeIndex + 1];
                    sheetName = sheetIndex !== -1 ? args[sheetIndex + 1] : 'Big Beautiful Order';
                } else {
                    throw new Error('Missing required AceNet credentials (username, password, store)');
                }
            }
            
            if (!username || !password || !store) {
                throw new Error('Missing required AceNet credentials (username, password, store)');
            }
            
            result = await runAceNetCheck(filePath, username, password, store, sheetName);
        } else {
            throw new Error(`Unknown script type: ${scriptType}`);
        }
        
        console.log(JSON.stringify(result));
        
    } catch (error) {
        console.error('Processing failed:', error.message);
        console.log(JSON.stringify({
            success: false,
            error: error.message
        }));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main }; 