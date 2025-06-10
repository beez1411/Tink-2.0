const Papa = require('papaparse');
const ss = require('simple-statistics');
const { KMeans } = require('ml-kmeans');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;

class InventoryAnalyzer {
    constructor() {
        this.data = null;
    }

    async loadData(inputFile, chunkSize = 10000) {
        try {
            // Read tab-separated file
            const fileContent = await fs.readFile(inputFile, 'utf-8');
            const parsed = Papa.parse(fileContent, {
                delimiter: '\t',
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true
            });
            this.data = parsed.data;
            return parsed.data;
        } catch (error) {
            throw new Error(`Failed to load data: ${error.message}`);
        }
    }

    featureEngineering(salesMatrix) {
        const features = [];
        
        for (let i = 0; i < salesMatrix.length; i++) {
            const row = salesMatrix[i];
            
            // Calculate variance
            const mean = row.reduce((a, b) => a + b, 0) / row.length;
            const variance = row.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / row.length;
            
            // Calculate peak to mean ratio
            const peak = Math.max(...row);
            const peakToMean = mean === 0 ? 0 : peak / mean;
            
            // Calculate autocorrelation (simplified)
            const autocorr = this.calculateAutocorrelation(row);
            
            // Calculate coefficient of variation
            const std = Math.sqrt(variance);
            const coeffVar = mean === 0 ? 0 : std / mean;
            
            // Count zero weeks
            const zeroWeeks = row.filter(val => val === 0).length;
            
            // Calculate trend slope
            const slope = this.calculateTrendSlope(row);
            
            features.push([variance, peakToMean, autocorr, coeffVar, zeroWeeks, slope]);
        }
        
        return features;
    }

    calculateAutocorrelation(series) {
        if (series.length < 2) return 0;
        
        try {
            const n = series.length - 1;
            const x1 = series.slice(0, n);
            const x2 = series.slice(1);
            
            // Use simple-statistics for correlation
            return ss.sampleCorrelation(x1, x2) || 0;
        } catch (error) {
            return 0;
        }
    }

    calculateTrendSlope(series) {
        if (series.length < 2) return 0;
        
        const n = series.length;
        const x = [];
        for (let i = 0; i < n; i++) x.push(i);
        
        const xSum = x.reduce((a, b) => a + b, 0);
        const ySum = series.reduce((a, b) => a + b, 0);
        const xxSum = x.reduce((sum, val) => sum + val * val, 0);
        const xySum = x.reduce((sum, val, i) => sum + val * series[i], 0);
        
        const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
        return isNaN(slope) ? 0 : slope;
    }

    clusterSKUs(features, nClusters = 3) {
        const kmeans = new KMeans(features, nClusters, {
            initialization: 'random',
            seed: 42
        });
        
        return {
            labels: kmeans.clusters,
            centers: kmeans.centroids
        };
    }

    assignClusterLabels(centers) {
        const variances = centers.map(center => center[0]);
        const peakMeans = centers.map(center => center[1]);
        const autocorrs = centers.map(center => center[2]);
        
        const steadyIdx = variances.indexOf(Math.min(...variances));
        const seasonalIdx = autocorrs.indexOf(Math.max(...autocorrs));
        const erraticIdx = peakMeans.indexOf(Math.max(...peakMeans));
        
        const labelMap = {};
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

    forecastDemand(salesSeries, label, daysThreshold) {
        let forecast = 0;
        
        switch (label) {
            case 'steady':
                // Average of last 26 weeks
                const recentSales = salesSeries.slice(-26);
                const avg = recentSales.reduce((a, b) => a + b, 0) / recentSales.length;
                forecast = avg * (daysThreshold / 7);
                break;
                
            case 'seasonal':
                // Simplified seasonal forecast - you might want to implement STL decomposition
                if (salesSeries.length >= 56) {
                    const seasonalSales = salesSeries.slice(-56, -52);
                    const seasonalAvg = seasonalSales.reduce((a, b) => a + b, 0) / seasonalSales.length;
                    forecast = seasonalAvg * (daysThreshold / 7);
                } else {
                    const recentAvg = salesSeries.slice(-12).reduce((a, b) => a + b, 0) / 12;
                    forecast = recentAvg * (daysThreshold / 7);
                }
                break;
                
            default:
                // Median of last 20 weeks
                const recent = salesSeries.slice(-20).sort((a, b) => a - b);
                const median = recent.length % 2 === 0 
                    ? (recent[recent.length / 2 - 1] + recent[recent.length / 2]) / 2
                    : recent[Math.floor(recent.length / 2)];
                forecast = median * (daysThreshold / 7);
        }
        
        return Math.max(0, forecast);
    }

    async generateSuggestedOrder(config) {
        const {
            inputFile,
            outputFile,
            supplierNumber = 10,
            daysThreshold = 14,
            chunkSize = 10000
        } = config;

        try {
            // Load data
            const data = await this.loadData(inputFile, chunkSize);
            
            // Filter data
            const filtered = data.filter(row => 
                row.DELETED !== 1 && row.SUPPLIER_NUMBER1 === supplierNumber
            );
            
            // Get week columns
            const weekColumns = [];
            for (let i = 0; i < 104; i++) {
                weekColumns.push(`WEEK_${i}`);
            }
            
            // Extract sales data
            const salesData = [];
            const partNumbers = [];
            
            for (let i = 0; i < filtered.length; i++) {
                const row = filtered[i];
                const sales = weekColumns.map(col => {
                    const val = row[col];
                    return isNaN(val) ? 0 : val;
                });
                salesData.push(sales);
                partNumbers.push(row.PARTNUMBER);
            }
            
            // Feature engineering
            const features = this.featureEngineering(salesData);
            
            // Clustering
            const clustering = this.clusterSKUs(features, 3);
            const labelMap = this.assignClusterLabels(clustering.centers);
            
            // Generate forecasts
            const results = [];
            for (let i = 0; i < salesData.length; i++) {
                const clusterLabel = labelMap[clustering.labels[i]];
                const forecast = this.forecastDemand(salesData[i], clusterLabel, daysThreshold);
                
                results.push({
                    partNumber: partNumbers[i],
                    cluster: clusterLabel,
                    forecast: Math.ceil(forecast),
                    // Add other required fields from your current output
                });
            }
            
            // Save results
            await this.saveToExcel(results, outputFile);
            
            return {
                main_output: outputFile,
                processed_items: results.length
            };
            
        } catch (error) {
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }

    async saveToExcel(results, outputFile) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Suggested Order');
        
        // Add headers
        worksheet.columns = [
            { header: 'Part Number', key: 'partNumber', width: 20 },
            { header: 'Cluster', key: 'cluster', width: 15 },
            { header: 'Forecast', key: 'forecast', width: 15 },
            // Add more columns as needed
        ];
        
        // Add data
        results.forEach(result => {
            worksheet.addRow(result);
        });
        
        await workbook.xlsx.writeFile(outputFile);
    }
}

async function generateSuggestedOrder(config) {
    const analyzer = new InventoryAnalyzer();
    return await analyzer.generateSuggestedOrder(config);
}

module.exports = { generateSuggestedOrder, InventoryAnalyzer }; 