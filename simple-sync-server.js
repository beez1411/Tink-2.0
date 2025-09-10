/**
 * Simple Tink ML Sync Server
 * Lightweight Node.js server for synchronizing phantom inventory learning data
 * Can be deployed to Heroku, Vercel, Railway, or any cloud provider
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory storage (use database in production)
const storeData = new Map();
const networkLearning = {
    consolidatedLearning: {
        categoryPatterns: [],
        modelWeights: {},
        totalVerifications: 0,
        networkAccuracy: 0,
        lastUpdated: new Date().toISOString()
    },
    stores: []
};

// API Key validation (simple - use proper auth in production)
const API_KEY = process.env.API_KEY || 'tink-ml-sync-key-2024';

function validateApiKey(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    
    const token = authHeader.substring(7);
    if (token !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    
    next();
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        stores: storeData.size,
        version: '1.0'
    });
});

// Upload store ML data
app.post('/api/stores/sync', validateApiKey, (req, res) => {
    try {
        const { storeId, timestamp, verificationResults, categoryPatterns, modelWeights, stats } = req.body;
        
        if (!storeId) {
            return res.status(400).json({ error: 'Store ID is required' });
        }
        
        // Store the data
        storeData.set(storeId, {
            storeId,
            timestamp,
            verificationResults: verificationResults || [],
            categoryPatterns: categoryPatterns || [],
            modelWeights: modelWeights || {},
            stats: stats || {},
            lastSync: new Date().toISOString()
        });
        
        // Update consolidated learning
        updateConsolidatedLearning();
        
        console.log(`Received sync data from store ${storeId} with ${stats?.totalVerifications || 0} verifications`);
        
        res.json({ 
            success: true, 
            message: `Data synced for store ${storeId}`,
            networkStores: storeData.size
        });
        
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync store data' });
    }
});

// Download network learning data
app.get('/api/network/learning', validateApiKey, (req, res) => {
    try {
        const excludeStore = req.query.exclude;
        
        // Get all stores except the requesting one
        const stores = Array.from(storeData.values())
            .filter(store => store.storeId !== excludeStore)
            .map(store => ({
                storeId: store.storeId,
                stats: store.stats,
                lastSync: store.lastSync
            }));
        
        res.json({
            success: true,
            consolidatedLearning: networkLearning.consolidatedLearning,
            stores: stores,
            networkStats: {
                totalStores: storeData.size,
                totalVerifications: networkLearning.consolidatedLearning.totalVerifications,
                networkAccuracy: networkLearning.consolidatedLearning.networkAccuracy,
                lastUpdated: networkLearning.consolidatedLearning.lastUpdated
            }
        });
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to get network learning data' });
    }
});

// Get store list
app.get('/api/stores', validateApiKey, (req, res) => {
    try {
        const stores = Array.from(storeData.values()).map(store => ({
            storeId: store.storeId,
            lastSync: store.lastSync,
            verifications: store.stats?.totalVerifications || 0,
            accuracy: store.stats?.accuracy || 0,
            categories: store.stats?.categories || []
        }));
        
        res.json({ success: true, stores });
        
    } catch (error) {
        console.error('Store list error:', error);
        res.status(500).json({ error: 'Failed to get store list' });
    }
});

// Delete store data (for testing)
app.delete('/api/stores/:storeId', validateApiKey, (req, res) => {
    try {
        const { storeId } = req.params;
        
        if (storeData.has(storeId)) {
            storeData.delete(storeId);
            updateConsolidatedLearning();
            res.json({ success: true, message: `Store ${storeId} data deleted` });
        } else {
            res.status(404).json({ error: 'Store not found' });
        }
        
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete store data' });
    }
});

/**
 * Update consolidated learning from all stores
 */
function updateConsolidatedLearning() {
    const consolidated = {
        categoryPatterns: new Map(),
        modelWeights: {},
        totalVerifications: 0,
        networkAccuracy: 0,
        storeCount: 0
    };
    
    let totalAccuracy = 0;
    let storeCount = 0;
    
    // Process each store's data
    storeData.forEach((store) => {
        // Accumulate verifications
        consolidated.totalVerifications += store.stats?.totalVerifications || 0;
        
        // Accumulate accuracy
        if (store.stats?.accuracy) {
            totalAccuracy += store.stats.accuracy;
            storeCount++;
        }
        
        // Merge category patterns
        if (store.categoryPatterns) {
            const categoryMap = new Map(store.categoryPatterns);
            categoryMap.forEach((pattern, category) => {
                if (consolidated.categoryPatterns.has(category)) {
                    const existing = consolidated.categoryPatterns.get(category);
                    existing.totalVerifications += pattern.totalVerifications || 0;
                    existing.correctPredictions += pattern.correctPredictions || 0;
                    existing.avgDiscrepancy = (existing.avgDiscrepancy + (pattern.avgDiscrepancy || 0)) / 2;
                } else {
                    consolidated.categoryPatterns.set(category, {
                        totalVerifications: pattern.totalVerifications || 0,
                        correctPredictions: pattern.correctPredictions || 0,
                        avgDiscrepancy: pattern.avgDiscrepancy || 0
                    });
                }
            });
        }
        
        // Merge model weights
        if (store.modelWeights) {
            Object.keys(store.modelWeights).forEach(key => {
                if (!consolidated.modelWeights[key]) {
                    consolidated.modelWeights[key] = [];
                }
                consolidated.modelWeights[key].push(store.modelWeights[key]);
            });
        }
    });
    
    // Calculate average model weights
    Object.keys(consolidated.modelWeights).forEach(key => {
        const weights = consolidated.modelWeights[key];
        consolidated.modelWeights[key] = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    });
    
    // Calculate network accuracy
    consolidated.networkAccuracy = storeCount > 0 ? totalAccuracy / storeCount : 0;
    consolidated.storeCount = storeCount;
    
    // Update global network learning
    networkLearning.consolidatedLearning = {
        categoryPatterns: Array.from(consolidated.categoryPatterns.entries()),
        modelWeights: consolidated.modelWeights,
        totalVerifications: consolidated.totalVerifications,
        networkAccuracy: consolidated.networkAccuracy,
        lastUpdated: new Date().toISOString()
    };
    
    networkLearning.stores = Array.from(storeData.keys());
    
    console.log(`Updated consolidated learning: ${consolidated.totalVerifications} verifications from ${storeCount} stores`);
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Tink ML Sync Server running on port ${PORT}`);
    console.log(`API Key: ${API_KEY}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
