/**
 * Multi-Store Synchronization System for Phantom Inventory Learning
 * Allows 4 hardware stores to share verification data and improve algorithm accuracy
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MultiStoreSyncManager {
    constructor(config = {}) {
        this.stores = new Map();
        this.syncConfig = {
            syncInterval: 24 * 60 * 60 * 1000, // 24 hours
            maxSyncAttempts: 3,
            dataRetentionDays: 365,
            minVerificationsForSync: 5,
            // NEW: Network sync options
            networkSync: config.networkSync || 'local', // 'local', 'http', 'cloud'
            apiBaseUrl: config.apiBaseUrl || 'https://your-tink-api.herokuapp.com',
            apiKey: config.apiKey || 'your-api-key',
            cloudProvider: config.cloudProvider || 'dropbox'
        };
        
        // Use user data directory to avoid permission issues
        const os = require('os');
        const userDataDir = path.join(os.homedir(), '.tink2-data');
        this.syncDataFile = path.join(userDataDir, 'multi_store_sync_data.json');
        this.lastSyncFile = path.join(userDataDir, 'last_sync_timestamp.json');
        
        // Initialize network sync managers
        this.httpSyncManager = null;
        this.cloudSyncManager = null;
        this.initializeNetworkSync(config);
    }

    /**
     * Initialize network synchronization based on configuration
     */
    initializeNetworkSync(config) {
        try {
            if (this.syncConfig.networkSync === 'http') {
                const HTTPSyncManager = require('./http-sync-manager');
                this.httpSyncManager = new HTTPSyncManager({
                    storeId: config.storeId,
                    apiBaseUrl: this.syncConfig.apiBaseUrl,
                    apiKey: this.syncConfig.apiKey
                });
            } else if (this.syncConfig.networkSync === 'cloud') {
                const CloudSyncManager = require('./cloud-sync-manager');
                this.cloudSyncManager = new CloudSyncManager({
                    storeId: config.storeId,
                    provider: this.syncConfig.cloudProvider
                });
            }
            
            console.log(`Network sync initialized: ${this.syncConfig.networkSync}`);
        } catch (error) {
            console.warn('Network sync initialization failed, falling back to local:', error.message);
            this.syncConfig.networkSync = 'local';
        }
    }

    /**
     * Register a store in the network
     */
    async registerStore(storeId, storeInfo) {
        const store = {
            id: storeId,
            name: storeInfo.name || storeId,
            location: storeInfo.location || '',
            registeredAt: new Date().toISOString(),
            lastSync: null,
            verificationCount: 0,
            accuracy: 0,
            categories: new Set(),
            isActive: true,
            syncKey: this.generateSyncKey(storeId)
        };

        this.stores.set(storeId, store);
        await this.saveSyncData();
        
        console.log(`Registered store: ${storeId} (${store.name})`);
        return store;
    }

    /**
     * Generate unique sync key for store
     */
    generateSyncKey(storeId) {
        return crypto.createHash('sha256')
            .update(storeId + Date.now().toString())
            .digest('hex').substring(0, 32);
    }

    /**
     * Load sync data from file
     */
    async loadSyncData() {
        try {
            const data = await fs.readFile(this.syncDataFile, 'utf8');
            const parsed = JSON.parse(data);
            
            // Restore stores map with proper Set conversion
            this.stores = new Map((parsed.stores || []).map(([id, store]) => [
                id,
                {
                    ...store,
                    categories: new Set(store.categories || [])
                }
            ]));
            
            console.log(`Loaded sync data for ${this.stores.size} stores`);
        } catch (error) {
            console.log('No existing sync data found, starting fresh');
        }
    }

    /**
     * Save sync data to file
     */
    async saveSyncData() {
        try {
            const data = {
                stores: Array.from(this.stores.entries()).map(([id, store]) => [
                    id,
                    {
                        ...store,
                        categories: Array.from(store.categories || [])
                    }
                ]),
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };

            // Ensure user data directory exists
            const userDataDir = path.dirname(this.syncDataFile);
            await fs.mkdir(userDataDir, { recursive: true });
            
            await fs.writeFile(this.syncDataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error saving sync data: ${error.message}`);
        }
    }

    /**
     * Sync phantom inventory data between stores
     */
    async syncPhantomInventoryData(sourceStoreId, phantomML) {
        try {
            console.log(`Starting ${this.syncConfig.networkSync} sync for store ${sourceStoreId}`);
            
            // Choose sync method based on configuration
            switch (this.syncConfig.networkSync) {
                case 'http':
                    return await this.syncViaHTTP(sourceStoreId, phantomML);
                case 'cloud':
                    return await this.syncViaCloud(sourceStoreId, phantomML);
                case 'local':
                default:
                    return await this.syncViaLocalFiles(sourceStoreId, phantomML);
            }
            
        } catch (error) {
            console.error(`Sync error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync via HTTP API
     */
    async syncViaHTTP(sourceStoreId, phantomML) {
        if (!this.httpSyncManager) {
            throw new Error('HTTP sync manager not initialized');
        }

        // Initialize if needed
        if (!this.httpSyncManager.isInitialized) {
            const initResult = await this.httpSyncManager.initialize();
            if (!initResult.success) {
                throw new Error(`HTTP sync initialization failed: ${initResult.error}`);
            }
        }

        // Perform HTTP sync
        const syncResult = await this.httpSyncManager.syncViaHTTP(phantomML);
        
        console.log(`HTTP sync completed for store ${sourceStoreId}`);
        return syncResult;
    }

    /**
     * Sync via cloud storage
     */
    async syncViaCloud(sourceStoreId, phantomML) {
        if (!this.cloudSyncManager) {
            throw new Error('Cloud sync manager not initialized');
        }

        // Initialize if needed
        if (!this.cloudSyncManager.isInitialized) {
            const initResult = await this.cloudSyncManager.initialize();
            if (!initResult.success) {
                throw new Error(`Cloud sync initialization failed: ${initResult.error}`);
            }
        }

        // Perform cloud sync
        const syncResult = await this.cloudSyncManager.syncToCloud(phantomML);
        
        console.log(`Cloud sync completed for store ${sourceStoreId}`);
        return syncResult;
    }

    /**
     * Sync via local files (original method)
     */
    async syncViaLocalFiles(sourceStoreId, phantomML) {
        // Load existing sync data
        await this.loadSyncData();
        
        // Get source store data
        const sourceStore = this.stores.get(sourceStoreId);
        if (!sourceStore) {
            throw new Error(`Store ${sourceStoreId} not registered`);
        }

        // Create consolidated learning data
        const consolidatedData = await this.createConsolidatedLearningData(sourceStoreId, phantomML);
        
        // Update source store info
        sourceStore.lastSync = new Date().toISOString();
        sourceStore.verificationCount = phantomML.verificationResults.size;
        sourceStore.accuracy = phantomML.calculateOverallAccuracy();
        
        // Extract categories from verification data
        if (!(sourceStore.categories instanceof Set)) {
            sourceStore.categories = new Set(sourceStore.categories || []);
        }
        phantomML.categoryPatterns.forEach((pattern, category) => {
            sourceStore.categories.add(category);
        });

        // Save consolidated data for other stores to use
        await this.saveConsolidatedData(consolidatedData);
        
        // Apply learning from other stores
        await this.applyMultiStoreLearning(sourceStoreId, phantomML);
        
        await this.saveSyncData();
        
        console.log(`Local file sync completed for store ${sourceStoreId}`);
        return {
            success: true,
            syncedStores: this.stores.size - 1,
            consolidatedVerifications: consolidatedData.totalVerifications,
            improvedAccuracy: consolidatedData.networkAccuracy,
            syncMethod: 'local-files'
        };
    }

    /**
     * Create consolidated learning data from all stores
     */
    async createConsolidatedLearningData(sourceStoreId, phantomML) {
        const consolidatedData = {
            sourceStore: sourceStoreId,
            timestamp: new Date().toISOString(),
            totalVerifications: 0,
            networkAccuracy: 0,
            categoryPatterns: new Map(),
            modelWeights: {},
            verificationPatterns: new Map(),
            commonRiskFactors: new Map()
        };

        // Add source store data
        consolidatedData.totalVerifications += phantomML.verificationResults.size;
        let totalAccuracy = phantomML.calculateOverallAccuracy();
        let storeCount = 1;

        // Merge category patterns
        phantomML.categoryPatterns.forEach((pattern, category) => {
            consolidatedData.categoryPatterns.set(category, {
                totalVerifications: pattern.totalVerifications,
                correctPredictions: pattern.correctPredictions,
                avgDiscrepancy: pattern.avgDiscrepancy,
                stores: [sourceStoreId]
            });
        });

        // Initialize model weights with source store
        consolidatedData.modelWeights = { ...phantomML.modelWeights };

        // Analyze verification patterns
        phantomML.verificationResults.forEach((result, partNumber) => {
            const pattern = {
                category: phantomML.extractCategory(partNumber),
                riskScore: result.predicted.riskScore,
                wasCorrect: result.correct,
                discrepancy: result.actual.discrepancy,
                riskFactors: result.predicted.riskFactors
            };

            consolidatedData.verificationPatterns.set(partNumber, pattern);

            // Track common risk factors
            result.predicted.riskFactors.forEach(factor => {
                const count = consolidatedData.commonRiskFactors.get(factor) || 0;
                consolidatedData.commonRiskFactors.set(factor, count + 1);
            });
        });

        // Try to load and merge data from other stores
        for (const [storeId, store] of this.stores.entries()) {
            if (storeId !== sourceStoreId && store.isActive) {
                try {
                    const otherStoreData = await this.loadOtherStoreData(storeId);
                    if (otherStoreData) {
                        consolidatedData.totalVerifications += otherStoreData.verificationCount;
                        totalAccuracy += otherStoreData.accuracy;
                        storeCount++;

                        // Merge category patterns
                        Object.entries(otherStoreData.categoryPatterns || {}).forEach(([category, pattern]) => {
                            const existing = consolidatedData.categoryPatterns.get(category);
                            if (existing) {
                                existing.totalVerifications += pattern.totalVerifications;
                                existing.correctPredictions += pattern.correctPredictions;
                                existing.avgDiscrepancy = (existing.avgDiscrepancy + pattern.avgDiscrepancy) / 2;
                                existing.stores.push(storeId);
                            } else {
                                consolidatedData.categoryPatterns.set(category, {
                                    ...pattern,
                                    stores: [storeId]
                                });
                            }
                        });

                        // Merge model weights (weighted average)
                        Object.keys(otherStoreData.modelWeights || {}).forEach(key => {
                            const weight = otherStoreData.verificationCount || 1;
                            consolidatedData.modelWeights[key] = 
                                (consolidatedData.modelWeights[key] + (otherStoreData.modelWeights[key] * weight)) / (weight + 1);
                        });
                    }
                } catch (error) {
                    console.log(`Could not load data from store ${storeId}: ${error.message}`);
                }
            }
        }

        consolidatedData.networkAccuracy = totalAccuracy / storeCount;
        
        return consolidatedData;
    }

    /**
     * Load data from another store
     */
    async loadOtherStoreData(storeId) {
        try {
            const dataFile = `phantom_ml_data_${storeId}.json`;
            const data = await fs.readFile(dataFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    /**
     * Save consolidated data for network access
     */
    async saveConsolidatedData(consolidatedData) {
        try {
            const data = {
                ...consolidatedData,
                categoryPatterns: Array.from(consolidatedData.categoryPatterns.entries()),
                verificationPatterns: Array.from(consolidatedData.verificationPatterns.entries()),
                commonRiskFactors: Array.from(consolidatedData.commonRiskFactors.entries())
            };

            // Use user data directory to avoid permission issues
            const userDataDir = path.dirname(this.syncDataFile);
            await fs.mkdir(userDataDir, { recursive: true });
            
            const networkDataFile = path.join(userDataDir, 'phantom_network_data.json');
            await fs.writeFile(networkDataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error saving consolidated data: ${error.message}`);
        }
    }

    /**
     * Apply multi-store learning to improve local algorithm
     */
    async applyMultiStoreLearning(storeId, phantomML) {
        try {
            const networkData = await fs.readFile('phantom_network_data.json', 'utf8');
            const parsed = JSON.parse(networkData);

            // Initialize model weights if they don't exist
            if (!phantomML.modelWeights) {
                phantomML.modelWeights = {
                    velocityDrop: 0.8,
                    stockAmount: 0.3,
                    unitCost: 0.5,
                    riskScore: 0.9
                };
            }

            // Apply network-learned model weights with some influence
            const influence = 0.2; // 20% influence from network
            if (parsed.modelWeights) {
                Object.keys(phantomML.modelWeights).forEach(key => {
                    if (parsed.modelWeights[key]) {
                        phantomML.modelWeights[key] = 
                            (phantomML.modelWeights[key] * (1 - influence)) + 
                            (parsed.modelWeights[key] * influence);
                    }
                });
            }

            // Update category patterns with network knowledge
            const networkCategories = new Map(parsed.categoryPatterns || []);
            networkCategories.forEach((networkPattern, category) => {
                const localPattern = phantomML.categoryPatterns.get(category);
                if (localPattern) {
                    // Blend local and network patterns
                    const networkWeight = 0.3;
                    const networkAccuracy = networkPattern.correctPredictions / networkPattern.totalVerifications;
                    const localAccuracy = localPattern.correctPredictions / localPattern.totalVerifications;
                    
                    // Only apply network learning if it's more accurate
                    if (networkAccuracy > localAccuracy) {
                        localPattern.avgDiscrepancy = 
                            (localPattern.avgDiscrepancy * (1 - networkWeight)) + 
                            (networkPattern.avgDiscrepancy * networkWeight);
                    }
                } else {
                    // Add new category pattern from network
                    phantomML.categoryPatterns.set(category, {
                        totalVerifications: Math.floor(networkPattern.totalVerifications * 0.1), // Scale down
                        correctPredictions: Math.floor(networkPattern.correctPredictions * 0.1),
                        avgDiscrepancy: networkPattern.avgDiscrepancy
                    });
                }
            });

            console.log(`Applied multi-store learning to store ${storeId}`);
        } catch (error) {
            console.log(`No network data available for learning: ${error.message}`);
        }
    }

    /**
     * Get network statistics
     */
    getNetworkStats() {
        const stats = {
            totalStores: this.stores.size,
            activeStores: Array.from(this.stores.values()).filter(s => s.isActive).length,
            totalVerifications: 0,
            averageAccuracy: 0,
            categories: new Set(),
            lastSync: null
        };

        let totalAccuracy = 0;
        let storesWithData = 0;

        this.stores.forEach(store => {
            if (store.verificationCount > 0) {
                stats.totalVerifications += store.verificationCount;
                totalAccuracy += store.accuracy;
                storesWithData++;
            }
            
            // Ensure categories is a Set, convert if needed
            const categories = store.categories instanceof Set ? store.categories : new Set(store.categories || []);
            categories.forEach(cat => stats.categories.add(cat));
            
            if (!stats.lastSync || (store.lastSync && store.lastSync > stats.lastSync)) {
                stats.lastSync = store.lastSync;
            }
        });

        stats.averageAccuracy = storesWithData > 0 ? totalAccuracy / storesWithData : 0;
        stats.categories = Array.from(stats.categories);

        return stats;
    }

    /**
     * Get recommendations for a store based on network data
     */
    async getNetworkRecommendations(storeId) {
        const recommendations = [];
        
        try {
            const networkData = await fs.readFile('phantom_network_data.json', 'utf8');
            const parsed = JSON.parse(networkData);
            
            const store = this.stores.get(storeId);
            if (!store) return recommendations;

            // Recommend categories with high network accuracy but low local accuracy
            const networkCategories = new Map(parsed.categoryPatterns || []);
            networkCategories.forEach((networkPattern, category) => {
                const networkAccuracy = networkPattern.correctPredictions / networkPattern.totalVerifications;
                
                if (networkAccuracy > 80 && networkPattern.totalVerifications > 20) {
                    recommendations.push({
                        type: 'category_focus',
                        category: category,
                        message: `Focus on ${category} items - network shows ${networkAccuracy.toFixed(1)}% accuracy with ${networkPattern.totalVerifications} verifications across ${networkPattern.stores.length} stores`,
                        priority: 'high'
                    });
                }
            });

            // Recommend common risk factors
            const commonRiskFactors = new Map(parsed.commonRiskFactors || []);
            const topRiskFactors = Array.from(commonRiskFactors.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            topRiskFactors.forEach(([factor, count]) => {
                recommendations.push({
                    type: 'risk_factor',
                    factor: factor,
                    message: `"${factor}" appears in ${count} verifications across network - high reliability indicator`,
                    priority: 'medium'
                });
            });

            // Recommend verification targets
            if (store.verificationCount < 50) {
                recommendations.push({
                    type: 'verification_target',
                    message: `Increase verifications to ${50} to improve algorithm accuracy (currently ${store.verificationCount})`,
                    priority: 'high'
                });
            }

        } catch (error) {
            console.log(`Error getting network recommendations: ${error.message}`);
        }

        return recommendations;
    }

    /**
     * Schedule automatic sync
     */
    scheduleAutoSync(storeId, phantomML) {
        setInterval(async () => {
            console.log(`Auto-sync triggered for store ${storeId}`);
            await this.syncPhantomInventoryData(storeId, phantomML);
        }, this.syncConfig.syncInterval);
    }

    /**
     * Export data for external analysis
     */
    async exportNetworkData(format = 'json') {
        try {
            const networkStats = this.getNetworkStats();
            const networkData = await fs.readFile('phantom_network_data.json', 'utf8');
            const parsed = JSON.parse(networkData);

            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    format: format,
                    version: '1.0'
                },
                networkStats: networkStats,
                consolidatedData: parsed,
                stores: Array.from(this.stores.entries()).map(([id, store]) => ({
                    id,
                    name: store.name,
                    location: store.location,
                    verificationCount: store.verificationCount,
                    accuracy: store.accuracy,
                    categories: Array.from(store.categories),
                    lastSync: store.lastSync
                }))
            };

            const filename = `phantom_network_export_${new Date().toISOString().split('T')[0]}.json`;
            await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
            
            return filename;
        } catch (error) {
            console.error(`Error exporting network data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Calculate network accuracy from all stores
     */
    calculateNetworkAccuracy() {
        if (this.stores.size === 0) return 0;
        
        let totalAccuracy = 0;
        let storeCount = 0;
        
        this.stores.forEach(store => {
            if (store.accuracy !== undefined) {
                totalAccuracy += store.accuracy;
                storeCount++;
            }
        });
        
        return storeCount > 0 ? totalAccuracy / storeCount : 0;
    }

    /**
     * Get network statistics
     */
    getNetworkStats() {
        return {
            totalStores: this.stores.size,
            totalVerifications: Array.from(this.stores.values()).reduce((sum, store) => sum + (store.verificationCount || 0), 0),
            accuracy: this.calculateNetworkAccuracy(),
            lastSync: this.lastSyncTime || new Date().toISOString()
        };
    }
}

module.exports = MultiStoreSyncManager; 