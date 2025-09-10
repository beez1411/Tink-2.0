/**
 * Enhanced Phantom Inventory Detection System
 * Integrates ML learning, multi-store sync, and verification workflow
 */

const PhantomInventoryML = require('./phantom-inventory-ml');
const MultiStoreSyncManager = require('./multi-store-sync');
const NetworkConfigManager = require('./network-config-manager');
const VerificationWorkflow = require('./verification-workflow');
const fs = require('fs').promises;

class EnhancedPhantomDetector {
    constructor(storeId, storeInfo = {}) {
        this.storeId = storeId;
        this.storeInfo = storeInfo;
        
        // Initialize ML system
        this.phantomML = new PhantomInventoryML(storeId);
        
        // Load network sync configuration (HTTP/cloud/local)
        const networkConfig = new NetworkConfigManager().getConfig();

        // Initialize multi-store sync with config
        this.syncManager = new MultiStoreSyncManager({
            storeId: storeId,
            networkSync: networkConfig.networkSync,
            apiBaseUrl: networkConfig.apiBaseUrl,
            apiKey: networkConfig.apiKey,
            cloudProvider: networkConfig.cloudProvider
        });
        
        // Initialize verification workflow
        this.verificationWorkflow = new VerificationWorkflow(storeId, this.phantomML);
        
        this.isInitialized = false;
    }

