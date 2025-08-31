/*
 * Suggested Order Comparator
 * - Compares Paladin suggested order vs Tink suggested order
 * - Diagnoses differences using core Tink logic (velocity, forecast, safety stock, MOQ, MINSTOCK)
 *
 * Usage:
 *   node js/compare-suggested-orders.js "Eagle Test.txt" "Eagle Paladin Suggested.txt" "Tink PO 20250830.txt" [daysThreshold]
 */

const fs = require('fs').promises;
const path = require('path');

// Simple TSV parser: returns array of objects keyed by header
async function parseTSV(filePath) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    const header = lines[0].split(/\t/).map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/\t/);
        const obj = {};
        for (let j = 0; j < header.length; j++) {
            obj[header[j]] = (cols[j] ?? '').toString().trim();
        }
        rows.push(obj);
    }
    return rows;
}

function toNumber(value, fallback = 0) {
    if (value === null || value === undefined) return fallback;
    const v = parseFloat(String(value).replace(/[,\s]+/g, '')); // remove commas/spaces
    return Number.isFinite(v) ? v : fallback;
}

function stdDev(values) {
    const arr = values.filter(v => Number.isFinite(v));
    const n = arr.length;
    if (n <= 1) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1);
    return Math.sqrt(variance);
}

function getWeekSeries(row) {
    const series = [];
    // Expect columns: WEEK_1..WEEK_104 (or WEEK1 style). We'll support both.
    for (let i = 1; i <= 104; i++) {
        const k1 = `WEEK_${i}`;
        const k2 = `WEEK${i}`;
        if (row.hasOwnProperty(k1)) series.push(toNumber(row[k1]));
        else if (row.hasOwnProperty(k2)) series.push(toNumber(row[k2]));
        else series.push(0);
    }
    // The analyzer treats WEEK_1 as most recent; ensure our order matches that convention
    // If the dataset is oldest->newest we need to detect; heuristic: if sum of first 4 weeks is << last 4
    // We'll assume WEEK_1 is most recent as in Tink exports
    return series;
}

function getVelocityLastN(series, weeks = 8) {
    const slice = series.slice(0, weeks); // WEEK_1..WEEK_8 are most recent per Tink analyzer
    if (slice.length === 0) return 0;
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / slice.length;
}

function calcSafetyStock(series, daysThreshold, z = 1.65) {
    const leadTimeWeeks = daysThreshold / 7;
    const lookback = Math.min(26, series.length);
    const recent = series.slice(0, lookback); // recent weeks first
    const sigma = stdDev(recent);
    return Math.max(0, z * sigma * Math.sqrt(leadTimeWeeks));
}

function ceilToMOQ(qty, moq) {
    if (!moq || moq <= 1) return Math.max(0, Math.ceil(qty));
    if (qty <= 0) return 0;
    return Math.ceil(qty / moq) * moq;
}

function analyzeReasonForNoTinkOrder(item, weeks, daysThreshold) {
    const currentStock = toNumber(item.STOCKONHAND, 0);
    const minOrderQty = toNumber(item.MINORDERQTY, 1);
    const minStock = toNumber(item.MINSTOCK, 0);
    const velocity = getVelocityLastN(weeks, 8);
    const forecastedNeed = velocity * (daysThreshold / 7);
    const safetyStock = calcSafetyStock(weeks, daysThreshold, 1.65);
    const overstock = currentStock > 2 * forecastedNeed;
    const shortage = forecastedNeed + safetyStock - currentStock;

    if (toNumber(item.DELETED, 0) === 1) {
        return { reason: 'Deleted item', velocity, forecastedNeed, safetyStock, currentStock, minOrderQty, minStock, shortage };
    }
    if (toNumber(item.MINORDERQTY, 0) === 0) {
        return { reason: 'MINORDERQTY=0 excluded', velocity, forecastedNeed, safetyStock, currentStock, minOrderQty, minStock, shortage };
    }
    if (overstock) {
        return { reason: 'Overstock prevention (stock > 2x forecasted need)', velocity, forecastedNeed, safetyStock, currentStock, minOrderQty, minStock, shortage };
    }
    if (velocity < 0.2) {
        if (currentStock < minOrderQty && minOrderQty > 0) {
            return { reason: 'Slow mover: would order MOQ if selected', velocity, forecastedNeed, safetyStock, currentStock, minOrderQty, minStock, shortage };
        }
        return { reason: 'Slow mover: no MOQ trigger', velocity, forecastedNeed, safetyStock, currentStock, minOrderQty, minStock, shortage };
    }
    if (shortage <= 0) {
        return { reason: 'No shortage after safety stock', velocity, forecastedNeed, safetyStock, currentStock, minOrderQty, minStock, shortage };
    }
    // If none matched, default catch-all
    return { reason: 'Not selected by other seasonal/heuristic checks', velocity, forecastedNeed, safetyStock, currentStock, minOrderQty, minStock, shortage };
}

