/**
 * ML Data Cleanup Utility
 * Resets all machine learning data for fresh installs
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class MLDataCleanup {
    constructor() {
        this.userDataDir = path.join(os.homedir(), '.tink2-data');
        this.cleanupLog = [];
    }

    /**
     * Perform complete ML data cleanup
     */
    async performFullCleanup(options = {}) {
        const { 
            keepConfig = false,  // Keep API configuration
            silent = false       // Silent mode (no console output)
        } = options;

        this.cleanupLog = [];
        
        try {
            if (!silent) console.log('🧹 Starting ML data cleanup...');

            // 1. Clean individual store ML data
            await this.cleanStoreMLData(silent);

            // 2. Clean multi-store sync data
            await this.cleanMultiStoreSyncData(silent);

            // 3. Clean verification workflow data
            await this.cleanVerificationWorkflowData(silent);

            // 4. Clean sync timestamps
            await this.cleanSyncTimestamps(silent);

            // 5. Clean cloud sync cache
            await this.cleanCloudSyncCache(silent);

            // 6. Optionally preserve API configuration
            if (!keepConfig) {
                await this.cleanAPIConfiguration(silent);
            }

            if (!silent) {
                console.log('✅ ML data cleanup completed successfully!');
                console.log(`📊 Cleaned ${this.cleanupLog.length} files/directories`);
            }

            return {
                success: true,
                filesRemoved: this.cleanupLog.length,
                cleanupLog: this.cleanupLog
            };

        } catch (error) {
            if (!silent) console.error('❌ Cleanup failed:', error.message);
            return {
                success: false,
                error: error.message,
                cleanupLog: this.cleanupLog
            };
        }
    }

    /**
     * Clean individual store ML learning data
     */
    async cleanStoreMLData(silent = false) {
        try {
            const files = await fs.readdir(this.userDataDir).catch(() => []);
            
            for (const file of files) {
                if (file.startsWith('phantom_ml_data_') && file.endsWith('.json')) {
                    const filePath = path.join(this.userDataDir, file);
                    await fs.unlink(filePath);
                    this.cleanupLog.push(`Removed: ${file}`);
                    if (!silent) console.log(`  🗑️ Removed: ${file}`);
                }
            }
        } catch (error) {
            if (!silent) console.warn(`⚠️ Error cleaning store ML data: ${error.message}`);
        }
    }

    /**
     * Clean multi-store sync data
     */
    async cleanMultiStoreSyncData(silent = false) {
        const syncFiles = [
            'phantom_ml_multi_store.json',
            'multi_store_sync_data.json'
        ];

        for (const file of syncFiles) {
            try {
                const filePath = path.join(this.userDataDir, file);
                await fs.unlink(filePath);
                this.cleanupLog.push(`Removed: ${file}`);
                if (!silent) console.log(`  🗑️ Removed: ${file}`);
            } catch (error) {
                // File doesn't exist, that's fine
            }
        }
    }

    /**
     * Clean verification workflow data
     */
    async cleanVerificationWorkflowData(silent = false) {
        try {
            const files = await fs.readdir(this.userDataDir).catch(() => []);
            
            for (const file of files) {
                if (file.startsWith('verification_workflow_') && file.endsWith('.json')) {
                    const filePath = path.join(this.userDataDir, file);
                    await fs.unlink(filePath);
                    this.cleanupLog.push(`Removed: ${file}`);
                    if (!silent) console.log(`  🗑️ Removed: ${file}`);
                }
            }
        } catch (error) {
            if (!silent) console.warn(`⚠️ Error cleaning workflow data: ${error.message}`);
        }
    }

    /**
     * Clean sync timestamps
     */
    async cleanSyncTimestamps(silent = false) {
        const timestampFiles = [
            'last_sync_timestamp.json',
            'last-http-sync.json',
            'last-cloud-sync.json'
        ];

        for (const file of timestampFiles) {
            try {
                const filePath = path.join(this.userDataDir, file);
                await fs.unlink(filePath);
                this.cleanupLog.push(`Removed: ${file}`);
                if (!silent) console.log(`  🗑️ Removed: ${file}`);
            } catch (error) {
                // File doesn't exist, that's fine
            }
        }
    }

    /**
     * Clean cloud sync cache
     */
    async cleanCloudSyncCache(silent = false) {
        try {
            const cloudSyncDir = path.join(this.userDataDir, 'cloud-sync');
            
            // Check if directory exists
            try {
                await fs.access(cloudSyncDir);
                // Directory exists, remove it recursively
                await fs.rmdir(cloudSyncDir, { recursive: true });
                this.cleanupLog.push('Removed: cloud-sync/ directory');
                if (!silent) console.log('  🗑️ Removed: cloud-sync/ directory');
            } catch (error) {
                // Directory doesn't exist, that's fine
            }
        } catch (error) {
            if (!silent) console.warn(`⚠️ Error cleaning cloud sync cache: ${error.message}`);
        }
    }

    /**
     * Clean API configuration (optional)
     */
    async cleanAPIConfiguration(silent = false) {
        try {
            const configFile = path.join(this.userDataDir, 'api-config.json');
            await fs.unlink(configFile);
            this.cleanupLog.push('Removed: api-config.json');
            if (!silent) console.log('  🗑️ Removed: api-config.json (API configuration)');
        } catch (error) {
            // File doesn't exist, that's fine
        }
    }

    /**
     * Clean localStorage data (browser storage)
     * Note: This creates a script that needs to be run in the renderer process
     */
    getLocalStorageCleanupScript(keepConfig = false) {
        const keysToRemove = [
            'tinkLearningData',           // Main learning insights data
            'tinkFeedbackData',           // Manager feedback data
            'tinkPersistentOrderData',    // Persistent order data
            'preferredPhantomStore',      // Phantom store preferences
            'onOrderData',                // On-order data
            'rememberedCredentials'       // Login credentials (optional)
        ];

        if (!keepConfig) {
            // If not keeping config, also remove API-related localStorage
            keysToRemove.push('apiConfig', 'networkSyncConfig');
        }

        return `
// ML Data Cleanup - localStorage cleaning script
console.log('🧹 Cleaning localStorage ML data...');
const keysToRemove = ${JSON.stringify(keysToRemove)};
let removedCount = 0;

keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log('  🗑️ Removed localStorage:', key);
        removedCount++;
    }
});

// Clear learning insights from memory
if (window.learningInsights) {
    window.learningInsights = {
        lastAnalysis: null,
        seasonalIntelligence: null,
        trendAnalysis: null,
        dataQuality: null,
        forecastAccuracy: null,
        managerFeedback: null
    };
    console.log('  🧹 Reset window.learningInsights');
}

console.log('✅ localStorage cleanup completed - removed ' + removedCount + ' items');
return { success: true, removedCount: removedCount };
`;
    }

    /**
     * Get cleanup preview (what would be cleaned)
     */
    async getCleanupPreview() {
        const preview = {
            storeMLFiles: [],
            syncFiles: [],
            workflowFiles: [],
            timestampFiles: [],
            cloudSyncCache: false,
            apiConfig: false
        };

        try {
            const files = await fs.readdir(this.userDataDir).catch(() => []);
            
            for (const file of files) {
                if (file.startsWith('phantom_ml_data_') && file.endsWith('.json')) {
                    preview.storeMLFiles.push(file);
                } else if (file.startsWith('verification_workflow_') && file.endsWith('.json')) {
                    preview.workflowFiles.push(file);
                } else if (['phantom_ml_multi_store.json', 'multi_store_sync_data.json'].includes(file)) {
                    preview.syncFiles.push(file);
                } else if (['last_sync_timestamp.json', 'last-http-sync.json', 'last-cloud-sync.json'].includes(file)) {
                    preview.timestampFiles.push(file);
                } else if (file === 'api-config.json') {
                    preview.apiConfig = true;
                }
            }

            // Check for cloud sync directory
            try {
                await fs.access(path.join(this.userDataDir, 'cloud-sync'));
                preview.cloudSyncCache = true;
            } catch (error) {
                // Directory doesn't exist
            }

        } catch (error) {
            console.warn('Error getting cleanup preview:', error.message);
        }

        return preview;
    }

    /**
     * Reset to factory defaults (complete cleanup)
     */
    async resetToFactoryDefaults() {
        return await this.performFullCleanup({ 
            keepConfig: false, 
            silent: false 
        });
    }

    /**
     * Clean ML data but keep configuration
     */
    async cleanMLDataOnly() {
        return await this.performFullCleanup({ 
            keepConfig: true, 
            silent: false 
        });
    }
}

module.exports = MLDataCleanup;
