/**
 * Test Data Generator for Tink 2.0 ML Sync Testing
 * Generates realistic phantom inventory ML data for testing multi-store sync
 */

const fs = require('fs').promises;
const path = require('path');

class TinkTestDataGenerator {
    constructor() {
        this.storeProfiles = {
            '17521': {
                name: 'Main Hardware Store',
                location: 'Denver, CO',
                categories: ['Hardware', 'Tools', 'Plumbing', 'Electrical'],
                avgAccuracy: 0.85,
                verificationVolume: 'high'
            },
            '18179': {
                name: 'Garden Center',
                location: 'Boulder, CO', 
                categories: ['Garden', 'Tools', 'Hardware', 'Seasonal'],
                avgAccuracy: 0.78,
                verificationVolume: 'medium'
            },
            '18181': {
                name: 'Pro Tools Outlet',
                location: 'Colorado Springs, CO',
                categories: ['Tools', 'Hardware', 'Electrical', 'Safety'],
                avgAccuracy: 0.92,
                verificationVolume: 'high'
            },
            '19001': {
                name: 'Home Improvement Center',
                location: 'Fort Collins, CO',
                categories: ['Hardware', 'Plumbing', 'Paint', 'Lumber'],
                avgAccuracy: 0.81,
                verificationVolume: 'medium'
            }
        };

        this.productCategories = {
            'Hardware': {
                skuPrefix: 'HW',
                avgPrice: 15.50,
                seasonality: 0.1,
                volatility: 0.3
            },
            'Tools': {
                skuPrefix: 'TL',
                avgPrice: 45.00,
                seasonality: 0.2,
                volatility: 0.4
            },
            'Plumbing': {
                skuPrefix: 'PL',
                avgPrice: 25.75,
                seasonality: 0.15,
                volatility: 0.25
            },
            'Electrical': {
                skuPrefix: 'EL',
                avgPrice: 35.25,
                seasonality: 0.1,
                volatility: 0.35
            },
            'Garden': {
                skuPrefix: 'GD',
                avgPrice: 20.00,
                seasonality: 0.8,
                volatility: 0.6
            },
            'Seasonal': {
                skuPrefix: 'SN',
                avgPrice: 30.00,
                seasonality: 0.9,
                volatility: 0.7
            },
            'Safety': {
                skuPrefix: 'SF',
                avgPrice: 28.50,
                seasonality: 0.05,
                volatility: 0.2
            },
            'Paint': {
                skuPrefix: 'PT',
                avgPrice: 42.00,
                seasonality: 0.3,
                volatility: 0.4
            },
            'Lumber': {
                skuPrefix: 'LB',
                avgPrice: 85.00,
                seasonality: 0.4,
                volatility: 0.5
            }
        };
    }

    /**
     * Generate complete test dataset for all stores
     */
    async generateCompleteTestDataset() {
        console.log('🏭 Generating Complete Tink ML Test Dataset');
        console.log('=' * 50);

        const dataset = {
            metadata: {
                generated: new Date().toISOString(),
                generator: 'Tink Test Data Generator v1.0',
                stores: Object.keys(this.storeProfiles),
                totalStores: Object.keys(this.storeProfiles).length
            },
            stores: {}
        };

        for (const storeId of Object.keys(this.storeProfiles)) {
            console.log(`\n📊 Generating data for store ${storeId}...`);
            dataset.stores[storeId] = await this.generateStoreData(storeId);
        }

        // Generate consolidated network learning
        console.log('\n🌐 Generating consolidated network learning...');
        dataset.consolidatedLearning = this.generateConsolidatedLearning(dataset.stores);

        // Save dataset
        const outputPath = 'test-dataset.json';
        await fs.writeFile(outputPath, JSON.stringify(dataset, null, 2));
        
        console.log(`\n✅ Complete test dataset saved to: ${outputPath}`);
        this.printDatasetSummary(dataset);

        return dataset;
    }

