/*
 * ENHANCED INVENTORY ANALYZER - PYTHON SCRIPT COMPATIBILITY
 * =========================================================
 * 
 * This enhanced version implements key improvements to match the robustness 
 * of the original Python "Stable - Suggested Order.py" script:
 * 
 * KEY ENHANCEMENTS IMPLEMENTED:
 * 
 * 1. ADVANCED STATISTICAL ANALYSIS:
 *    - 6-feature clustering (variance, peak/mean, autocorr, coeff_var, zero_weeks, slope)
 *    - Enhanced seasonal decomposition (simplified STL-like approach)
 *    - Proper autocorrelation and trend slope calculations
 *    - Statistical safety stock using Z-scores (95% service level)
 * 
 * 2. TWO-PHASE ORDERING LOGIC (MATCHES PYTHON):
 *    Phase 1 - Dynamic Order Logic:
 *    - Overstock prevention (2x forecasted need check)
 *    - Slow mover handling (velocity < 0.2 threshold)
 *    - Velocity-based forecasting (8-week velocity calculation)
 *    - Safety stock calculation (Z=1.65, 26-week lookback)
 *    
 *    Phase 2 - MINSTOCK Post-Check Logic:
 *    - Comprehensive MINSTOCK validation (>= 2 threshold)
 *    - Post-order tracking like Python script
 *    - Automatic quantity adjustment to meet MINSTOCK
 * 
 * 3. COMPREHENSIVE LOGGING SYSTEM:
 *    - Forecast accuracy tracking
 *    - Data quality issue logging
 *    - Stock event logging (overstock, stockout risks)
 *    - Phase-based order tracking
 * 
 * 4. ENHANCED FORECASTING:
 *    - Seasonal forecasting with STL-like decomposition
 *    - Fallback logic for insufficient data
 *    - Data quality checks during forecasting
 *    - Multiple forecasting strategies by demand pattern
 * 
 * 5. IMPROVED ERROR HANDLING:
 *    - Robust statistical calculations with fallbacks
 *    - Better edge case handling
 *    - Comprehensive data validation
 * 
 * This implementation now closely matches the Python script's sophisticated
 * ordering logic and should produce consistent results.
 */

