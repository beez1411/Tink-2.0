const Papa = require('papaparse');
const ss = require('simple-statistics');
const { kmeans } = require('ml-kmeans');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;

class AdvancedInventoryAnalyzer {
    constructor() {
        this.data = null;
        this.debugMode = true;
        this.Z_SCORE = 1.65; // 95% service level
        this.SEASONAL_THRESHOLD = 0.3; // Threshold for seasonal pattern detection
        this.ERRATIC_THRESHOLD = 2.0; // Threshold for erratic pattern detection
    }

    log(message, data = null) {
        if (this.debugMode) {
            console.error(`[ADVANCED INVENTORY ANALYZER] ${message}`);
            if (data) console.error(data);
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

    // Enhanced feature engineering with more sophisticated metrics
    featureEngineering(salesMatrix) {
        const features = [];
        
        for (let i = 0; i < salesMatrix.length; i++) {
            const series = salesMatrix[i];
            
            // Basic statistics with safety checks
            let mean, variance, std;
            try {
                if (series.length === 0) {
                    mean = variance = std = 0;
                } else {
                    mean = ss.mean(series);
                    variance = series.length <= 1 ? 0 : ss.variance(series);
                    std = Math.sqrt(variance);
                }
            } catch (error) {
                mean = variance = std = 0;
            }
            
            // Peak to mean ratio
            const peak = Math.max(...series);
            const peakToMean = mean === 0 ? 0 : peak / mean;
            
            // Autocorrelation (lag-1)
            const autocorr = this.calculateAutocorrelation(series);
            
            // Coefficient of variation
            const coeffVar = mean === 0 ? 0 : std / mean;
            
            // Zero sales weeks
            const zeroWeeks = series.filter(val => val === 0).length;
            
            // Trend slope
            const slope = this.calculateTrendSlope(series);
            
            // Seasonality detection (simplified STL-like approach)
            const seasonality = this.detectSeasonality(series);
            
            // Sales velocity (recent vs historical)
            const recentVelocity = this.calculateVelocityChange(series);
            
            features.push([
                variance,
                peakToMean,
                autocorr,
                coeffVar,
                zeroWeeks,
                slope,
                seasonality,
                recentVelocity
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

    // Sophisticated cluster label assignment
    assignClusterLabels(centers) {
        if (!centers || centers.length === 0) {
            return { 0: 'steady' };
        }

        const metrics = centers.map((center, idx) => ({
            idx,
            variance: center[0] || 0,
            peakToMean: center[1] || 0,
            autocorr: center[2] || 0,
            coeffVar: center[3] || 0,
            zeroWeeks: center[4] || 0,
            slope: center[5] || 0,
            seasonality: center[6] || 0,
            velocity: center[7] || 0
        }));

        const labelMap = {};
        
        // Assign labels based on multiple criteria
        for (const metric of metrics) {
            let score = {
                steady: 0,
                seasonal: 0,
                erratic: 0
            };
            
            // Steady: low variance, low coefficient of variation, consistent sales
            if (metric.variance < ss.mean(metrics.map(m => m.variance))) score.steady += 2;
            if (metric.coeffVar < 0.5) score.steady += 2;
            if (metric.autocorr > 0.3) score.steady += 1;
            if (metric.zeroWeeks < 10) score.steady += 1;
            
            // Seasonal: high seasonality correlation, moderate variance
            if (Math.abs(metric.seasonality) > this.SEASONAL_THRESHOLD) score.seasonal += 3;
            if (metric.autocorr > 0.5) score.seasonal += 2;
            if (metric.variance > ss.mean(metrics.map(m => m.variance)) * 0.5) score.seasonal += 1;
            
            // Erratic: high variance, high peak-to-mean, low autocorrelation
            if (metric.peakToMean > this.ERRATIC_THRESHOLD) score.erratic += 3;
            if (metric.coeffVar > 1.0) score.erratic += 2;
            if (metric.autocorr < 0.2) score.erratic += 2;
            if (metric.zeroWeeks > 20) score.erratic += 1;
            
            // Assign label based on highest score
            const maxScore = Math.max(score.steady, score.seasonal, score.erratic);
            if (maxScore === 0) {
                labelMap[metric.idx] = 'steady'; // Default
            } else if (score.seasonal === maxScore) {
                labelMap[metric.idx] = 'seasonal';
            } else if (score.erratic === maxScore) {
                labelMap[metric.idx] = 'erratic';
            } else {
                labelMap[metric.idx] = 'steady';
            }
        }
        
        return labelMap;
    }

    // Advanced demand forecasting with multiple methods
    forecastDemand(salesSeries, label, daysThreshold, itemData = {}) {
        if (!salesSeries || salesSeries.length === 0) return 0;
        
        const totalSales = salesSeries.reduce((a, b) => a + b, 0);
        if (totalSales === 0) return 0;
        
        const availableWeeks = salesSeries.length;
        const forecastWeeks = daysThreshold / 7;
        
        let forecast = 0;
        
        switch (label) {
            case 'steady':
                forecast = this.forecastSteady(salesSeries, forecastWeeks);
                break;
            case 'seasonal':
                forecast = this.forecastSeasonal(salesSeries, forecastWeeks, itemData);
                break;
            case 'erratic':
                forecast = this.forecastErratic(salesSeries, forecastWeeks);
                break;
            default:
                forecast = this.forecastSteady(salesSeries, forecastWeeks);
        }
        
        return Math.max(0, forecast);
    }

    forecastSteady(salesSeries, forecastWeeks) {
        // Use exponential smoothing for steady items
        const alpha = 0.3; // Smoothing parameter
        const lookback = Math.min(26, salesSeries.length);
        const recentSales = salesSeries.slice(-lookback);
        
        let smoothed = recentSales[0] || 0;
        for (let i = 1; i < recentSales.length; i++) {
            smoothed = alpha * recentSales[i] + (1 - alpha) * smoothed;
        }
        
        return smoothed * forecastWeeks;
    }

    forecastSeasonal(salesSeries, forecastWeeks, itemData = {}) {
        // Enhanced seasonal forecasting
        if (salesSeries.length >= 104) {
            // Two years of data - use year-over-year comparison
            const currentPeriod = Math.floor((new Date().getTime() - new Date().getTimezoneOffset() * 60000) / (7 * 24 * 60 * 60 * 1000)) % 52;
            const lastYearSame = salesSeries[salesSeries.length - 52 + currentPeriod] || 0;
            const twoYearsAgoSame = salesSeries[salesSeries.length - 104 + currentPeriod] || 0;
            
            // Weighted average with trend adjustment
            const trend = this.calculateTrendSlope(salesSeries.slice(-26));
            const seasonalBase = (lastYearSame * 0.7 + twoYearsAgoSame * 0.3);
            const trendAdjusted = seasonalBase + (trend * forecastWeeks);
            
            return Math.max(0, trendAdjusted * forecastWeeks);
        } else if (salesSeries.length >= 52) {
            // One year of data
            const currentPeriod = Math.floor((new Date().getTime() - new Date().getTimezoneOffset() * 60000) / (7 * 24 * 60 * 60 * 1000)) % 52;
            const lastYearSame = salesSeries[salesSeries.length - 52 + currentPeriod] || 0;
            const recentSales = salesSeries.slice(-13);
            const recentAvg = recentSales.length > 0 ? ss.mean(recentSales) : 0;
            
            return Math.max(lastYearSame, recentAvg) * forecastWeeks;
        } else {
            // Fallback to recent average
            const recentSales = salesSeries.slice(-Math.min(13, salesSeries.length));
            const recentAvg = recentSales.length > 0 ? ss.mean(recentSales) : 0;
            return recentAvg * forecastWeeks;
        }
    }

    forecastErratic(salesSeries, forecastWeeks) {
        // Use robust statistics for erratic items
        const lookback = Math.min(20, salesSeries.length);
        const recentSales = salesSeries.slice(-lookback);
        
        // Use median and interquartile range for robustness
        let median;
        try {
            if (recentSales.length === 0) {
                median = 0;
            } else {
                median = ss.median(recentSales);
            }
        } catch (error) {
            // Fallback to simple average if median calculation fails
            const sum = recentSales.reduce((a, b) => a + b, 0);
            median = recentSales.length > 0 ? sum / recentSales.length : 0;
        }
        let q75, q25;
        
        try {
            if (recentSales.length === 0) {
                q75 = q25 = 0;
            } else if (recentSales.length === 1) {
                // Handle single data point case
                q75 = q25 = recentSales[0];
            } else {
                q75 = ss.quantile(recentSales, 0.75);
                q25 = ss.quantile(recentSales, 0.25);
            }
        } catch (error) {
            // Fallback to simple average if quantile calculation fails
            const sum = recentSales.reduce((a, b) => a + b, 0);
            const avg = recentSales.length > 0 ? sum / recentSales.length : 0;
            q75 = q25 = avg;
        }
        
        // Conservative forecast using median with some upward adjustment for active items
        const forecast = median + (q75 - q25) * 0.25;
        
        return forecast * forecastWeeks;
    }

    // Calculate safety stock using advanced statistical methods
    calculateSafetyStock(salesSeries, daysThreshold, serviceLevel = 0.95) {
        if (!salesSeries || salesSeries.length < 4) return 0;
        
        const leadTimeWeeks = daysThreshold / 7;
        const lookback = Math.min(26, salesSeries.length);
        const recentSales = salesSeries.slice(-lookback);
        
        // Calculate demand variability
        let demandStd;
        try {
            if (recentSales.length <= 1) {
                demandStd = 0;
            } else {
                demandStd = ss.standardDeviation(recentSales);
            }
        } catch (error) {
            demandStd = 0;
        }
        
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

    // Enhanced data quality checks
    performDataQualityChecks(row, salesSeries, partNumber) {
        const issues = [];
        
        // Check for negative sales
        if (salesSeries.some(val => val < 0)) {
            issues.push('Negative sales detected');
        }
        
        // Check for outlier spikes
        const nonZeroSales = salesSeries.filter(val => val > 0);
        let median;
        try {
            if (nonZeroSales.length === 0) {
                median = 0;
            } else {
                median = ss.median(nonZeroSales);
            }
        } catch (error) {
            // Fallback to simple average if median calculation fails
            const sum = nonZeroSales.reduce((a, b) => a + b, 0);
            median = nonZeroSales.length > 0 ? sum / nonZeroSales.length : 0;
        }
        const maxSale = Math.max(...salesSeries);
        if (median > 0 && maxSale > median * 10) {
            issues.push('Outlier spike detected');
        }
        
        // Check for mostly zero sales
        const zeroCount = salesSeries.filter(val => val === 0).length;
        if (zeroCount > salesSeries.length * 0.8) {
            issues.push('Mostly zero sales');
        }
        
        // Check for missing critical data
        if (!row.STOCKONHAND && row.STOCKONHAND !== 0) {
            issues.push('Missing stock data');
        }
        
        if (!row.UNITCOST && row.UNITCOST !== 0) {
            issues.push('Missing cost data');
        }
        
        return issues;
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
            totalSalesValue: 0
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
            
            // Safety check: Skip items with MINORDERQTY of 0 (should already be filtered, but double-check)
            if (this.parseNumber(row.MINORDERQTY) === 0) {
                continue;
            }
            
            // Data quality checks
            const qualityIssues = this.performDataQualityChecks(row, sales, partNumber);
            if (qualityIssues.length > 0) {
                debug.dataQualityIssues++;
            }
            
            // Advanced demand forecasting
            const forecast = this.forecastDemand(sales, clusterLabel, daysThreshold, row);
            if (forecast > 0) debug.itemsWithForecast++;
            
            // Calculate safety stock
            const safetyStock = this.calculateSafetyStock(sales, daysThreshold, serviceLevel);
            
            // Determine if item needs ordering using sophisticated logic
            const orderAnalysis = this.analyzeOrderNeed(
                partNumber,
                currentStock, 
                minStock, 
                minOrderQty, 
                forecast, 
                safetyStock, 
                sales, 
                clusterLabel
            );
            
            if (orderAnalysis.needsOrder) {
                debug.itemsNeedingOrder++;
                
                orderItems.push({
                    partNumber,
                    description,
                    category: clusterLabel,
                    currentStock,
                    safetyStock,
                    suggestedQty: orderAnalysis.suggestedQty,
                    cost: unitCost,
                    supplierNumber: row.SUPPLIER_NUMBER1 || row.SUPPLIERNUMBER || row.SUPPLIER_NUMBER || row.SUPPLIER || '10', // Preserve original supplier number
                    demandStd: (() => {
                        try {
                            const recentSalesForStd = sales.slice(-26);
                            return recentSalesForStd.length <= 1 ? 0 : ss.standardDeviation(recentSalesForStd);
                        } catch (error) {
                            return 0;
                        }
                    })(),
                    daysThreshold,
                    // Additional fields for analysis
                    forecast: Math.round(forecast * 100) / 100,
                    minStock,
                    minOrderQty,
                    recentSales: sales.slice(-4).reduce((a, b) => a + b, 0),
                    avgWeeklySales: (() => {
                        const recentSalesForAvg = sales.slice(-12);
                        return recentSalesForAvg.length > 0 ? ss.mean(recentSalesForAvg) : 0;
                    })(),
                    totalSales104Weeks: sales.reduce((a, b) => a + b, 0),
                    stockTurnover: this.calculateStockTurnover(sales, currentStock),
                    orderReason: orderAnalysis.reason,
                    qualityIssues: qualityIssues.join(', ') || 'None',
                    confidence: orderAnalysis.confidence
                });
            }
        }

        // COMPREHENSIVE FINAL MINSTOCK CHECK
        // This ensures ALL items are checked against MINSTOCK regardless of previous ordering logic
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
            
            // Check if this item is already in the order
            const existingOrderIndex = orderItems.findIndex(item => item.partNumber === partNumber);
            
            // Get on order quantity for this part
            const onOrderQty = (this.onOrderData && this.onOrderData[partNumber]) || 0;
            
            // Calculate effective stock (current stock + on order + any already ordered quantity)
            let effectiveStock = currentStock + onOrderQty;
            if (existingOrderIndex >= 0) {
                effectiveStock += orderItems[existingOrderIndex].suggestedQty;
            }
            
            // If MINSTOCK > 0 and effective stock is below MINSTOCK, ensure we order to meet MINSTOCK
            if (minStock > 0 && effectiveStock < minStock) {
                const qtyNeededForMinStock = minStock - effectiveStock;
                const adjustedQty = Math.max(qtyNeededForMinStock, minOrderQty);
                
                if (existingOrderIndex >= 0) {
                    // Update existing order to meet MINSTOCK
                    const currentQty = orderItems[existingOrderIndex].suggestedQty;
                    const newQty = currentQty + adjustedQty;
                    orderItems[existingOrderIndex].suggestedQty = newQty;
                    
                    // Update the order reason to include MINSTOCK requirement
                    if (!orderItems[existingOrderIndex].orderReason.includes('minimum stock')) {
                        orderItems[existingOrderIndex].orderReason += ` + Ensure minimum stock level (${minStock})`;
                    }
                } else {
                    // Create new order item for MINSTOCK requirement
                    debug.itemsNeedingOrder++;
                    
                    orderItems.push({
                        partNumber,
                        description,
                        category: 'minstock-required',
                        currentStock,
                        safetyStock: 0,
                        suggestedQty: adjustedQty,
                        cost: unitCost,
                        supplierNumber: row.SUPPLIER_NUMBER1 || row.SUPPLIERNUMBER || row.SUPPLIER_NUMBER || row.SUPPLIER || '10', // Preserve original supplier number
                        demandStd: 0,
                        daysThreshold,
                        forecast: 0,
                        minStock,
                        minOrderQty,
                        recentSales: sales.slice(-4).reduce((a, b) => a + b, 0),
                        avgWeeklySales: (() => {
                            const recentSalesForAvg = sales.slice(-12);
                            return recentSalesForAvg.length > 0 ? ss.mean(recentSalesForAvg) : 0;
                        })(),
                        totalSales104Weeks: sales.reduce((a, b) => a + b, 0),
                        stockTurnover: this.calculateStockTurnover(sales, currentStock),
                        orderReason: `MINSTOCK requirement - Stock to minimum level (${minStock}), ${onOrderQty} on order`,
                        qualityIssues: 'None',
                        confidence: 0.95
                    });
                }
            }
        }
        
        // Sort by SKU (Part Number) in ascending alphabetical order
        orderItems.sort((a, b) => {
            return a.partNumber.localeCompare(b.partNumber);
        });
        
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