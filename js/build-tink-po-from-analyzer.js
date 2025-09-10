/*
 * Build a Tink PO TSV from the updated analyzer for comparison
 * Usage: node js/build-tink-po-from-analyzer.js "Eagle Test.txt" [daysThreshold]
 */

const fs = require('fs').promises;
const path = require('path');
const { generateSuggestedOrder } = require('./inventory-analyzer');

async function main() {
    const [, , inputPathArg, daysArg] = process.argv;
    if (!inputPathArg) {
        console.error('Usage: node js/build-tink-po-from-analyzer.js "Eagle Test.txt" [daysThreshold]');
        process.exit(1);
    }
    const inputFile = path.resolve(inputPathArg);
    const daysThreshold = Number(daysArg) || 14;

    // Run analyzer
    const result = await generateSuggestedOrder({
        inputFile,
        supplierNumber: 10,
        daysThreshold,
        onOrderData: {}
    });

    const items = (result && result.orderData) || [];

    // Build TSV content in the schema expected by comparator/Tink PO snapshot
    const header = ['PARTNUMBER', 'SUPPLIER_NUMBER1', 'QUANTITY', 'MKTCOST'];
    const lines = [header.join('\t')];
    for (const it of items) {
        const part = it.partNumber || '';
        const supp = it.supplierNumber || 10;
        const qty = it.suggestedQty || 0;
        const cost = it.cost || 0;
        lines.push([part, supp, qty, cost].join('\t'));
    }

    // Use user's desktop or documents directory instead of app directory
    const os = require('os');
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const documentsPath = path.join(os.homedir(), 'Documents');
    
    // Try desktop first, then documents
    let outputDir = desktopPath;
    if (!fs.existsSync(desktopPath)) {
        outputDir = documentsPath;
    }
    
    const outFile = path.join(outputDir, 'Tink PO NEW.txt');
    await fs.writeFile(outFile, lines.join('\n'));
    console.log(`Wrote ${items.length} lines to ${outFile}`);
}

main().catch(err => {
    console.error('Failed to build Tink PO:', err.message);
    process.exit(1);
});