    /**
     * Generate ML data for a specific store
     */
    async generateStoreData(storeId) {
        const profile = this.storeProfiles[storeId];
        const verificationCount = this.getVerificationCount(profile.verificationVolume);
        
        const storeData = {
            storeId: storeId,
            profile: profile,
            timestamp: new Date().toISOString(),
            verificationResults: [],
            categoryPatterns: [],
            modelWeights: this.generateModelWeights(profile),
            stats: {
                totalVerifications: verificationCount,
                accuracy: profile.avgAccuracy + (Math.random() - 0.5) * 0.1,
                categories: profile.categories
            }
        };

        // Generate verification results
        for (let i = 0; i < verificationCount; i++) {
            const verification = this.generateVerificationResult(profile);
            storeData.verificationResults.push(verification);
        }

        // Generate category patterns
        for (const category of profile.categories) {
            const pattern = this.generateCategoryPattern(category, profile, verificationCount);
            storeData.categoryPatterns.push([category, pattern]);
        }

        return storeData;
    }

    /**
     * Generate a single verification result
     */
    generateVerificationResult(profile) {
        const category = this.randomChoice(profile.categories);
        const categoryInfo = this.productCategories[category];
        
        const sku = `${categoryInfo.skuPrefix}${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
        
        // Base prediction with some accuracy based on store profile
        const baseQuantity = Math.floor(Math.random() * 50) + 1;
        const accuracyFactor = profile.avgAccuracy + (Math.random() - 0.5) * 0.2;
        
        let predicted, actual;
        if (Math.random() < accuracyFactor) {
            // Accurate prediction
            predicted = baseQuantity;
            actual = baseQuantity + Math.floor((Math.random() - 0.5) * 4); // Small variance
        } else {
            // Inaccurate prediction
            predicted = baseQuantity;
            actual = baseQuantity + Math.floor((Math.random() - 0.5) * 20); // Large variance
        }

        const accuracy = actual === 0 ? 0 : Math.max(0, 1 - Math.abs(predicted - actual) / Math.max(predicted, actual));

        return [sku, {
            predicted: predicted,
            actual: Math.max(0, actual),
            accuracy: accuracy,
            category: category,
            timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() // Last 30 days
        }];
    }

    /**
     * Generate category pattern data
     */
    generateCategoryPattern(category, profile, totalVerifications) {
        const categoryVerifications = Math.floor(totalVerifications / profile.categories.length);
        const correctPredictions = Math.floor(categoryVerifications * profile.avgAccuracy);
        
        const categoryInfo = this.productCategories[category];
        const avgDiscrepancy = categoryInfo.volatility * (2 - profile.avgAccuracy);

        return {
            totalVerifications: categoryVerifications,
            correctPredictions: correctPredictions,
            avgDiscrepancy: avgDiscrepancy,
            seasonalityFactor: categoryInfo.seasonality,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate model weights for a store
     */
    generateModelWeights(profile) {
        const baseWeights = {
            seasonalWeight: 0.3,
            trendWeight: 0.4,
            categoryWeight: 0.3,
            historicalWeight: 0.5,
            volatilityWeight: 0.2
        };

        // Adjust weights based on store profile
        const adjustmentFactor = (profile.avgAccuracy - 0.8) * 2; // -0.4 to 0.4 range
        
        return {
            seasonalWeight: Math.max(0.1, Math.min(0.9, baseWeights.seasonalWeight + adjustmentFactor * 0.1)),
            trendWeight: Math.max(0.1, Math.min(0.9, baseWeights.trendWeight + adjustmentFactor * 0.15)),
            categoryWeight: Math.max(0.1, Math.min(0.9, baseWeights.categoryWeight + adjustmentFactor * 0.1)),
            historicalWeight: Math.max(0.1, Math.min(0.9, baseWeights.historicalWeight + adjustmentFactor * 0.2)),
            volatilityWeight: Math.max(0.1, Math.min(0.9, baseWeights.volatilityWeight + adjustmentFactor * 0.05))
        };
    }

    /**
     * Generate consolidated network learning from all stores
     */
    generateConsolidatedLearning(stores) {
        const consolidated = {
            categoryPatterns: new Map(),
            modelWeights: {},
            totalVerifications: 0,
            networkAccuracy: 0,
            storeCount: Object.keys(stores).length,
            lastUpdated: new Date().toISOString()
        };

        let totalAccuracy = 0;
        const allModelWeights = {};

        // Process each store
        Object.values(stores).forEach(store => {
            consolidated.totalVerifications += store.stats.totalVerifications;
            totalAccuracy += store.stats.accuracy;

            // Merge category patterns
            store.categoryPatterns.forEach(([category, pattern]) => {
                if (consolidated.categoryPatterns.has(category)) {
                    const existing = consolidated.categoryPatterns.get(category);
                    existing.totalVerifications += pattern.totalVerifications;
                    existing.correctPredictions += pattern.correctPredictions;
                    existing.avgDiscrepancy = (existing.avgDiscrepancy + pattern.avgDiscrepancy) / 2;
                } else {
                    consolidated.categoryPatterns.set(category, { ...pattern });
                }
            });

            // Collect model weights
            Object.keys(store.modelWeights).forEach(key => {
                if (!allModelWeights[key]) {
                    allModelWeights[key] = [];
                }
                allModelWeights[key].push(store.modelWeights[key]);
            });
        });

        // Calculate average model weights
        Object.keys(allModelWeights).forEach(key => {
            const weights = allModelWeights[key];
            consolidated.modelWeights[key] = weights.reduce((sum, w) => sum + w, 0) / weights.length;
        });

        // Calculate network accuracy
        consolidated.networkAccuracy = totalAccuracy / consolidated.storeCount;

        return {
            categoryPatterns: Array.from(consolidated.categoryPatterns.entries()),
            modelWeights: consolidated.modelWeights,
            totalVerifications: consolidated.totalVerifications,
            networkAccuracy: consolidated.networkAccuracy,
            lastUpdated: consolidated.lastUpdated
        };
    }

    /**
     * Generate test sync payloads for API testing
     */
    async generateSyncPayloads() {
        console.log('📦 Generating API Sync Test Payloads');
        
        const payloads = {};
        
        for (const storeId of Object.keys(this.storeProfiles)) {
            const storeData = await this.generateStoreData(storeId);
            
            payloads[storeId] = {
                storeId: storeId,
                timestamp: storeData.timestamp,
                verificationResults: storeData.verificationResults,
                categoryPatterns: storeData.categoryPatterns,
                modelWeights: storeData.modelWeights,
                stats: storeData.stats
            };
        }

        const payloadPath = 'test-sync-payloads.json';
        await fs.writeFile(payloadPath, JSON.stringify(payloads, null, 2));
        
        console.log(`✅ Sync payloads saved to: ${payloadPath}`);
        return payloads;
    }

    /**
     * Generate performance test data
     */
    async generatePerformanceTestData(storeCount = 10, verificationsPerStore = 1000) {
        console.log(`🚀 Generating Performance Test Data (${storeCount} stores, ${verificationsPerStore} verifications each)`);
        
        const performanceData = {
            metadata: {
                generated: new Date().toISOString(),
                storeCount: storeCount,
                verificationsPerStore: verificationsPerStore,
                totalVerifications: storeCount * verificationsPerStore
            },
            stores: {}
        };

        for (let i = 1; i <= storeCount; i++) {
            const storeId = `PERF_STORE_${String(i).padStart(3, '0')}`;
            
            // Create a synthetic store profile
            const profile = {
                name: `Performance Test Store ${i}`,
                location: `Test Location ${i}`,
                categories: this.randomChoice([
                    ['Hardware', 'Tools'],
                    ['Plumbing', 'Electrical'],
                    ['Garden', 'Seasonal'],
                    ['Tools', 'Safety']
                ]),
                avgAccuracy: 0.7 + Math.random() * 0.3,
                verificationVolume: 'high'
            };

            console.log(`   Generating store ${storeId}...`);
            
            const storeData = {
                storeId: storeId,
                timestamp: new Date().toISOString(),
                verificationResults: [],
                categoryPatterns: [],
                modelWeights: this.generateModelWeights(profile),
                stats: {
                    totalVerifications: verificationsPerStore,
                    accuracy: profile.avgAccuracy,
                    categories: profile.categories
                }
            };

            // Generate verifications (simplified for performance)
            for (let j = 0; j < verificationsPerStore; j++) {
                const verification = this.generateVerificationResult(profile);
                storeData.verificationResults.push(verification);
            }

            // Generate category patterns
            for (const category of profile.categories) {
                const pattern = this.generateCategoryPattern(category, profile, verificationsPerStore);
                storeData.categoryPatterns.push([category, pattern]);
            }

            performanceData.stores[storeId] = storeData;
        }

        const perfPath = 'performance-test-data.json';
        await fs.writeFile(perfPath, JSON.stringify(performanceData, null, 2));
        
        console.log(`✅ Performance test data saved to: ${perfPath}`);
        console.log(`📊 Total data size: ${(JSON.stringify(performanceData).length / 1024 / 1024).toFixed(2)} MB`);
        
        return performanceData;
    }

    /**
     * Get verification count based on volume level
     */
    getVerificationCount(volume) {
        const ranges = {
            'low': [20, 50],
            'medium': [50, 150],
            'high': [150, 300]
        };
        
        const [min, max] = ranges[volume] || ranges['medium'];
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Random choice helper
     */
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Print dataset summary
     */
    printDatasetSummary(dataset) {
        console.log('\n📊 DATASET SUMMARY');
        console.log('=' * 30);
        console.log(`Total Stores: ${dataset.metadata.totalStores}`);
        
        let totalVerifications = 0;
        let totalAccuracy = 0;
        const allCategories = new Set();

        Object.values(dataset.stores).forEach(store => {
            totalVerifications += store.stats.totalVerifications;
            totalAccuracy += store.stats.accuracy;
            store.stats.categories.forEach(cat => allCategories.add(cat));
        });

        console.log(`Total Verifications: ${totalVerifications}`);
        console.log(`Average Accuracy: ${(totalAccuracy / dataset.metadata.totalStores).toFixed(3)}`);
        console.log(`Unique Categories: ${allCategories.size}`);
        console.log(`Categories: ${Array.from(allCategories).join(', ')}`);
        
        console.log('\nPer-Store Breakdown:');
        Object.entries(dataset.stores).forEach(([storeId, store]) => {
            console.log(`  ${storeId}: ${store.stats.totalVerifications} verifications, ${store.stats.accuracy.toFixed(3)} accuracy`);
        });
    }
}

// Export for use in other scripts
module.exports = TinkTestDataGenerator;

// Run generator if this script is executed directly
if (require.main === module) {
    const generator = new TinkTestDataGenerator();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'complete';
    
    switch (command) {
        case 'complete':
            generator.generateCompleteTestDataset().catch(console.error);
            break;
        case 'payloads':
            generator.generateSyncPayloads().catch(console.error);
            break;
        case 'performance':
            const storeCount = parseInt(args[1]) || 10;
            const verifications = parseInt(args[2]) || 1000;
            generator.generatePerformanceTestData(storeCount, verifications).catch(console.error);
            break;
        default:
            console.log('Usage: node test-data-generator.js [complete|payloads|performance] [storeCount] [verifications]');
            console.log('  complete    - Generate complete test dataset (default)');
            console.log('  payloads    - Generate API sync payloads');
            console.log('  performance - Generate performance test data');
            break;
    }
}