const Papa = require('papaparse');
const ss = require('simple-statistics');
const { kmeans } = require('ml-kmeans');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class AdvancedInventoryAnalyzer {
    constructor() {
        this.data = null;
        this.debugMode = true;
        this.Z_SCORE = 1.65; // 95% service level
        this.SEASONAL_THRESHOLD = 0.3; // Threshold for seasonal pattern detection
        this.ERRATIC_THRESHOLD = 2.0; // Threshold for erratic pattern detection
        this.debugInfo = {};
        this.onOrderData = {};
        
        // Enhanced logging system like Python script
        this.forecastAccuracyLog = [];
        this.dataQualityLog = [];
        this.stockEventLog = [];
        
        // Configuration constants
        this.OVERSTOCK_MULTIPLIER = 2.0; // Like Python's 2x forecasted need check
        this.SLOW_MOVER_THRESHOLD = 0.2; // Like Python's velocity < 0.2
        this.Z_SCORE_95 = 1.65; // 95% service level like Python
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    async loadData(inputFile) {
        try {
            const fileContent = await fs.readFile(inputFile, 'utf-8');
            const parsed = Papa.parse(fileContent, {
                delimiter: '\t',
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false // Keep as strings initially for better control
            });
            
            this.data = parsed.data;
            this.log(`Loaded ${parsed.data.length} rows from ${inputFile}`);
            
            if (parsed.data.length > 0) {
                this.log('Column structure:', Object.keys(parsed.data[0]));
            }
            
            return parsed.data;
        } catch (error) {
            throw new Error(`Failed to load data: ${error.message}`);
        }
    }

    // Enhanced feature engineering to match Python's 6-feature approach
    featureEngineering(salesMatrix) {
        const features = [];
        
        for (let i = 0; i < salesMatrix.length; i++) {
            const series = salesMatrix[i];
            
            if (!series || series.length === 0) {
                features.push([0, 0, 0, 0, 0, 0]);
                continue;
            }

            // Feature 1: Variance
            const variance = ss.variance(series);
            
            // Feature 2: Peak to mean ratio
            const mean = ss.mean(series);
            const peak = Math.max(...series);
            const peakToMean = mean > 0 ? peak / mean : 0;
            
            // Feature 3: Autocorrelation (lag-1)
            const autocorr = this.calculateAutocorrelation(series);
            
            // Feature 4: Coefficient of variation (std/mean) - ADDED FROM PYTHON
            const std = Math.sqrt(variance);
            const coeffVar = mean > 0 ? std / mean : 0;
            
            // Feature 5: Zero-sales weeks - ADDED FROM PYTHON
            const zeroWeeks = series.filter(x => x === 0).length;
            
            // Feature 6: Trend slope - ENHANCED
            const slope = this.calculateTrendSlope(series);

            features.push([
                variance || 0,
                peakToMean || 0,
                autocorr || 0,
                coeffVar || 0,
                zeroWeeks || 0,
                slope || 0
            ]);
        }
        
        return features;
    }

    calculateAutocorrelation(series) {
        if (series.length < 2) return 0;
        
        try {
            const n = series.length - 1;
            const x1 = series.slice(0, n);
            const x2 = series.slice(1);
            
            return ss.sampleCorrelation(x1, x2) || 0;
        } catch (error) {
            return 0;
        }
    }

    calculateTrendSlope(series) {
        if (series.length < 2) return 0;
        
        const n = series.length;
        const x = Array.from({length: n}, (_, i) => i);
        
        try {
            const regression = ss.linearRegression(x.map((xi, i) => [xi, series[i]]));
            return regression.m || 0;
        } catch (error) {
            return 0;
        }
    }

    // Detect seasonality using simplified approach
    detectSeasonality(series) {
        if (series.length < 52) return 0;
        
        try {
            // Compare same periods across years
            const year1 = series.slice(0, 52);
            const year2 = series.slice(52, 104);
            
            if (year2.length < 52) return 0;
            
            return ss.sampleCorrelation(year1, year2) || 0;
        } catch (error) {
            return 0;
        }
    }

    // Calculate velocity change (recent vs historical performance)
    calculateVelocityChange(series) {
        if (series.length < 26) return 0;
        
        const recent = series.slice(-13); // Last 13 weeks
        const historical = series.slice(-26, -13); // Previous 13 weeks
        
        const recentAvg = recent.length > 0 ? ss.mean(recent) : 0;
        const historicalAvg = historical.length > 0 ? ss.mean(historical) : 0;
        
        if (historicalAvg === 0) return recentAvg > 0 ? 1 : 0;
        
        return (recentAvg - historicalAvg) / historicalAvg;
    }

    // Enhanced clustering with better label assignment
    clusterSKUs(features, nClusters = 3) {
        if (features.length < nClusters) {
            // Fallback for small datasets
            return {
                labels: new Array(features.length).fill(0),
                centers: [features[0] || new Array(8).fill(0)]
            };
        }

        const result = kmeans(features, nClusters, {
            initialization: 'random',
            seed: 42,
            maxIterations: 100
        });
        
        const centers = result.centroids.map(centroidInfo => {
            if (Array.isArray(centroidInfo)) {
                return centroidInfo;
            } else if (centroidInfo && centroidInfo.centroid) {
                return centroidInfo.centroid;
            } else {
                return centroidInfo;
            }
        });
        
        return {
            labels: result.clusters,
            centers: centers
        };
    }

    // Enhanced cluster label assignment to match Python logic
    assignClusterLabels(centers) {
        if (!centers || centers.length === 0) {
            return { 0: 'steady' };
        }

        const labelMap = {};
        
        // Extract statistics for each cluster
        const clusterMetrics = centers.map((center, idx) => ({
            idx,
            variance: center[0] || 0,
            peakToMean: center[1] || 0,
            autocorr: center[2] || 0,
            coeffVar: center[3] || 0,
            zeroWeeks: center[4] || 0,
            slope: center[5] || 0
        }));

        // Assign labels using Python's approach
        // Steady: lowest variance
        const steadyIdx = clusterMetrics.reduce((min, current) => 
            current.variance < min.variance ? current : min
        ).idx;

        // Seasonal: highest autocorrelation
        const seasonalIdx = clusterMetrics.reduce((max, current) => 
            current.autocorr > max.autocorr ? current : max
        ).idx;

        // Erratic: highest peak-to-mean ratio
        const erraticIdx = clusterMetrics.reduce((max, current) => 
            current.peakToMean > max.peakToMean ? current : max
        ).idx;

        // Handle overlaps like Python script
        const used = new Set([steadyIdx, seasonalIdx, erraticIdx]);
        
        for (let i = 0; i < centers.length; i++) {
            if (i === steadyIdx) {
                labelMap[i] = 'steady';
            } else if (i === seasonalIdx) {
                labelMap[i] = 'seasonal';
            } else if (i === erraticIdx) {
                labelMap[i] = 'erratic';
            } else {
                labelMap[i] = `cluster_${i}`;
            }
        }

        return labelMap;
    }

    // Enhanced demand forecasting to closely match Python logic
    forecastDemand(salesSeries, label, daysThreshold, itemData = {}) {
        const partNumber = itemData.PARTNUMBER || 'Unknown';
        
        if (!salesSeries || salesSeries.length === 0) {
            return 0;
        }

        // Data quality checks like Python script
        this.performDataQualityChecks(itemData, salesSeries, partNumber);

        const forecastWeeks = daysThreshold / 7;
        let forecast = 0;

        try {
            if (label === 'steady') {
                // Last 26 weeks average like Python
                const recentSales = salesSeries.slice(-26);
                const avg = recentSales.length > 0 ? ss.mean(recentSales) : 0;
                forecast = avg * forecastWeeks;
                
            } else if (label === 'seasonal') {
                // Enhanced seasonal logic closer to Python's STL approach
                forecast = this.forecastSeasonal(salesSeries, forecastWeeks);
                
            } else { // erratic or fallback
                // Use median of last 20 weeks like Python
                const recentSales = salesSeries.slice(-20);
                const median = recentSales.length > 0 ? ss.median(recentSales) : 0;
                forecast = median * forecastWeeks;
            }

            // Log forecast accuracy if we have actual data
            if (itemData.WEEK_CURRENT !== undefined) {
                this.forecastAccuracyLog.push({
                    partNumber,
                    forecast,
                    actual: itemData.WEEK_CURRENT
                });
            }

        } catch (error) {
            this.log(`Forecasting error for ${partNumber}: ${error.message}`);
            // Fallback to simple average
            const recentSales = salesSeries.slice(-12);
            forecast = recentSales.length > 0 ? ss.mean(recentSales) * forecastWeeks : 0;
        }

        return Math.max(0, forecast);
    }

    // Enhanced seasonal forecasting (closer to STL approach)
    forecastSeasonal(salesSeries, forecastWeeks) {
        if (salesSeries.length < 56) {
            // Not enough data for seasonal analysis, fallback
            const recentSales = salesSeries.slice(-12);
            return recentSales.length > 0 ? ss.mean(recentSales) * forecastWeeks : 0;
        }

        try {
            // Simplified seasonal decomposition approach
            const period = 52; // 52 weeks seasonal period
            
            // Check for sufficient variation
            const uniqueValues = [...new Set(salesSeries)].length;
            if (uniqueValues < 2) {
                // Fallback to same period last year like Python
                const samePeriodLastYear = salesSeries.slice(-56, -52);
                const fallbackAvg = samePeriodLastYear.length > 0 ? ss.mean(samePeriodLastYear) : 0;
                return fallbackAvg * forecastWeeks;
            }

            // Extract seasonal component (simplified)
            const recentPeriod = salesSeries.slice(-period);
            const trend = this.calculateTrendSlope(recentPeriod);
            const seasonal = this.extractSeasonalComponent(salesSeries, period);
            
            // Forecast = trend + seasonal like Python's STL
            const forecast = (trend + seasonal) * forecastWeeks;
            return Math.max(0, forecast);
            
        } catch (error) {
            // Fallback logic like Python script
            if (salesSeries.length >= 56) {
                const samePeriodLastYear = salesSeries.slice(-56, -52);
                const fallbackAvg = samePeriodLastYear.length > 0 ? ss.mean(samePeriodLastYear) : 0;
                return fallbackAvg * forecastWeeks;
            } else {
                const recentSales = salesSeries.slice(-12);
                return recentSales.length > 0 ? ss.mean(recentSales) * forecastWeeks : 0;
            }
        }
    }

    // Extract seasonal component (simplified STL-like approach)
    extractSeasonalComponent(series, period) {
        if (series.length < period * 2) {
            return 0;
        }

        // Calculate moving average to remove trend
        const movingAvgs = [];
        const halfPeriod = Math.floor(period / 2);
        
        for (let i = halfPeriod; i < series.length - halfPeriod; i++) {
            const window = series.slice(i - halfPeriod, i + halfPeriod + 1);
            movingAvgs.push(ss.mean(window));
        }

        // Detrended series
        const detrended = [];
        for (let i = 0; i < movingAvgs.length; i++) {
            detrended.push(series[i + halfPeriod] - movingAvgs[i]);
        }

        // Extract seasonal pattern from detrended data
        const seasonalPattern = new Array(period).fill(0);
        const counts = new Array(period).fill(0);
        
        for (let i = 0; i < detrended.length; i++) {
            const seasonalIndex = (i + halfPeriod) % period;
            seasonalPattern[seasonalIndex] += detrended[i];
            counts[seasonalIndex]++;
        }

        // Average seasonal values
        for (let i = 0; i < period; i++) {
            if (counts[i] > 0) {
                seasonalPattern[i] /= counts[i];
            }
        }

        // Return the seasonal component for the most recent period
        const currentSeasonalIndex = (series.length - 1) % period;
        return seasonalPattern[currentSeasonalIndex] || 0;
    }

    // Enhanced data quality checks like Python script
    performDataQualityChecks(itemData, salesSeries, partNumber) {
        const issues = [];

        // Check for negative sales
        if (salesSeries.some(x => x < 0)) {
            issues.push('Negative sales detected');
        }

        // Check for outlier spikes
        const nonZeroSales = salesSeries.filter(x => x > 0);
        if (nonZeroSales.length > 0) {
            const median = ss.median(nonZeroSales);
            const max = Math.max(...salesSeries);
            if (max > 10 * median) {
                issues.push('Outlier spike detected');
            }
        }

        // Check for mostly zero sales
        const zeroCount = salesSeries.filter(x => x === 0).length;
        if (zeroCount > 80) {
            issues.push('Mostly zero sales');
        }

        // Log issues
        if (issues.length > 0) {
            this.dataQualityLog.push({
                partNumber,
                issues: issues.join(', ')
            });
        }

        return issues;
    }

    // Get sales velocity like Python script (8 weeks default)
    getSalesVelocity(salesSeries, weeks = 8) {
        const recentSales = salesSeries.slice(-weeks);
        return recentSales.length > 0 ? ss.mean(recentSales) : 0;
    }

    // Calculate demand standard deviation like Python script
    calculateDemandStandardDeviation(salesSeries) {
        if (!salesSeries || salesSeries.length <= 1) {
            return 0;
        }
        try {
            return ss.standardDeviation(salesSeries);
        } catch (error) {
            return 0;
        }
    }

    // Calculate safety stock using advanced statistical methods (enhanced)
    calculateSafetyStock(salesSeries, daysThreshold, serviceLevel = 0.95) {
        if (!salesSeries || salesSeries.length < 4) return 0;
        
        const leadTimeWeeks = daysThreshold / 7;
        const lookback = Math.min(26, salesSeries.length);
        const recentSales = salesSeries.slice(-lookback);
        
        // Calculate demand variability
        const demandStd = this.calculateDemandStandardDeviation(recentSales);
        
        // Z-score for service level
        const zScore = this.getZScore(serviceLevel);
        
        // Safety stock formula: Z * σ * √L
        const safetyStock = zScore * demandStd * Math.sqrt(leadTimeWeeks);
        
        return Math.max(0, Math.round(safetyStock));
    }

    getZScore(serviceLevel) {
        // Common service levels and their Z-scores
        const zScores = {
            0.90: 1.28,
            0.95: 1.65,
            0.97: 1.88,
            0.99: 2.33
        };
        
        return zScores[serviceLevel] || 1.65; // Default to 95%
    }

    // Main analysis function with enhanced logic
    async generateSuggestedOrder(config) {
        this.log(`Starting advanced inventory analysis with config:`, config);
        
        const {
            inputFile,
            supplierNumber = 10,
            daysThreshold = 14,
            serviceLevel = 0.95,
            currentMonth = null,
            onOrderData = {} // Accept on order data
        } = config;
        
        // Store on order data for use in analysis
        this.onOrderData = onOrderData;
        this.log(`On order data contains ${Object.keys(onOrderData).length} items`);
        
        try {
            // Load and prepare data
            this.log('Loading inventory data...');
            const data = await this.loadData(inputFile);
            
            this.log('Filtering data by supplier...');
            const filtered = this.filterData(data, supplierNumber);
            this.log(`Filtered to ${filtered.length} records for supplier ${supplierNumber}`);
            
            if (filtered.length === 0) {
                throw new Error(`No data found for supplier ${supplierNumber}`);
            }
            
            this.log('Extracting sales data and performing quality checks...');
            const { salesData, weekColumns, validItems } = this.extractSalesData(filtered);
            this.log(`Found ${validItems.length} valid items with sales data`);
            
            if (validItems.length === 0) {
                throw new Error('No valid items found with sales data');
            }
            
            // Feature engineering and clustering
            this.log('Performing feature engineering...');
            const features = this.featureEngineering(salesData);
            
            this.log('Clustering SKUs by sales patterns...');
            const clustering = this.clusterSKUs(features, 3);
            const labelMap = this.assignClusterLabels(clustering.centers);
            
            // Generate comprehensive order analysis
            const results = this.generateOrderRecommendations(
                validItems, 
                salesData, 
                clustering.labels, 
                labelMap, 
                daysThreshold, 
                serviceLevel
            );
            
            // Skip file saving - only return data for UI display
            this.log(`Analysis complete. Generated ${results.orderItems.length} order recommendations`);
            
            return {
                processed_items: results.orderItems.length,
                orderData: results.orderItems,
                debug: results.debug
            };
            
        } catch (error) {
            this.log(`Error in analysis: ${error.message}`);
            throw new Error(`Advanced analysis failed: ${error.message}`);
        }
    }

    filterData(data, supplierNumber) {
        this.log(`Filtering data for supplier ${supplierNumber} from ${data.length} total items`);
        
        if (data.length > 0) {
            this.log('Available columns:', Object.keys(data[0]));
        }
        
        let itemsSkippedMinOrderQty = 0;
        
        const filtered = data.filter(row => {
            // More flexible supplier matching - check all possible column names
            const supplierMatch = 
                (this.parseNumber(row.SUPPLIERNUMBER) || 0) === supplierNumber ||
                (this.parseNumber(row.SUPPLIER_NUMBER1) || 0) === supplierNumber || 
                (this.parseNumber(row.SUPPLIER_NUMBER) || 0) === supplierNumber ||
                (this.parseNumber(row.SUPPLIER) || 0) === supplierNumber ||
                (this.parseNumber(row['SUPPLIER NUMBER']) || 0) === supplierNumber;
            
            // Enhanced deletion check
            const notDeleted = !(
                row.DELETED === 1 || 
                row.DELETED === '1' || 
                row.DELETED === true ||
                row.DELETED === 'true' ||
                row.DELETED === 'Y' ||
                row.DELETED === 'y'
            );
            
            // Exclude items with MINORDERQTY of 0 (closeout/discontinued items)
            const minOrderQty = this.parseNumber(row.MINORDERQTY);
            const hasValidMinOrder = minOrderQty === null || minOrderQty > 0;
            
            // Track items excluded for MINORDERQTY = 0
            if (supplierMatch && notDeleted && minOrderQty === 0) {
                itemsSkippedMinOrderQty++;
            }
            
            return supplierMatch && notDeleted && hasValidMinOrder;
        });
        
        this.log(`After filtering: ${filtered.length} items match supplier ${supplierNumber}`);
        this.log(`Items skipped due to MINORDERQTY=0: ${itemsSkippedMinOrderQty}`);
        
        // Store debug info for later use
        this.debugInfo = this.debugInfo || {};
        this.debugInfo.itemsSkippedMinOrderQty = itemsSkippedMinOrderQty;
        
        // If no items match, try with more lenient filtering (but still exclude MINORDERQTY=0)
        if (filtered.length === 0) {
            this.log('No items found with strict filtering, trying lenient approach...');
            
            const lenientFiltered = data.filter(row => {
                // Check supplier number and exclude MINORDERQTY=0 items
                const supplierMatch = 
                    (this.parseNumber(row.SUPPLIERNUMBER) || 0) === supplierNumber ||
                    (this.parseNumber(row.SUPPLIER_NUMBER1) || 0) === supplierNumber || 
                    (this.parseNumber(row.SUPPLIER_NUMBER) || 0) === supplierNumber ||
                    (this.parseNumber(row.SUPPLIER) || 0) === supplierNumber ||
                    (this.parseNumber(row['SUPPLIER NUMBER']) || 0) === supplierNumber;
                
                // Still exclude MINORDERQTY=0 items even in lenient mode
                const minOrderQty = this.parseNumber(row.MINORDERQTY);
                const hasValidMinOrder = minOrderQty === null || minOrderQty > 0;
                
                return supplierMatch && hasValidMinOrder;
            });
            
            this.log(`Lenient filtering found ${lenientFiltered.length} items`);
            return lenientFiltered;
        }
        
        return filtered;
    }

    extractSalesData(filtered) {
        const weekColumns = [];
        const salesData = [];
        const validItems = [];
        
        if (filtered.length === 0) {
            return { salesData, weekColumns, validItems };
        }
        
        // Find week columns - check the actual column names in the data
        const firstRow = filtered[0];
        const allColumns = Object.keys(firstRow);
        
        // Look for week columns in the data
        for (const column of allColumns) {
            if (column.match(/^WEEK_\d+$/i) || 
                column.match(/^WEEK\d+$/i) || 
                column.match(/^Week_\d+$/i) || 
                column.match(/^Week\d+$/i)) {
                weekColumns.push(column);
            }
        }
        
        // Sort week columns numerically
        weekColumns.sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        });
        
        this.log(`Found ${weekColumns.length} week columns:`, weekColumns.slice(0, 5));
        
        // Extract sales data for each item
        for (const row of filtered) {
            const sales = weekColumns.map(col => {
                const val = this.parseNumber(row[col]);
                return val === null ? 0 : val;
            });
            const totalSales = sales.reduce((a, b) => a + b, 0);
            
            // Only include items with some sales history or current stock
            const currentStock = this.parseNumber(row.STOCKONHAND) || 0;
            if (totalSales > 0 || currentStock > 0) {
                salesData.push(sales);
                validItems.push(row);
            }
        }
        
        return { salesData, weekColumns, validItems };
    }

    // Two-phase ordering logic like Python script
    generateOrderRecommendations(items, salesData, clusterLabels, labelMap, daysThreshold, serviceLevel) {
        const orderItems = [];
        const debug = {
            totalItems: items.length,
            itemsAnalyzed: 0,
            itemsWithForecast: 0,
            itemsNeedingOrder: 0,
            dataQualityIssues: 0,
            itemsSkippedMinOrderQty: this.debugInfo?.itemsSkippedMinOrderQty || 0,
            clusterDistribution: {},
            // Add missing fields
            filteredItems: items.length,
            itemsWithStock: 0,
            itemsBelowMinStock: 0,
            weekColumnsFound: 0, // Will be set later
            totalSalesValue: 0,
            // Enhanced logging counters
            overstockPrevention: 0,
            slowMoverHandling: 0,
            phase1Orders: 0,
            phase2MinStockAdjustments: 0
        };

        // Calculate week columns found
        if (salesData.length > 0) {
            debug.weekColumnsFound = salesData[0].length;
        }

        // Pre-scan to collect additional debug info
        let totalSalesValue = 0;
        let itemsWithStock = 0;
        let itemsBelowMinStock = 0;
        
        for (let i = 0; i < items.length; i++) {
            const row = items[i];
            const sales = salesData[i];
            const currentStock = this.parseNumber(row.STOCKONHAND) || 0;
            const minStock = this.parseNumber(row.MINSTOCK) || 0;
            const unitCost = this.parseNumber(row.UNITCOST) || 0;
            
            // Count items with stock
            if (currentStock > 0) {
                itemsWithStock++;
            }
            
            // Count items below min stock
            if (minStock > 0 && currentStock < minStock) {
                itemsBelowMinStock++;
            }
            
            // Calculate total sales value
            const totalSales = sales.reduce((a, b) => a + b, 0);
            totalSalesValue += totalSales * unitCost;
        }
        
        debug.itemsWithStock = itemsWithStock;
        debug.itemsBelowMinStock = itemsBelowMinStock;
        debug.totalSalesValue = totalSalesValue;
        
        // PHASE 1: DYNAMIC ORDER LOGIC (like Python script)
        this.log('Starting Phase 1: Dynamic Order Logic');
        
        for (let i = 0; i < items.length; i++) {
            const row = items[i];
            const sales = salesData[i];
            const clusterLabel = labelMap[clusterLabels[i]] || 'steady';
            
            debug.itemsAnalyzed++;
            debug.clusterDistribution[clusterLabel] = (debug.clusterDistribution[clusterLabel] || 0) + 1;
            
            // Parse item data
            const partNumber = row.PARTNUMBER || `Item_${i}`;
            const description = row.DESCRIPTION1 || row.DESCRIPTION || 'No Description';
            const currentStock = this.parseNumber(row.STOCKONHAND) || 0;
            const minStock = this.parseNumber(row.MINSTOCK) || 0;
            const minOrderQty = this.parseNumber(row.MINORDERQTY) || 1;
            const unitCost = this.parseNumber(row.UNITCOST) || 0;
            
            // Safety check: Skip items with MINORDERQTY of 0
            if (this.parseNumber(row.MINORDERQTY) === 0) {
                continue;
            }
            
            // Data quality checks
            const qualityIssues = this.performDataQualityChecks(row, sales, partNumber);
            if (qualityIssues.length > 0) {
                debug.dataQualityIssues++;
            }
            
            // Get sales velocity and forecast like Python script
            const velocity = this.getSalesVelocity(sales, 8); // 8 weeks like Python
            const forecastedNeed = velocity * (daysThreshold / 7);
            const forecast = this.forecastDemand(sales, clusterLabel, daysThreshold, row);
            if (forecast > 0) debug.itemsWithForecast++;
            
            // Calculate safety stock like Python (Z = 1.65, 95% service level)
            const leadTimeWeeks = daysThreshold / 7;
            const demandStd = this.calculateDemandStandardDeviation(sales.slice(-26));
            const safetyStock = this.Z_SCORE_95 * demandStd * Math.sqrt(leadTimeWeeks);
            
            // Get on order quantity
            const onOrderQty = (this.onOrderData && this.onOrderData[partNumber]) || 0;
            
            let orderQty = 0;
            let orderReason = '';
            
            // PYTHON SCRIPT LOGIC: Dynamic order logic
            // 1. Overstock prevention check
            if (currentStock > this.OVERSTOCK_MULTIPLIER * forecastedNeed) {
                orderQty = 0;
                this.stockEventLog.push({
                    partNumber,
                    event: 'Overstock',
                    currentStock,
                    forecastedNeed
                });
                debug.overstockPrevention++;
                
            // 2. Slow mover check
            } else if (velocity < this.SLOW_MOVER_THRESHOLD) {
                if (currentStock < minOrderQty && minOrderQty > 0) {
                    orderQty = minOrderQty;
                    orderReason = 'Stockout risk (slow mover)';
                    this.stockEventLog.push({
                        partNumber,
                        event: 'Stockout risk (slow mover)',
                        currentStock,
                        minOrderQty
                    });
                    debug.slowMoverHandling++;
                } else {
                    orderQty = 0;
                }
                
            // 3. Normal velocity items
            } else {
                const shortage = forecastedNeed + safetyStock - currentStock;
                if (shortage > 0 && minOrderQty > 0) {
                    orderQty = Math.ceil(shortage / minOrderQty) * minOrderQty;
                    orderReason = `Dynamic forecast-based order (shortage: ${Math.round(shortage)})`;
                    
                    if (currentStock < safetyStock) {
                        this.stockEventLog.push({
                            partNumber,
                            event: 'Stockout risk',
                            currentStock,
                            safetyStock
                        });
                    }
                } else {
                    orderQty = 0;
                }
            }
            
            // Add to order items if quantity > 0
            if (orderQty > 0) {
                debug.phase1Orders++;
                
                orderItems.push({
                    partNumber,
                    description,
                    category: clusterLabel,
                    currentStock,
                    safetyStock: Math.round(safetyStock),
                    suggestedQty: orderQty,
                    cost: unitCost,
                    supplierNumber: row.SUPPLIER_NUMBER1 || row.SUPPLIERNUMBER || row.SUPPLIER_NUMBER || row.SUPPLIER || '10',
                    demandStd: Math.round(demandStd * 100) / 100,
                    daysThreshold,
                    forecast: Math.round(forecast * 100) / 100,
                    velocity: Math.round(velocity * 100) / 100,
                    forecastedNeed: Math.round(forecastedNeed * 100) / 100,
                    minStock,
                    minOrderQty,
                    recentSales: sales.slice(-4).reduce((a, b) => a + b, 0),
                    avgWeeklySales: (() => {
                        const recentSalesForAvg = sales.slice(-12);
                        return recentSalesForAvg.length > 0 ? ss.mean(recentSalesForAvg) : 0;
                    })(),
                    totalSales104Weeks: sales.reduce((a, b) => a + b, 0),
                    stockTurnover: this.calculateStockTurnover(sales, currentStock),
                    orderReason: orderReason || 'Phase 1 dynamic order',
                    qualityIssues: qualityIssues.join(', ') || 'None',
                    confidence: 0.8,
                    orderPhase: 'Phase 1 - Dynamic'
                });
            }
        }

        // PHASE 2: MINSTOCK POST-CHECK LOGIC (like Python script)
        this.log('Starting Phase 2: MINSTOCK Post-Check Logic');
        
        // Build post-order-on-hand tracking like Python script
        const postOrderOnHand = {};
        for (const item of orderItems) {
            const pn = item.partNumber;
            postOrderOnHand[pn] = (postOrderOnHand[pn] || 0) + item.suggestedQty;
        }
        
        for (let i = 0; i < items.length; i++) {
            const row = items[i];
            const partNumber = row.PARTNUMBER || `Item_${i}`;
            const description = row.DESCRIPTION1 || row.DESCRIPTION || 'No Description';
            const currentStock = this.parseNumber(row.STOCKONHAND) || 0;
            const minStock = this.parseNumber(row.MINSTOCK) || 0;
            const minOrderQty = this.parseNumber(row.MINORDERQTY) || 1;
            const unitCost = this.parseNumber(row.UNITCOST) || 0;
            const sales = salesData[i];
            
            // Skip items with MINORDERQTY of 0
            if (this.parseNumber(row.MINORDERQTY) === 0) {
                continue;
            }
            
            // MINSTOCK logic exactly like Python script
            if (minStock >= 2) { // Only check MINSTOCK if >= 2 like Python
                const ordered = postOrderOnHand[partNumber] || 0;
                const postOrder = currentStock + ordered;
                
                if (postOrder < minStock && minOrderQty > 0) {
                    const needed = minStock - postOrder;
                    const addQty = Math.ceil(needed / minOrderQty) * minOrderQty;
                    
                    if (addQty > 0) {
                        // Check if item already exists in order
                        let found = false;
                        for (const item of orderItems) {
                            if (item.partNumber === partNumber) {
                                item.suggestedQty += addQty;
                                item.orderReason += ` + MINSTOCK adjustment (+${addQty})`;
                                found = true;
                                debug.phase2MinStockAdjustments++;
                                break;
                            }
                        }
                        
                        if (!found) {
                            // Create new order for MINSTOCK requirement
                            debug.phase2MinStockAdjustments++;
                            
                            orderItems.push({
                                partNumber,
                                description,
                                category: 'minstock-required',
                                currentStock,
                                safetyStock: 0,
                                suggestedQty: addQty,
                                cost: unitCost,
                                supplierNumber: row.SUPPLIER_NUMBER1 || row.SUPPLIERNUMBER || row.SUPPLIER_NUMBER || row.SUPPLIER || '10',
                                demandStd: 0,
                                daysThreshold,
                                forecast: 0,
                                velocity: 0,
                                forecastedNeed: 0,
                                minStock,
                                minOrderQty,
                                recentSales: sales.slice(-4).reduce((a, b) => a + b, 0),
                                avgWeeklySales: (() => {
                                    const recentSalesForAvg = sales.slice(-12);
                                    return recentSalesForAvg.length > 0 ? ss.mean(recentSalesForAvg) : 0;
                                })(),
                                totalSales104Weeks: sales.reduce((a, b) => a + b, 0),
                                stockTurnover: this.calculateStockTurnover(sales, currentStock),
                                orderReason: `Phase 2 MINSTOCK requirement (needed: ${needed}, rounded: ${addQty})`,
                                qualityIssues: 'None',
                                confidence: 0.95,
                                orderPhase: 'Phase 2 - MINSTOCK'
                            });
                        }
                    }
                }
            }
        }
        
        // Sort by SKU (Part Number) in ascending alphabetical order
        orderItems.sort((a, b) => {
            return a.partNumber.localeCompare(b.partNumber);
        });
        
        // Enhanced logging like Python script
        this.log(`Order generation complete. Phase 1: ${debug.phase1Orders} orders, Phase 2: ${debug.phase2MinStockAdjustments} MINSTOCK adjustments`);
        this.log(`Total order items: ${orderItems.length}`);
        this.log(`Overstock prevention applied: ${debug.overstockPrevention} times`);
        this.log(`Slow mover handling applied: ${debug.slowMoverHandling} times`);
        
        // Log sample forecast accuracy if available
        if (this.forecastAccuracyLog.length > 0) {
            this.log(`Forecast accuracy log (sample):`, this.forecastAccuracyLog.slice(0, 5));
        }
        
        // Log sample data quality issues if available
        if (this.dataQualityLog.length > 0) {
            this.log(`Data quality issues (sample):`, this.dataQualityLog.slice(0, 5));
        }
        
        // Log sample stock events if available
        if (this.stockEventLog.length > 0) {
            this.log(`Stock event log (sample):`, this.stockEventLog.slice(0, 5));
        }
        
        return { orderItems, debug };
    }

    analyzeOrderNeed(partNumber, currentStock, minStock, minOrderQty, forecast, safetyStock, salesHistory, category) {
        let needsOrder = false;
        let suggestedQty = 0;
        let reason = '';
        let confidence = 0;
        
        // Get on order quantity for this part
        const onOrderQty = (this.onOrderData && this.onOrderData[partNumber]) || 0;
        
        // Calculate effective stock (current stock + on order)
        const effectiveStock = currentStock + onOrderQty;
        
        // Calculate various thresholds
        const reorderPoint = Math.max(minStock, safetyStock, forecast);
        const recentSalesSum = salesHistory.slice(-4).reduce((a, b) => a + b, 0);
        const recentSalesForAvg = salesHistory.slice(-12);
        const avgWeeklySales = recentSalesForAvg.length > 0 ? ss.mean(recentSalesForAvg) : 0;
        
        // Multiple ordering criteria with confidence scoring - use effective stock
        const criteria = [];
        
        // 1. Below minimum stock level (considering what's already on order)
        if (minStock > 0 && effectiveStock < minStock) {
            criteria.push({
                trigger: true,
                qty: Math.max(minStock - effectiveStock, minOrderQty),
                reason: `Below minimum stock (${minStock}), considering ${onOrderQty} on order`,
                confidence: 0.9
            });
        }
        
        // 2. Below reorder point (considering what's already on order)
        if (effectiveStock < reorderPoint) {
            criteria.push({
                trigger: true,
                qty: Math.max(reorderPoint - effectiveStock, minOrderQty),
                reason: `Below reorder point (${Math.round(reorderPoint)}), considering ${onOrderQty} on order`,
                confidence: 0.8
            });
        }
        
        // 3. Out of stock with recent sales (only consider current stock, not on order for this case)
        if (currentStock === 0 && recentSalesSum > 0) {
            // If we have something on order, reduce the urgency but still consider additional needs
            const urgencyQty = onOrderQty > 0 ? forecast : Math.ceil(forecast * 2);
            if (effectiveStock < urgencyQty) {
                criteria.push({
                    trigger: true,
                    qty: Math.max(urgencyQty - effectiveStock, minOrderQty),
                    reason: `Out of stock with recent sales, ${onOrderQty} on order`,
                    confidence: 0.95
                });
            }
        }
        
        // 4. Low stock relative to sales velocity (considering effective stock)
        if (avgWeeklySales > 0 && effectiveStock < (avgWeeklySales * 2)) {
            criteria.push({
                trigger: true,
                qty: Math.max(Math.ceil(avgWeeklySales * 4) - effectiveStock, minOrderQty),
                reason: `Low effective stock relative to sales velocity, ${onOrderQty} on order`,
                confidence: 0.7
            });
        }
        
        // 5. Seasonal items approaching season (considering effective stock)
        if (category === 'seasonal' && this.isApproachingSeason(salesHistory)) {
            const seasonalTarget = Math.ceil(forecast * 1.5);
            if (effectiveStock < seasonalTarget) {
                criteria.push({
                    trigger: true,
                    qty: Math.max(seasonalTarget - effectiveStock, minOrderQty),
                    reason: `Seasonal item approaching peak season, ${onOrderQty} on order`,
                    confidence: 0.85
                });
            }
        }
        
        // Select the best criterion
        const validCriteria = criteria.filter(c => c.trigger);
        if (validCriteria.length > 0) {
            const bestCriterion = validCriteria.reduce((best, current) => 
                current.confidence > best.confidence ? current : best
            );
            
            needsOrder = true;
            suggestedQty = bestCriterion.qty;
            reason = bestCriterion.reason;
            confidence = bestCriterion.confidence;
            
            // Ensure minimum order quantity is respected
            suggestedQty = Math.max(suggestedQty, minOrderQty);
        }
        
        // CRITICAL: Always ensure we stock to at least MINSTOCK level if MINSTOCK > 0
        if (minStock > 0 && effectiveStock < minStock) {
            const qtyNeededForMinStock = minStock - effectiveStock;
            if (qtyNeededForMinStock > 0 && (suggestedQty < qtyNeededForMinStock || !needsOrder)) {
                needsOrder = true;
                suggestedQty = Math.max(qtyNeededForMinStock, minOrderQty);
                if (!reason) { // Only update reason if no other reason was set
                    reason = `Stock to minimum level (${minStock}), ${onOrderQty} on order`;
                    confidence = 0.9;
                }
                // If we already had a reason, append the MINSTOCK requirement
                else if (!reason.includes('minimum stock')) {
                    reason += ` + Stock to minimum level (${minStock})`;
                }
            }
        }
        
        return { needsOrder, suggestedQty, reason, confidence };
    }

    isApproachingSeason(salesHistory) {
        // Simple seasonal detection - check if recent sales are trending up
        if (salesHistory.length < 26) return false;
        
        const recent = salesHistory.slice(-8);
        const previous = salesHistory.slice(-16, -8);
        
        const recentAvg = recent.length > 0 ? ss.mean(recent) : 0;
        const previousAvg = previous.length > 0 ? ss.mean(previous) : 0;
        
        return recentAvg > previousAvg * 1.2; // 20% increase indicates seasonal upturn
    }

    calculateStockTurnover(salesHistory, currentStock) {
        if (currentStock === 0) return 0;
        
        const annualSales = salesHistory.reduce((a, b) => a + b, 0) * (52 / salesHistory.length);
        return annualSales / currentStock;
    }

    parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }
}

// Export function for compatibility
async function generateSuggestedOrder(config) {
    const analyzer = new AdvancedInventoryAnalyzer();
    return await analyzer.generateSuggestedOrder(config);
}

module.exports = { generateSuggestedOrder, AdvancedInventoryAnalyzer }; 