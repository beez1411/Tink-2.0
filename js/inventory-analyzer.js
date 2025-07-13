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
        
        // ENHANCED: Seasonal intelligence constants
        this.SEASONAL_DETECTION_THRESHOLD = 0.4; // CV threshold for seasonal classification
        this.PEAK_DETECTION_THRESHOLD = 1.5; // Multiple of mean+std for peak detection
        this.LOW_DETECTION_THRESHOLD = 0.3; // Multiple of mean for low detection
        this.PRE_SEASON_WEEKS = 6; // Weeks before peak to start stocking up
        this.POST_SEASON_WEEKS = 4; // Weeks before low to reduce stocking
        this.SEASONAL_PEAK_MULTIPLIER = 1.8; // 80% increase for pre-peak stocking
        this.SEASONAL_LOW_MULTIPLIER = 0.5; // 50% reduction for pre-low periods
        
        // Current week tracking (can be set dynamically)
        this.currentWeek = this.getCurrentWeekOfYear();

        // In the class definition, add new configurable properties
        // Around line ~60, after other constants
        this.ZERO_STOCK_VELOCITY_THRESHOLD = 0.1; // Configurable via config
        this.ENABLE_ZERO_STOCK_HANDLING = true; // Default true, configurable
        this.ZERO_STOCK_MIN_VELOCITY = 0.01; // New configurable min velocity for zero-stock
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

        // ENHANCED: Get trend analysis for better forecasting
        const trendChangeData = this.detectTrendChange(salesSeries);
        const weightedRecentTrend = this.calculateWeightedRecentTrend(salesSeries);
        const performanceDecay = this.calculatePerformanceDecay(salesSeries);

        const forecastWeeks = daysThreshold / 7;
        let forecast = 0;

        try {
            if (label === 'steady') {
                // ENHANCED: Use weighted recent trend for steady items when available
                if (weightedRecentTrend > 0 && salesSeries.length >= 26) {
                    forecast = weightedRecentTrend * forecastWeeks;
                } else {
                    // Fallback to last 26 weeks average like Python
                    const recentSales = salesSeries.slice(-26);
                    const avg = recentSales.length > 0 ? ss.mean(recentSales) : 0;
                    forecast = avg * forecastWeeks;
                }
                
            } else if (label === 'seasonal') {
                // Enhanced seasonal logic closer to Python's STL approach
                forecast = this.forecastSeasonal(salesSeries, forecastWeeks);
                
                // ENHANCED: Apply trend adjustments to seasonal forecast
                if (trendChangeData.isDecliningSharply || trendChangeData.isDeclinedFromHistorical) {
                    const trendMultiplier = Math.min(trendChangeData.trendChangeMultiplier, performanceDecay.decayFactor);
                    forecast *= trendMultiplier;
                }
                
            } else { // erratic or fallback
                // ENHANCED: Use weighted trend for erratic items when available
                if (weightedRecentTrend > 0 && salesSeries.length >= 26) {
                    forecast = weightedRecentTrend * forecastWeeks;
                } else {
                    // Use median of last 20 weeks like Python
                    const recentSales = salesSeries.slice(-20);
                    const median = recentSales.length > 0 ? ss.median(recentSales) : 0;
                    forecast = median * forecastWeeks;
                }
            }

            // ENHANCED: Apply performance decay for all forecast types when declining
            if (trendChangeData.isDecliningSharply || trendChangeData.isDeclinedFromHistorical) {
                const decayMultiplier = Math.min(trendChangeData.trendChangeMultiplier, performanceDecay.decayFactor);
                const originalForecast = forecast;
                forecast *= decayMultiplier;
                
                // Log the adjustment for debugging
                if (this.debugMode && decayMultiplier < 0.9) {
                    this.log(`Trend-adjusted forecast for ${partNumber}: ${originalForecast.toFixed(2)} → ${forecast.toFixed(2)} (${Math.round(decayMultiplier * 100)}% due to ${performanceDecay.decayReason})`);
                }
            }

            // Log forecast accuracy if we have actual data
            if (itemData.WEEK_CURRENT !== undefined) {
                this.forecastAccuracyLog.push({
                    partNumber,
                    forecast,
                    actual: itemData.WEEK_CURRENT,
                    trendAdjusted: trendChangeData.isDecliningSharply || trendChangeData.isDeclinedFromHistorical
                });
            }

        } catch (error) {
            this.log(`Forecasting error for ${partNumber}: ${error.message}`);
            
            // ENHANCED: Fallback with trend awareness
            if (weightedRecentTrend > 0) {
                forecast = weightedRecentTrend * forecastWeeks;
            } else {
                const recentSales = salesSeries.slice(-12);
                forecast = recentSales.length > 0 ? ss.mean(recentSales) * forecastWeeks : 0;
            }
            
            // Apply decay even to fallback forecasts
            if (trendChangeData.isDecliningSharply) {
                forecast *= trendChangeData.trendChangeMultiplier;
            }
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
    getSalesVelocity(salesSeries, weeks = 8, longLookback = false) {
        let lookbackSales;
        if (longLookback) {
            lookbackSales = salesSeries.slice(-26);
            if (lookbackSales.length < 26) return 0;
            const recent = lookbackSales.slice(-8).reduce((a, b) => a + b, 0) / 8;
            const earlier = lookbackSales.slice(0, 18).reduce((a, b) => a + b, 0) / 18;
            return (recent * 0.7) + (earlier * 0.3); // 70/30 weighting
        } else {
            lookbackSales = salesSeries.slice(-weeks);
            return lookbackSales.length > 0 ? ss.mean(lookbackSales) : 0;
        }
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
            const results = await this.generateOrderRecommendations(
                validItems, 
                salesData, 
                clustering.labels, 
                labelMap, 
                daysThreshold, 
                serviceLevel,
                config.paladinFile ?? null // Pass it here
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
    async generateOrderRecommendations(items, salesData, clusterLabels, labelMap, daysThreshold, serviceLevel, paladinFile) {
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
            phase2MinStockAdjustments: 0,
            // ENHANCED: Seasonal intelligence debug counters
            seasonalItemsDetected: 0,
            volatileItemsDetected: 0,
            trendingUpItems: 0,
            trendingDownItems: 0,
            seasonalPeakAdjustments: 0,
            seasonalLowAdjustments: 0,
            enhancedSafetyStockApplications: 0,
            seasonalCategoryBreakdown: {
                stable: 0,
                volatile: 0,
                seasonal: 0,
                trending: 0
            },
            zeroStockOrders: 0,
            slowMoverZeroStock: 0,
            seasonalZeroStockAdjustments: 0,
            paladinMissed: 0,
            paladinMissedExamples: []
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
        
        // PHASE 1: ENHANCED DYNAMIC ORDER LOGIC WITH SEASONAL INTELLIGENCE
        this.log('Starting Phase 1: Enhanced Dynamic Order Logic with Seasonal Intelligence');
        
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
            
            // ENHANCED: Analyze seasonal patterns for this item
            const seasonalMetrics = this.analyzeSeasonalPatterns(sales, partNumber);
            
            // ENHANCED: Track seasonal intelligence statistics
            debug.seasonalCategoryBreakdown[seasonalMetrics.demandCategory]++;
            if (seasonalMetrics.isSeasonal) debug.seasonalItemsDetected++;
            if (seasonalMetrics.salesVolatility > 1.0) debug.volatileItemsDetected++;
            if (seasonalMetrics.isTrendingUp) debug.trendingUpItems++;
            if (seasonalMetrics.isTrendingDown) debug.trendingDownItems++;
            if (seasonalMetrics.meanWeeklySales > 0) debug.enhancedSafetyStockApplications++;
            
            // Get sales velocity and forecast like Python script
            const velocity = this.getSalesVelocity(sales, 8); // 8 weeks like Python
            const forecastedNeed = velocity * (daysThreshold / 7);
            const forecast = this.forecastDemand(sales, clusterLabel, daysThreshold, row);
            if (forecast > 0) debug.itemsWithForecast++;
            
            // ENHANCED: Calculate dynamic safety stock based on seasonal patterns
            const leadTimeWeeks = daysThreshold / 7;
            const dynamicSafetyStock = this.calculateDynamicSafetyStock(seasonalMetrics, leadTimeWeeks);
            
            // Fallback to original calculation if no seasonal data
            const demandStd = this.calculateDemandStandardDeviation(sales.slice(-26));
            const originalSafetyStock = this.Z_SCORE_95 * demandStd * Math.sqrt(leadTimeWeeks);
            const safetyStock = seasonalMetrics.meanWeeklySales > 0 ? dynamicSafetyStock : originalSafetyStock;
            
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
                    // FIXED: Apply MOQ rounding (though for slow movers this usually equals minOrderQty)
                    orderQty = this.roundToMOQ(minOrderQty, minOrderQty);
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
                
            // 3. Normal velocity items with ENHANCED seasonal intelligence
            } else {
                // ENHANCED: Apply seasonal order quantity calculation
                const seasonalOrder = this.calculateSeasonalOrderQuantity(
                    seasonalMetrics, 
                    currentStock, 
                    safetyStock, 
                    daysThreshold / 7
                );
                
                const shortage = forecastedNeed + safetyStock - currentStock;
                if (shortage > 0 && minOrderQty > 0) {
                    // Use the higher of: traditional calculation or seasonal-enhanced calculation
                    const traditionalQty = Math.ceil(shortage / minOrderQty) * minOrderQty;
                    const rawOrderQty = Math.max(traditionalQty, seasonalOrder.orderQuantity);
                    // FIXED: Always apply MOQ rounding to final quantity
                    orderQty = this.roundToMOQ(rawOrderQty, minOrderQty);
                    
                    if (seasonalOrder.orderQuantity > traditionalQty) {
                        orderReason = `Enhanced seasonal order: ${seasonalOrder.adjustmentReason} (base: ${traditionalQty}, enhanced: ${seasonalOrder.orderQuantity}, MOQ rounded: ${orderQty})`;
                        
                        // ENHANCED: Track seasonal adjustment types
                        if (seasonalOrder.adjustmentReason.includes('Pre-seasonal peak')) {
                            debug.seasonalPeakAdjustments++;
                        } else if (seasonalOrder.adjustmentReason.includes('Seasonal low')) {
                            debug.seasonalLowAdjustments++;
                        }
                    } else {
                        orderReason = `Dynamic forecast-based order (shortage: ${Math.round(shortage)}, MOQ rounded: ${orderQty})`;
                    }
                    
                    if (currentStock < safetyStock) {
                        this.stockEventLog.push({
                            partNumber,
                            event: 'Stockout risk',
                            currentStock,
                            safetyStock: safetyStock,
                            seasonalCategory: seasonalMetrics.demandCategory
                        });
                    }
                } else {
                    orderQty = 0;
                }
            }
            
            // Add to order items if quantity > 0
            if (orderQty > 0) {
                debug.phase1Orders++;
                
                // ENHANCED: Calculate enhanced min/max levels
                const enhancedLevels = this.calculateEnhancedMinMaxLevels(seasonalMetrics, safetyStock);
                
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
                    orderPhase: 'Phase 1 - Dynamic',
                    // ENHANCED: Seasonal intelligence data
                    seasonalCategory: seasonalMetrics.demandCategory,
                    salesVolatility: Math.round(seasonalMetrics.salesVolatility * 100) / 100,
                    isSeasonal: seasonalMetrics.isSeasonal,
                    seasonalPeaks: seasonalMetrics.seasonalPeaks.length,
                    seasonalLows: seasonalMetrics.seasonalLows.length,
                    trendDirection: seasonalMetrics.isTrendingUp ? 'UP' : 
                                   seasonalMetrics.isTrendingDown ? 'DOWN' : 'STABLE',
                    enhancedMinStock: enhancedLevels.enhancedMin,
                    enhancedMaxStock: enhancedLevels.enhancedMax,
                    dynamicSafetyStock: Math.round(dynamicSafetyStock),
                    currentWeek: this.currentWeek,
                    // ENHANCED: Recent trend analysis data
                    weightedRecentTrend: Math.round(seasonalMetrics.weightedRecentTrend * 100) / 100,
                    isDecliningSharply: seasonalMetrics.trendChangeData.isDecliningSharply,
                    isDeclinedFromHistorical: seasonalMetrics.trendChangeData.isDeclinedFromHistorical,
                    recentPerformanceRatio: Math.round(seasonalMetrics.trendChangeData.recentPerformanceRatio * 100) / 100,
                    performanceDecayFactor: Math.round(seasonalMetrics.performanceDecay.decayFactor * 100) / 100,
                    decayReason: seasonalMetrics.performanceDecay.decayReason,
                    trendChangeMultiplier: Math.round(seasonalMetrics.trendChangeData.trendChangeMultiplier * 100) / 100,
                    recommendedMultiplier: Math.round(seasonalMetrics.recommendedMultiplier * 100) / 100
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
                                // FIXED: Apply MOQ rounding to the total after adding
                                const newTotal = item.suggestedQty + addQty;
                                item.suggestedQty = this.roundToMOQ(newTotal, minOrderQty);
                                item.orderReason += ` + MINSTOCK adjustment (total rounded to MOQ)`;
                                found = true;
                                debug.phase2MinStockAdjustments++;
                                break;
                            }
                        }
                        
                        if (!found) {
                            // Create new order for MINSTOCK requirement with seasonal analysis
                            debug.phase2MinStockAdjustments++;
                            
                            // ENHANCED: Analyze seasonal patterns for Phase 2 items too
                            const seasonalMetrics = this.analyzeSeasonalPatterns(sales, partNumber);
                            const enhancedLevels = this.calculateEnhancedMinMaxLevels(seasonalMetrics, addQty);
                            
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
                                orderPhase: 'Phase 2 - MINSTOCK',
                                // ENHANCED: Include seasonal data for Phase 2 items
                                seasonalCategory: seasonalMetrics.demandCategory,
                                salesVolatility: Math.round(seasonalMetrics.salesVolatility * 100) / 100,
                                isSeasonal: seasonalMetrics.isSeasonal,
                                seasonalPeaks: seasonalMetrics.seasonalPeaks.length,
                                seasonalLows: seasonalMetrics.seasonalLows.length,
                                trendDirection: seasonalMetrics.isTrendingUp ? 'UP' : 
                                               seasonalMetrics.isTrendingDown ? 'DOWN' : 'STABLE',
                                enhancedMinStock: enhancedLevels.enhancedMin,
                                enhancedMaxStock: enhancedLevels.enhancedMax,
                                dynamicSafetyStock: addQty,
                                currentWeek: this.currentWeek
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
        
        debug.itemsNeedingOrder = orderItems.length;
        
        // ENHANCED: Log seasonal intelligence results
        this.log(`=== SEASONAL INTELLIGENCE SUMMARY ===`);
        this.log(`Seasonal items detected: ${debug.seasonalItemsDetected}`);
        this.log(`High-volatility items: ${debug.volatileItemsDetected}`);
        this.log(`Trending up items: ${debug.trendingUpItems}`);
        this.log(`Trending down items: ${debug.trendingDownItems}`);
        this.log(`Pre-peak adjustments applied: ${debug.seasonalPeakAdjustments}`);
        this.log(`Pre-low adjustments applied: ${debug.seasonalLowAdjustments}`);
        this.log(`Enhanced safety stock applications: ${debug.enhancedSafetyStockApplications}`);
        this.log(`Category breakdown:`, debug.seasonalCategoryBreakdown);
        
        // ENHANCED: Recent trend weighting summary
        const decliners = orderItems.filter(item => item.seasonalCategory === 'declining');
        const sharpDecliners = orderItems.filter(item => item.isDecliningSharply);
        const historicalDecliners = orderItems.filter(item => item.isDeclinedFromHistorical);
        const trendAdjusted = orderItems.filter(item => item.recommendedMultiplier < 0.95);
        
        this.log(`=== RECENT TREND WEIGHTING SUMMARY ===`);
        this.log(`Items categorized as declining: ${decliners.length}`);
        this.log(`Items with sharp recent decline: ${sharpDecliners.length}`);
        this.log(`Items declined from historical highs: ${historicalDecliners.length}`);
        this.log(`Items with trend adjustments (<95%): ${trendAdjusted.length}`);
        
        if (decliners.length > 0) {
            this.log(`Sample declining items:`, decliners.slice(0, 3).map(item => ({
                partNumber: item.partNumber,
                category: item.seasonalCategory,
                recentRatio: item.recentPerformanceRatio,
                decayFactor: item.performanceDecayFactor,
                decayReason: item.decayReason,
                finalMultiplier: item.recommendedMultiplier
            })));
        }
        
        // At end of generateOrderRecommendations, after sorting, add Paladin comparison
        if (paladinFile) {
            // Simple parse (assume TSV, load and compare partNumbers)
            const paladinData = await this.loadData(paladinFile); // Reuse loadData
            const paladinParts = new Set(paladinData.map(row => row['Part number']));
            const tinkParts = new Set(orderItems.map(item => item.partNumber));
            const missed = [...paladinParts].filter(p => !tinkParts.has(p));
            debug.paladinMissed = missed.length;
            debug.paladinMissedExamples = missed.slice(0, 10); // First 10 for sample
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
                qty: this.roundToMOQ(minStock - effectiveStock, minOrderQty),
                reason: `Below minimum stock (${minStock}), considering ${onOrderQty} on order`,
                confidence: 0.9
            });
        }
        
        // 2. Below reorder point (considering what's already on order)
        if (effectiveStock < reorderPoint) {
            criteria.push({
                trigger: true,
                qty: this.roundToMOQ(reorderPoint - effectiveStock, minOrderQty),
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
                    qty: this.roundToMOQ(urgencyQty - effectiveStock, minOrderQty),
                    reason: `Out of stock with recent sales, ${onOrderQty} on order`,
                    confidence: 0.95
                });
            }
        }
        
        // 4. Low stock relative to sales velocity (considering effective stock)
        if (avgWeeklySales > 0 && effectiveStock < (avgWeeklySales * 2)) {
            criteria.push({
                trigger: true,
                qty: this.roundToMOQ(Math.ceil(avgWeeklySales * 4) - effectiveStock, minOrderQty),
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
                    qty: this.roundToMOQ(seasonalTarget - effectiveStock, minOrderQty),
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
            
            // FIXED: Round to nearest multiple of MOQ instead of just ensuring minimum
            suggestedQty = this.roundToMOQ(suggestedQty, minOrderQty);
        }
        
        // CRITICAL: Always ensure we stock to at least MINSTOCK level if MINSTOCK > 0
        if (minStock > 0 && effectiveStock < minStock) {
            const qtyNeededForMinStock = minStock - effectiveStock;
            if (qtyNeededForMinStock > 0 && (suggestedQty < qtyNeededForMinStock || !needsOrder)) {
                needsOrder = true;
                // FIXED: Round to MOQ instead of just ensuring minimum
                suggestedQty = this.roundToMOQ(qtyNeededForMinStock, minOrderQty);
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

    // ENHANCED: Get current week of year for seasonal timing
    getCurrentWeekOfYear() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
        const oneWeek = 1000 * 60 * 60 * 24 * 7;
        return Math.floor(diff / oneWeek) + 1;
    }

    // ENHANCED: Advanced seasonal pattern analysis with recent trend weighting
    analyzeSeasonalPatterns(weeklySales, itemId) {
        const sales = Array.isArray(weeklySales) ? weeklySales : [];
        
        if (sales.length < 26) {  // Need at least 26 weeks for meaningful analysis
            return {
                meanWeeklySales: 0,
                salesVolatility: 0,
                seasonalPeaks: [],
                seasonalLows: [],
                trendSlope: 0,
                wowVolatility: 0,
                isSeasonal: false,
                isTrendingUp: false,
                isTrendingDown: false,
                demandCategory: 'stable',
                // ENHANCED: New trend analysis fields
                weightedRecentTrend: 0,
                trendChangeData: {},
                performanceDecay: {},
                recommendedMultiplier: 1.0
            };
        }

        // ENHANCED: Get weighted recent trend and performance decay analysis
        const weightedRecentTrend = this.calculateWeightedRecentTrend(sales);
        const trendChangeData = this.detectTrendChange(sales);
        const performanceDecay = this.calculatePerformanceDecay(sales);

        // Basic statistical measures (now using weighted trend for better accuracy)
        const nonZeroSales = sales.filter(x => x > 0);
        const meanSales = nonZeroSales.length > 0 ? ss.mean(nonZeroSales) : 0;
        const stdSales = sales.length > 1 ? ss.standardDeviation(sales) : 0;
        const cv = meanSales > 0 ? stdSales / meanSales : 0;

        // Rolling average for smoother trend detection (4-week window)
        const windowSize = 4;
        const rollingAvg = [];
        
        if (sales.length >= windowSize) {
            for (let i = windowSize - 1; i < sales.length; i++) {
                const window = sales.slice(i - windowSize + 1, i + 1);
                rollingAvg.push(ss.mean(window));
            }
        } else {
            rollingAvg.push(...sales);
        }

        // Peak and low detection using statistical thresholds
        const seasonalPeaks = [];
        const seasonalLows = [];
        
        const peakThreshold = meanSales * this.PEAK_DETECTION_THRESHOLD;
        const lowThreshold = meanSales * this.LOW_DETECTION_THRESHOLD;
        
        for (let i = 1; i < rollingAvg.length - 1; i++) {
            const weekNum = i + Math.floor(windowSize / 2);
            
            // Peak detection: local maximum above threshold
            if (rollingAvg[i] > rollingAvg[i-1] && 
                rollingAvg[i] > rollingAvg[i+1] && 
                rollingAvg[i] > peakThreshold) {
                seasonalPeaks.push(weekNum);
            }
            
            // Low detection: local minimum below threshold (but > 0)
            if (rollingAvg[i] < rollingAvg[i-1] && 
                rollingAvg[i] < rollingAvg[i+1] && 
                rollingAvg[i] < lowThreshold && 
                rollingAvg[i] > 0) {
                seasonalLows.push(weekNum);
            }
        }

        // ENHANCED: Trend analysis using weighted recent data
        const recentSales = sales.slice(-12);
        let trendSlope = 0;
        
        if (recentSales.length > 1) {
            try {
                const x = Array.from({length: recentSales.length}, (_, i) => i);
                const regression = ss.linearRegression(x.map((xi, i) => [xi, recentSales[i]]));
                trendSlope = regression.m || 0;
            } catch (error) {
                trendSlope = 0;
            }
        }

        // Week-over-week volatility calculation
        const wowChanges = [];
        for (let i = 1; i < sales.length; i++) {
            if (sales[i-1] > 0) {
                const change = Math.abs(sales[i] - sales[i-1]) / sales[i-1];
                wowChanges.push(change);
            }
        }
        const wowVolatility = wowChanges.length > 0 ? ss.mean(wowChanges) : 0;

        // ENHANCED: Classification logic with trend change awareness
        const isSeasonal = seasonalPeaks.length >= 2 && cv > this.SEASONAL_DETECTION_THRESHOLD;
        const isTrendingUp = trendSlope > meanSales * 0.05; // 5% of mean per week
        const isTrendingDown = trendSlope < -meanSales * 0.05 || trendChangeData.isDecliningSharply;

        // ENHANCED: Demand category classification with decline detection
        let demandCategory = 'stable';
        if (trendChangeData.isDecliningSharply || trendChangeData.isDeclinedFromHistorical) {
            demandCategory = 'declining';
        } else if (isSeasonal) {
            demandCategory = 'seasonal';
        } else if (cv > 1.0) {
            demandCategory = 'volatile';
        } else if (isTrendingUp || isTrendingDown) {
            demandCategory = 'trending';
        }

        // ENHANCED: Calculate overall recommended multiplier
        const recommendedMultiplier = Math.min(
            trendChangeData.trendChangeMultiplier,
            performanceDecay.decayFactor
        );

        return {
            meanWeeklySales: meanSales,
            salesVolatility: cv,
            seasonalPeaks,
            seasonalLows,
            trendSlope,
            wowVolatility,
            isSeasonal,
            isTrendingUp,
            isTrendingDown,
            demandCategory,
            // ENHANCED: New trend analysis fields
            weightedRecentTrend,
            trendChangeData,
            performanceDecay,
            recommendedMultiplier
        };
    }

    // ENHANCED: Dynamic safety stock calculation with recent trend weighting
    calculateDynamicSafetyStock(seasonalMetrics, leadTimeWeeks = 2) {
        const meanSales = seasonalMetrics.meanWeeklySales;
        const volatility = seasonalMetrics.salesVolatility;
        const wowVolatility = seasonalMetrics.wowVolatility;
        
        // ENHANCED: Use weighted recent trend if available
        const effectiveMeanSales = seasonalMetrics.weightedRecentTrend > 0 ? 
            seasonalMetrics.weightedRecentTrend : meanSales;
        
        if (effectiveMeanSales === 0) {
            return 1; // Minimum safety stock
        }

        // Base safety stock (lead time demand using recent trend)
        const baseSafetyStock = effectiveMeanSales * leadTimeWeeks;

        // Volatility adjustment multiplier
        // Higher volatility requires more safety stock
        const volatilityMultiplier = 1 + (volatility * 0.4) + (wowVolatility * 0.2);

        // Seasonal adjustment
        let seasonalMultiplier = 1.0;
        if (seasonalMetrics.isSeasonal) {
            // More peaks = more variability = more safety stock needed
            const peakFactor = seasonalMetrics.seasonalPeaks.length * 0.15;
            seasonalMultiplier = 1.2 + peakFactor;
        }

        // ENHANCED: Trend adjustment with decline detection
        let trendMultiplier = 1.0;
        if (seasonalMetrics.demandCategory === 'declining') {
            // Strong reduction for declining items
            trendMultiplier = seasonalMetrics.recommendedMultiplier * 0.8;
        } else if (seasonalMetrics.isTrendingUp) {
            trendMultiplier = 1.4; // Stock more for growing demand
        } else if (seasonalMetrics.isTrendingDown) {
            trendMultiplier = 0.7; // Stock less for declining demand
        }

        // ENHANCED: Service level adjustment with decline category
        const serviceLevelMultiplier = {
            'stable': 1.0,
            'volatile': 1.3,
            'seasonal': 1.2,
            'trending': 1.1,
            'declining': 0.8  // ENHANCED: Reduced safety stock for declining items
        }[seasonalMetrics.demandCategory] || 1.0;

        // Calculate final dynamic safety stock
        const dynamicSafetyStock = baseSafetyStock * 
                                  volatilityMultiplier * 
                                  seasonalMultiplier * 
                                  trendMultiplier * 
                                  serviceLevelMultiplier;

        return Math.max(1, Math.round(dynamicSafetyStock));
    }

    // ENHANCED: Seasonal order quantity calculation with recent trend weighting
    calculateSeasonalOrderQuantity(seasonalMetrics, currentStock, safetyStock, forecastWeeks = 4) {
        // ENHANCED: Use weighted recent trend for more accurate forecasting
        const effectiveMeanSales = seasonalMetrics.weightedRecentTrend > 0 ? 
            seasonalMetrics.weightedRecentTrend : seasonalMetrics.meanWeeklySales;
        
        // Base order calculation using recent weighted trend
        const baseOrderQty = Math.max(0, (forecastWeeks * effectiveMeanSales + safetyStock) - currentStock);
        
        // Seasonal timing adjustments
        let seasonalAdjustment = 1.0;
        let adjustmentReason = "Standard order";
        
        if (seasonalMetrics.isSeasonal) {
            // Check if approaching seasonal peak (within 6 weeks)
            const approachingPeak = seasonalMetrics.seasonalPeaks.some(peakWeek => {
                const weekDiff = (peakWeek - this.currentWeek + 52) % 52;
                return weekDiff > 0 && weekDiff <= this.PRE_SEASON_WEEKS;
            });
            
            // Check if approaching seasonal low (within 4 weeks)
            const approachingLow = seasonalMetrics.seasonalLows.some(lowWeek => {
                const weekDiff = (lowWeek - this.currentWeek + 52) % 52;
                return weekDiff > 0 && weekDiff <= this.POST_SEASON_WEEKS;
            });
            
            if (approachingPeak) {
                seasonalAdjustment = 1.2;
                adjustmentReason = "Pre-seasonal peak stocking (+20%)";
            } else if (approachingLow) {
                seasonalAdjustment = this.SEASONAL_LOW_MULTIPLIER;
                adjustmentReason = "Seasonal low adjustment";
            }
        }
        
        // ENHANCED: Trend adjustments with decline detection
        let trendAdjustment = 1.0;
        if (seasonalMetrics.demandCategory === 'declining') {
            // Apply the recommended multiplier for declining items
            trendAdjustment = seasonalMetrics.recommendedMultiplier;
            
            if (seasonalMetrics.trendChangeData.isDecliningSharply) {
                adjustmentReason = `Sharp decline detected (${Math.round(seasonalMetrics.trendChangeData.recentPerformanceRatio * 100)}% of previous period)`;
            } else if (seasonalMetrics.trendChangeData.isDeclinedFromHistorical) {
                adjustmentReason = `Historical decline detected (${seasonalMetrics.performanceDecay.decayReason})`;
            } else {
                adjustmentReason = "Performance decline adjustment";
            }
        } else if (seasonalMetrics.isTrendingUp) {
            trendAdjustment = 1.3;
            adjustmentReason += " + upward trend";
        } else if (seasonalMetrics.isTrendingDown) {
            trendAdjustment = 0.8;
            adjustmentReason += " + downward trend";
        }
        
        // Final order quantity with floor for declining/slow movers
        const finalOrderQty = baseOrderQty * seasonalAdjustment * trendAdjustment;
        let orderQuantity = Math.max(0, Math.round(finalOrderQty));
        
        // Recommendation 2 & 3: Floor for declining/slow movers if stock low
        if ((seasonalMetrics.demandCategory === 'declining' || effectiveMeanSales < 0.5) && currentStock < 2) {
            orderQuantity = Math.max(1, orderQuantity);
            adjustmentReason += ' (min 1 due to low stock declining/slow mover)';
        }
        
        return {
            orderQuantity,
            adjustmentReason,
            seasonalAdjustment,
            trendAdjustment,
            effectiveMeanSales,
            baseOrderQty,
            declineMultiplier: seasonalMetrics.recommendedMultiplier
        };
    }

    // ENHANCED: Calculate enhanced min/max stock levels
    calculateEnhancedMinMaxLevels(seasonalMetrics, safetyStock) {
        const meanSales = seasonalMetrics.meanWeeklySales;
        
        // Enhanced minimum stock level = dynamic safety stock
        const enhancedMin = safetyStock;
        
        // Enhanced maximum stock level calculation
        let baseMaxWeeks = 6; // Base 6-week supply
        
        // Adjust based on seasonality
        if (seasonalMetrics.isSeasonal) {
            // Higher max for seasonal items to handle peaks
            const seasonalFactor = 1 + (seasonalMetrics.seasonalPeaks.length * 0.3);
            baseMaxWeeks *= seasonalFactor;
        }
        
        // Volatility adjustment for max stock
        if (seasonalMetrics.salesVolatility > 1.0) {
            baseMaxWeeks *= 1.2; // 20% more for high volatility items
        }
        
        const enhancedMax = enhancedMin + (meanSales * baseMaxWeeks);
        
        return {
            enhancedMin: Math.round(enhancedMin),
            enhancedMax: Math.round(enhancedMax)
        };
    }

    // ENHANCED: Round quantity to nearest multiple of MOQ
    roundToMOQ(quantity, minOrderQty) {
        if (!minOrderQty || minOrderQty <= 1) {
            return quantity;
        }
        
        // If quantity is already 0 or less, return 0
        if (quantity <= 0) {
            return 0;
        }
        
        // Round up to the nearest multiple of MOQ
        return Math.ceil(quantity / minOrderQty) * minOrderQty;
    }

    // ENHANCED: Weighted average forecasting that prioritizes recent data
    calculateWeightedRecentTrend(sales, alpha = 0.3) {
        if (!sales || sales.length === 0) return 0;
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        // Use exponential smoothing with higher weight for recent weeks
        const lookbackWeeks = Math.min(26, sales.length);
        for (let i = 0; i < lookbackWeeks; i++) {
            const weight = Math.pow(1 - alpha, i); // Higher weight for recent data
            const saleValue = sales[sales.length - 1 - i];
            weightedSum += saleValue * weight;
            totalWeight += weight;
        }
        
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    // ENHANCED: Detect trend changes and declining performance
    detectTrendChange(sales) {
        if (!sales || sales.length < 24) {
            return {
                isDecliningSharply: false,
                isDeclinedFromHistorical: false,
                trendChangeMultiplier: 1.0,
                recentPerformanceRatio: 1.0
            };
        }

        const recent12Weeks = sales.slice(-12);
        const previous12Weeks = sales.slice(-24, -12);
        const recentAvg = recent12Weeks.length > 0 ? ss.mean(recent12Weeks) : 0;
        const previousAvg = previous12Weeks.length > 0 ? ss.mean(previous12Weeks) : 0;
        
        // Compare to historical performance if we have enough data
        let historicalAvg = 0;
        let isDeclinedFromHistorical = false;
        
        if (sales.length >= 104) {
            const historical52Weeks = sales.slice(-104, -52);
            historicalAvg = historical52Weeks.length > 0 ? ss.mean(historical52Weeks) : 0;
            isDeclinedFromHistorical = historicalAvg > 0 && recentAvg < historicalAvg * 0.6; // 40% down from 2-year history
        }
        
        // Detect sharp recent decline
        const isDecliningSharply = previousAvg > 0 && recentAvg < previousAvg * 0.5; // <0.5 for strong
        
        // Calculate trend change multiplier
        let trendChangeMultiplier = 1.0;
        if (isDecliningSharply && isDeclinedFromHistorical) {
            trendChangeMultiplier = 0.7; // Adjusted for strong sustained
        } else if (isDecliningSharply) {
            trendChangeMultiplier = 0.7; // Strong recent
        } else if (isDeclinedFromHistorical) {
            trendChangeMultiplier = 0.85; // Moderate historical
        } else if (recentAvg > previousAvg * 1.2) { // Trending up
            trendChangeMultiplier = 1.15; // 15% uplift
        }
        
        // Calculate recent performance ratio for additional context
        const recentPerformanceRatio = previousAvg > 0 ? recentAvg / previousAvg : 1.0;
        
        return {
            isDecliningSharply,
            isDeclinedFromHistorical,
            trendChangeMultiplier,
            recentPerformanceRatio
        };
    }

    // ENHANCED: Calculate performance decay factor for sustained decline
    calculatePerformanceDecay(sales) {
        if (!sales || sales.length < 52) {
            return {
                decayFactor: 1.0,
                decayReason: 'Insufficient data for decay analysis'
            };
        }

        const last26Weeks = sales.slice(-26);
        const weeks27to52 = sales.slice(-52, -26);
        
        const recentAvg = last26Weeks.length > 0 ? ss.mean(last26Weeks) : 0;
        const year1Avg = weeks27to52.length > 0 ? ss.mean(weeks27to52) : 0;
        
        let decayFactor = 1.0;
        let decayReason = 'No significant decay detected';
        
        if (year1Avg > 0) {
            const decay1 = recentAvg / year1Avg;
            
            // Check longer history if available
            if (sales.length >= 104) {
                const weeks53to78 = sales.slice(-78, -52);
                const weeks79to104 = sales.slice(-104, -78);
                const year2FirstHalf = weeks53to78.length > 0 ? ss.mean(weeks53to78) : 0;
                const year2SecondHalf = weeks79to104.length > 0 ? ss.mean(weeks79to104) : 0;
                
                const year2Avg = (year2FirstHalf + year2SecondHalf) / 2;
                const decay2 = year2Avg > 0 ? recentAvg / year2Avg : 1;
                
                // Strong decay if consistently declining
                if (decay1 < 0.8 && decay2 < 0.6) {
                    decayFactor = 0.5;
                    decayReason = 'Strong sustained decline over 2 years';
                } else if (decay1 < 0.9 && decay2 < 0.8) {
                    decayFactor = 0.7;
                    decayReason = 'Moderate sustained decline';
                }
            } else if (decay1 < 0.8) {
                decayFactor = 0.75;
                decayReason = 'Recent decline from year-ago performance';
            }
        }
        
        return { decayFactor, decayReason };
    }
}

// Export function for compatibility
async function generateSuggestedOrder(config) {
    const analyzer = new AdvancedInventoryAnalyzer();
    return await analyzer.generateSuggestedOrder(config);
}

module.exports = { generateSuggestedOrder, AdvancedInventoryAnalyzer }; 