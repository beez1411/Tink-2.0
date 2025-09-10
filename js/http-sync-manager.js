/**
 * HTTP API Synchronization for Multi-Store ML Learning
 * Simple REST API client for syncing phantom inventory learning data
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class HTTPSyncManager {
    constructor(config = {}) {
        this.storeId = config.storeId;
        this.apiBaseUrl = config.apiBaseUrl || 'https://your-tink-api.herokuapp.com';
        this.apiKey = config.apiKey || 'your-api-key';
        this.timeout = config.timeout || 30000;
        
        // Local storage
        const os = require('os');
        this.userDataDir = path.join(os.homedir(), '.tink2-data');
        this.lastSyncFile = path.join(this.userDataDir, 'last-http-sync.json');
        
        this.isInitialized = false;
    }

    /**
     * Initialize HTTP sync
     */
    async initialize() {
        try {
            // Test API connection
            const testResult = await this.testConnection();
            if (!testResult.success) {
                throw new Error(`API connection failed: ${testResult.error}`);
            }
            
            this.isInitialized = true;
            console.log(`HTTP sync initialized for store ${this.storeId}`);
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize HTTP sync:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            const response = await this.makeRequest('GET', '/api/health');
            return { success: true, data: response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync ML data via HTTP API
     */
    async syncViaHTTP(phantomML) {
        if (!this.isInitialized) {
            throw new Error('HTTP sync not initialized');
        }

        try {
            console.log(`Starting HTTP sync for store ${this.storeId}`);
            
            // Prepare sync data
            const syncData = this.prepareSyncData(phantomML);
            
            // Upload store data to API
            const uploadResult = await this.uploadStoreData(syncData);
            if (!uploadResult.success) {
                throw new Error(`Upload failed: ${uploadResult.error}`);
            }
            
            // Download network data from API
            const downloadResult = await this.downloadNetworkData();
            if (!downloadResult.success) {
                throw new Error(`Download failed: ${downloadResult.error}`);
            }
            
            // Apply network learning
            const mergeResult = await this.applyNetworkLearning(phantomML, downloadResult.data);
            
            // Update last sync timestamp
            await this.updateLastSyncTimestamp();
            
            console.log(`HTTP sync completed for store ${this.storeId}`);
            
            return {
                success: true,
                uploaded: uploadResult.success,
                networkStores: downloadResult.data.stores.length,
                syncTimestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('HTTP sync failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Prepare ML data for API upload
     */
    prepareSyncData(phantomML) {
        return {
            storeId: this.storeId,
            timestamp: new Date().toISOString(),
            version: '1.0',
            
            // ML Data
            verificationResults: Array.from(phantomML.verificationResults.entries()),
            categoryPatterns: Array.from(phantomML.categoryPatterns.entries()),
            modelWeights: phantomML.modelWeights,
            
            // Statistics
            stats: {
                totalVerifications: phantomML.verificationResults.size,
                accuracy: phantomML.calculateOverallAccuracy(),
                categories: Array.from(phantomML.categoryPatterns.keys())
            }
        };
    }

    /**
     * Upload store data to API
     */
    async uploadStoreData(syncData) {
        try {
            const response = await this.makeRequest('POST', '/api/stores/sync', syncData);
            return { success: true, data: response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Download network learning data from API
     */
    async downloadNetworkData() {
        try {
            const response = await this.makeRequest('GET', `/api/network/learning?exclude=${this.storeId}`);
            return { success: true, data: response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Apply network learning to local ML
     */
    async applyNetworkLearning(localML, networkData) {
        const networkInfluence = 0.2; // 20% influence from network
        
        if (!networkData.consolidatedLearning) return;
        
        const consolidatedLearning = networkData.consolidatedLearning;
        
        // Apply category patterns
        if (consolidatedLearning.categoryPatterns) {
            const networkCategories = new Map(consolidatedLearning.categoryPatterns);
            networkCategories.forEach((networkPattern, category) => {
                const localPattern = localML.categoryPatterns.get(category);
                
                if (localPattern) {
                    const networkAccuracy = networkPattern.correctPredictions / networkPattern.totalVerifications;
                    const localAccuracy = localPattern.correctPredictions / localPattern.totalVerifications;
                    
                    if (networkAccuracy > localAccuracy) {
                        localPattern.avgDiscrepancy = 
                            (localPattern.avgDiscrepancy * (1 - networkInfluence)) + 
                            (networkPattern.avgDiscrepancy * networkInfluence);
                    }
                } else {
                    localML.categoryPatterns.set(category, {
                        totalVerifications: Math.floor(networkPattern.totalVerifications * 0.1),
                        correctPredictions: Math.floor(networkPattern.correctPredictions * 0.1),
                        avgDiscrepancy: networkPattern.avgDiscrepancy
                    });
                }
            });
        }
        
        // Apply model weights
        if (consolidatedLearning.modelWeights) {
            Object.keys(localML.modelWeights).forEach(key => {
                if (consolidatedLearning.modelWeights[key]) {
                    localML.modelWeights[key] = 
                        (localML.modelWeights[key] * (1 - networkInfluence)) + 
                        (consolidatedLearning.modelWeights[key] * networkInfluence);
                }
            });
        }
        
        console.log(`Applied network learning from ${networkData.stores.length} stores`);
    }

    /**
     * Make HTTP request
     */
    async makeRequest(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.apiBaseUrl + endpoint);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'Tink-2.0-Sync-Client'
                }
            };
            
            const req = httpModule.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsedData);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.error || 'Unknown error'}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse response: ${parseError.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            // Send data if provided
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    /**
     * Update last sync timestamp
     */
    async updateLastSyncTimestamp() {
        const syncInfo = {
            lastSync: new Date().toISOString(),
            storeId: this.storeId,
            apiBaseUrl: this.apiBaseUrl
        };
        await fs.writeFile(this.lastSyncFile, JSON.stringify(syncInfo, null, 2));
    }
}

module.exports = HTTPSyncManager;