    /**
     * Initialize the enhanced system
     */
    async initialize() {
        console.log(`Initializing Enhanced Phantom Detector for store ${this.storeId}`);
        
        try {
            // Load ML data
            console.log('Loading ML data...');
            await this.phantomML.initializeLearningData();
            
            // Register store in sync network
            console.log('Registering store in sync network...');
            await this.syncManager.registerStore(this.storeId, this.storeInfo);
            
            // Load verification workflow state
            console.log('Loading verification workflow state...');
            await this.verificationWorkflow.loadWorkflowState();
            
            // Sync with other stores
            console.log('Syncing with other stores...');
            await this.syncManager.syncPhantomInventoryData(this.storeId, this.phantomML);
            
            this.isInitialized = true;
            console.log(`Enhanced Phantom Detector initialized successfully for store ${this.storeId}`);
            
            return {
                success: true,
                mlDataLoaded: this.phantomML.verificationResults.size > 0,
                networkStats: this.syncManager.getNetworkStats(),
                verificationStats: this.verificationWorkflow.getVerificationStats()
            };
            
        } catch (error) {
            console.error(`Error initializing Enhanced Phantom Detector: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Analyze inventory for phantom inventory with all enhancements
     */
    async analyzeInventory(inventoryData) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        console.log(`Analyzing ${inventoryData.length} inventory items for phantom inventory`);
        
        // First, filter out items with 0 or negative stock
        const itemsWithStock = inventoryData.filter(item => {
            const currentStock = parseInt(item.STOCKONHAND || 0);
            return currentStock > 0;
        });
        
        console.log(`Filtered to ${itemsWithStock.length} items with positive stock (excluded ${inventoryData.length - itemsWithStock.length} items with 0 stock)`);
        
        const results = {
            totalItems: inventoryData.length,
            itemsWithStock: itemsWithStock.length,
            phantomCandidates: [],
            categoryBreakdown: {},
            riskFactorAnalysis: {},
            verificationRecommendations: [],
            networkInsights: []
        };

        // Analyze each item that has stock
        for (const item of itemsWithStock) {
            try {
                const analysis = await this.phantomML.analyzePhantomInventoryML(item);
                
                if (analysis.isPhantomInventoryCandidate) {
                    const candidate = {
                        partNumber: item.PARTNUMBER,
                        description: item.DESCRIPTION1,
                        currentStock: parseInt(item.STOCKONHAND || 0),
                        unitCost: parseFloat(item.UNITCOST || 0),
                        riskScore: analysis.riskScore,
                        verificationPriority: analysis.verificationPriority,
                        category: analysis.category,
                        riskFactors: analysis.riskFactors,
                        categoryAccuracy: analysis.categoryAccuracy,
                        modelWeights: analysis.modelWeights,
                        location: item.LOCATIONID || '',
                        supplier: item.SUPPLIER_NUMBER1 || '',
                        estimatedValue: (parseInt(item.STOCKONHAND || 0) * parseFloat(item.UNITCOST || 0)).toFixed(2),
                        moverType: analysis.moverType,
                        baselineVelocity: analysis.baselineVelocity,
                        recentVelocity: analysis.recentVelocity,
                        velocityDrop: analysis.velocityDrop
                    };
                    
                    results.phantomCandidates.push(candidate);
                    
                    // Update category breakdown
                    if (!results.categoryBreakdown[analysis.category]) {
                        results.categoryBreakdown[analysis.category] = {
                            count: 0,
                            totalValue: 0,
                            avgRiskScore: 0,
                            accuracy: analysis.categoryAccuracy
                        };
                    }
                    
                    results.categoryBreakdown[analysis.category].count++;
                    results.categoryBreakdown[analysis.category].totalValue += parseFloat(candidate.estimatedValue);
                    results.categoryBreakdown[analysis.category].avgRiskScore = 
                        (results.categoryBreakdown[analysis.category].avgRiskScore + analysis.riskScore) / 2;
                    
                    // Track risk factors
                    analysis.riskFactors.forEach(factor => {
                        results.riskFactorAnalysis[factor] = (results.riskFactorAnalysis[factor] || 0) + 1;
                    });
                }
            } catch (error) {
                console.error(`Error analyzing item ${item.PARTNUMBER}: ${error.message}`);
            }
        }

        // Sort candidates by verification priority
        results.phantomCandidates.sort((a, b) => b.verificationPriority - a.verificationPriority);

        // Get network insights
        results.networkInsights = await this.syncManager.getNetworkRecommendations(this.storeId);

        // Generate verification recommendations
        results.verificationRecommendations = this.generateVerificationRecommendations(results.phantomCandidates);

        console.log(`Analysis complete: ${results.phantomCandidates.length} phantom candidates identified`);
        
        return results;
    }

    /**
     * Generate verification recommendations
     */
    generateVerificationRecommendations(candidates) {
        const recommendations = [];
        
        // High priority items
        const highPriority = candidates.filter(c => c.verificationPriority >= 90);
        if (highPriority.length > 0) {
            recommendations.push({
                type: 'urgent',
                title: 'Urgent Verification Required',
                message: `${highPriority.length} items require immediate verification (Priority 90+)`,
                items: highPriority.slice(0, 5).map(c => `${c.partNumber} - $${c.estimatedValue}`),
                priority: 'high'
            });
        }

        // High-value items
        const highValue = candidates.filter(c => parseFloat(c.estimatedValue) > 500);
        if (highValue.length > 0) {
            recommendations.push({
                type: 'high_value',
                title: 'High-Value Items',
                message: `${highValue.length} high-value items (>$500) need verification`,
                items: highValue.slice(0, 5).map(c => `${c.partNumber} - $${c.estimatedValue}`),
                priority: 'high'
            });
        }

        // Category-specific recommendations
        const categoryGroups = {};
        candidates.forEach(c => {
            if (!categoryGroups[c.category]) categoryGroups[c.category] = [];
            categoryGroups[c.category].push(c);
        });

        Object.entries(categoryGroups).forEach(([category, items]) => {
            if (items.length >= 5) {
                recommendations.push({
                    type: 'category_focus',
                    title: `${category.charAt(0).toUpperCase() + category.slice(1)} Category`,
                    message: `${items.length} ${category} items flagged - consider focused verification`,
                    items: items.slice(0, 3).map(c => `${c.partNumber} - Risk: ${c.riskScore}`),
                    priority: 'medium'
                });
            }
        });

        return recommendations;
    }

    /**
     * Generate daily verification list
     */
    async generateDailyVerificationList(inventoryData) {
        const result = await this.verificationWorkflow.generateDailyVerificationList(inventoryData);
        
        // Sync the updated ML data after generating the list
        await this.syncManager.syncPhantomInventoryData(this.storeId, this.phantomML);
        
        return result;
    }

    /**
     * Record verification result and learn from it
     */
    async recordVerificationResult(partNumber, predicted, actualStock, notes = '') {
        const result = await this.phantomML.recordVerificationResult(partNumber, predicted, actualStock, notes);
        
        // Sync the learning across stores
        await this.syncManager.syncPhantomInventoryData(this.storeId, this.phantomML);
        
        return result;
    }

    /**
     * Complete verification workflow
     */
    async completeVerification(verificationId, results) {
        const completed = await this.verificationWorkflow.completeVerification(verificationId, results);
        
        // Sync after verification completion
        await this.syncManager.syncPhantomInventoryData(this.storeId, this.phantomML);
        
        return completed;
    }

    /**
     * Batch complete multiple verifications
     */
    async batchCompleteVerifications(verificationResults) {
        const results = await this.verificationWorkflow.batchCompleteVerifications(verificationResults);
        
        // Sync after batch completion
        await this.syncManager.syncPhantomInventoryData(this.storeId, this.phantomML);
        
        return results;
    }

    /**
     * Get comprehensive system statistics
     */
    getSystemStats() {
        return {
            storeId: this.storeId,
            mlStats: this.phantomML.getVerificationStats(),
            networkStats: this.syncManager.getNetworkStats(),
            verificationStats: this.verificationWorkflow.getVerificationStats(),
            systemHealth: {
                mlAccuracy: this.phantomML.calculateOverallAccuracy(),
                networkConnected: this.syncManager.stores.size > 1,
                verificationBacklog: this.verificationWorkflow.verificationQueue.length,
                lastSync: this.syncManager.stores.get(this.storeId)?.lastSync || null
            }
        };
    }

    /**
     * Generate comprehensive report
     */
    async generateComprehensiveReport() {
        const stats = this.getSystemStats();
        const workbook = new ExcelJS.Workbook();
        
        // System Overview
        const overviewSheet = workbook.addWorksheet('System Overview');
        overviewSheet.addRow(['Enhanced Phantom Inventory Detection Report', '']);
        overviewSheet.addRow(['Store ID', this.storeId]);
        overviewSheet.addRow(['Store Name', this.storeInfo.name || 'Unknown']);
        overviewSheet.addRow(['Generated', new Date().toISOString()]);
        overviewSheet.addRow(['', '']);
        overviewSheet.addRow(['Machine Learning Statistics', '']);
        overviewSheet.addRow(['Total Verifications', stats.mlStats.totalVerifications]);
        overviewSheet.addRow(['Overall Accuracy', `${stats.mlStats.overallAccuracy.toFixed(1)}%`]);
        overviewSheet.addRow(['Recent Verifications (30 days)', stats.mlStats.recentVerifications]);
        overviewSheet.addRow(['', '']);
        overviewSheet.addRow(['Network Statistics', '']);
        overviewSheet.addRow(['Total Stores', stats.networkStats.totalStores]);
        overviewSheet.addRow(['Active Stores', stats.networkStats.activeStores]);
        overviewSheet.addRow(['Network Verifications', stats.networkStats.totalVerifications]);
        overviewSheet.addRow(['Network Accuracy', `${stats.networkStats.averageAccuracy.toFixed(1)}%`]);
        overviewSheet.addRow(['', '']);
        overviewSheet.addRow(['Verification Workflow', '']);
        overviewSheet.addRow(['Pending Verifications', stats.verificationStats.pending]);
        overviewSheet.addRow(['In Progress', stats.verificationStats.inProgress]);
        overviewSheet.addRow(['Completed', stats.verificationStats.completed]);
        overviewSheet.addRow(['Total Discrepancies', stats.verificationStats.totalDiscrepancies]);
        overviewSheet.addRow(['Accuracy Rate', `${stats.verificationStats.accuracyRate.toFixed(1)}%`]);

        // Category Performance
        const categorySheet = workbook.addWorksheet('Category Performance');
        categorySheet.columns = [
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Verifications', key: 'verifications', width: 15 },
            { header: 'Accuracy', key: 'accuracy', width: 15 },
            { header: 'Avg Discrepancy', key: 'avgDiscrepancy', width: 15 }
        ];

        Object.entries(stats.mlStats.categoryStats).forEach(([category, categoryStats]) => {
            categorySheet.addRow({
                category: category,
                verifications: categoryStats.verifications,
                accuracy: `${categoryStats.accuracy.toFixed(1)}%`,
                avgDiscrepancy: categoryStats.avgDiscrepancy.toFixed(2)
            });
        });

        // Network Recommendations
        const networkRecommendations = await this.syncManager.getNetworkRecommendations(this.storeId);
        if (networkRecommendations.length > 0) {
            const recommendationsSheet = workbook.addWorksheet('Network Recommendations');
            recommendationsSheet.columns = [
                { header: 'Type', key: 'type', width: 20 },
                { header: 'Priority', key: 'priority', width: 15 },
                { header: 'Recommendation', key: 'message', width: 50 }
            ];

            networkRecommendations.forEach(rec => {
                recommendationsSheet.addRow({
                    type: rec.type,
                    priority: rec.priority,
                    message: rec.message
                });
            });
        }

        // Save report
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Enhanced_Phantom_Report_${this.storeId}_${timestamp}.xlsx`;
        await workbook.xlsx.writeFile(filename);
        
        return { filename, stats };
    }

    /**
     * Schedule automatic operations
     */
    scheduleAutomaticOperations(inventoryDataCallback) {
        // Schedule daily verification list generation
        this.verificationWorkflow.scheduleDailyGeneration(inventoryDataCallback);
        
        // Schedule daily sync with other stores
        this.syncManager.scheduleAutoSync(this.storeId, this.phantomML);
        
        console.log(`Scheduled automatic operations for store ${this.storeId}`);
    }

    /**
     * Export all data for backup/analysis
     */
    async exportAllData() {
        const timestamp = new Date().toISOString().split('T')[0];
        
        const exportData = {
            storeId: this.storeId,
            storeInfo: this.storeInfo,
            exportDate: new Date().toISOString(),
            mlData: {
                verificationResults: Array.from(this.phantomML.verificationResults.entries()),
                modelWeights: this.phantomML.modelWeights,
                categoryPatterns: Array.from(this.phantomML.categoryPatterns.entries())
            },
            verificationWorkflow: {
                verificationQueue: this.verificationWorkflow.verificationQueue,
                activeVerifications: Array.from(this.verificationWorkflow.activeVerifications.entries()),
                completedVerifications: Array.from(this.verificationWorkflow.completedVerifications.entries())
            },
            systemStats: this.getSystemStats()
        };

        const filename = `phantom_system_export_${this.storeId}_${timestamp}.json`;
        await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
        
        return filename;
    }

    /**
     * Import data from backup
     */
    async importData(filename) {
        try {
            const data = await fs.readFile(filename, 'utf8');
            const importData = JSON.parse(data);
            
            // Restore ML data
            if (importData.mlData) {
                this.phantomML.verificationResults = new Map(importData.mlData.verificationResults || []);
                this.phantomML.modelWeights = { ...this.phantomML.getDefaultWeights(), ...importData.mlData.modelWeights };
                this.phantomML.categoryPatterns = new Map(importData.mlData.categoryPatterns || []);
            }
            
            // Restore verification workflow
            if (importData.verificationWorkflow) {
                this.verificationWorkflow.verificationQueue = importData.verificationWorkflow.verificationQueue || [];
                this.verificationWorkflow.activeVerifications = new Map(importData.verificationWorkflow.activeVerifications || []);
                this.verificationWorkflow.completedVerifications = new Map(importData.verificationWorkflow.completedVerifications || []);
            }
            
            // Save restored data
            await this.phantomML.saveMLData();
            await this.verificationWorkflow.saveWorkflowState();
            
            console.log(`Successfully imported data from ${filename}`);
            return { success: true, message: 'Data imported successfully' };
            
        } catch (error) {
            console.error(`Error importing data: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = EnhancedPhantomDetector; 