async function main() {
    const [,, eagleTestPathArg, paladinPathArg, tinkPathArg, daysThresholdArg] = process.argv;
    if (!eagleTestPathArg || !paladinPathArg || !tinkPathArg) {
        console.error('Usage: node js/compare-suggested-orders.js "Eagle Test.txt" "Eagle Paladin Suggested.txt" "Tink PO 20250830.txt" [daysThreshold]');
        process.exit(1);
    }
    const daysThreshold = toNumber(daysThresholdArg, 14);

    const eagleTestPath = path.resolve(eagleTestPathArg);
    const paladinPath = path.resolve(paladinPathArg);
    const tinkPath = path.resolve(tinkPathArg);

    const [eagleRows, paladinRows, tinkRows] = await Promise.all([
        parseTSV(eagleTestPath),
        parseTSV(paladinPath),
        parseTSV(tinkPath)
    ]);

    // Build item master map from Eagle Test
    const eagleByPart = new Map();
    for (const row of eagleRows) {
        // Normalize column names
        const part = (row.PARTNUMBER || row['Part number'] || row['Part Number'] || '').toString().trim();
        if (!part) continue;
        eagleByPart.set(part, row);
    }

    // Parse Paladin suggestions map: part -> qty
    const paladinQtyByPart = new Map();
    for (const row of paladinRows) {
        const part = (row.PARTNUMBER || row['Part number'] || row['Part Number'] || '').toString().trim();
        if (!part) continue;
        const qty = toNumber(row.QUANTITY ?? row.Quantity ?? row[' Quantity '] ?? row['Qty'] ?? row['Order Qty'], 0);
        if (!paladinQtyByPart.has(part)) paladinQtyByPart.set(part, 0);
        paladinQtyByPart.set(part, paladinQtyByPart.get(part) + qty);
    }

    // Parse Tink suggestions map: part -> qty
    const tinkQtyByPart = new Map();
    for (const row of tinkRows) {
        const part = (row.PARTNUMBER || row['Part number'] || '').toString().trim();
        if (!part) continue;
        const qty = toNumber(row.QUANTITY ?? row.Quantity, 0);
        if (!tinkQtyByPart.has(part)) tinkQtyByPart.set(part, 0);
        tinkQtyByPart.set(part, tinkQtyByPart.get(part) + qty);
    }

    // Differences
    const inPaladinNotInTink = [];
    const qtyMismatch = [];
    const inTinkNotInPaladin = [];

    // Paladin reference
    for (const [part, pQty] of paladinQtyByPart.entries()) {
        const tQty = tinkQtyByPart.get(part) || 0;
        if (tQty === 0) {
            const item = eagleByPart.get(part) || {};
            const weeks = getWeekSeries(item);
            const diag = analyzeReasonForNoTinkOrder(item, weeks, daysThreshold);
            inPaladinNotInTink.push({ partNumber: part, paladinQty: pQty, tinkQty: 0, reason: diag.reason, metrics: diag });
        } else if (tQty !== pQty) {
            qtyMismatch.push({ partNumber: part, paladinQty: pQty, tinkQty: tQty });
        }
    }

    // Items Tink suggested that Paladin did not
    for (const [part, tQty] of tinkQtyByPart.entries()) {
        const pQty = paladinQtyByPart.get(part) || 0;
        if (pQty === 0) {
            const item = eagleByPart.get(part) || {};
            const weeks = getWeekSeries(item);
            const velocity = getVelocityLastN(weeks, 8);
            const safetyStock = calcSafetyStock(weeks, daysThreshold, 1.65);
            const currentStock = toNumber(item.STOCKONHAND, 0);
            inTinkNotInPaladin.push({ partNumber: part, tinkQty: tQty, paladinQty: 0, metrics: { velocity, safetyStock, currentStock } });
        }
    }

    const summary = {
        totals: {
            paladinItems: paladinQtyByPart.size,
            tinkItems: tinkQtyByPart.size,
            onlyInPaladin: inPaladinNotInTink.length,
            onlyInTink: inTinkNotInPaladin.length,
            qtyMismatches: qtyMismatch.length
        },
        samples: {
            onlyInPaladin: inPaladinNotInTink.slice(0, 25),
            onlyInTink: inTinkNotInPaladin.slice(0, 25),
            qtyMismatches: qtyMismatch.slice(0, 25)
        }
    };

    console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
    console.error('Comparator failed:', err.message);
    process.exit(1);
});


