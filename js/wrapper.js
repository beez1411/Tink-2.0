const fs = require('fs').promises;
const path = require('path');
const { runAceNetCheck } = require('./acenet-scraper');
const { generateSuggestedOrder } = require('./inventory-analyzer');

async function main() {
    if (process.argv.length < 3) {
        console.error("Error: Config file path required");
        process.exit(1);
    }
    
    const configPath = process.argv[2];
    
    try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        const scriptType = config.script_type || '';
        
        if (scriptType.includes('check_acenet')) {
            // Progress callback that prints to stdout for Electron to capture
            const progressCallback = (current, total, message) => {
                console.log(`PROGRESS:${current}/${total}:${message}`);
            };
            
            try {
                const result = await runAceNetCheck({
                    input_file: config.input_file,
                    output_file: config.output_file,
                    username: config.username,
                    password: config.password,
                    store: config.store,
                    sheet_name: config.sheet_name || 'Big Beautiful Order',
                    progress_callback: progressCallback
                });
                
                const actualOutputFile = result?.main_output || config.output_file;
                console.log(`SUCCESS: Output saved to ${actualOutputFile}`);
            } catch (error) {
                console.error(`Processing failed: ${error.message}`);
                console.error(error.stack);
                process.exit(1);
            }
            
        } else if (scriptType.includes('suggested_order')) {
            try {
                const result = await generateSuggestedOrder({
                    inputFile: config.input_file,
                    outputFile: config.output_file,
                    supplierNumber: config.supplier_number || 10,
                    daysThreshold: config.days_threshold || 14,
                    currentMonth: config.current_month
                });
                
                if (result && result.main_output) {
                    console.log(`SUCCESS: Output saved to ${result.main_output}`);
                    if (result.partnumber_output) {
                        console.log(`PARTNUMBER_FILE: ${result.partnumber_output}`);
                    }
                } else {
                    console.error("ERROR: No output generated");
                    process.exit(1);
                }
                
            } catch (error) {
                console.error(`Processing failed: ${error.message}`);
                console.error(error.stack);
                process.exit(1);
            }
        } else {
            console.error(`Error: Unknown script type '${scriptType}'`);
            process.exit(1);
        }
        
    } catch (error) {
        console.error(`Error reading config file: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main }; 