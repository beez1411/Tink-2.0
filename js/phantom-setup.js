/**
 * Phantom Inventory Setup System
 * Handles store selection and system initialization
 */

const { getStoreOptions, getStoreConfig, isValidStoreId } = require('./store-config');
const EnhancedPhantomDetector = require('./enhanced-phantom-detector');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PhantomSetup {
    constructor() {
        // Use user data directory instead of app directory to avoid permission issues
        const userDataDir = this.getUserDataDirectory();
        this.setupFile = path.join(userDataDir, 'phantom_setup.json');
        this.currentStore = null;
        this.phantomDetector = null;
        this.isInitialized = false;
        
        // Ensure user data directory exists
        this.ensureUserDataDirectory();
    }
    
    /**
     * Get user data directory for storing configuration files
     */
    getUserDataDirectory() {
        // Try to use Electron's userData path if available
        try {
            const { app } = require('electron');
            if (app && app.getPath) {
                return app.getPath('userData');
            }
        } catch (error) {
            // Fallback if Electron app is not available
        }
        
        // Fallback to user's home directory
        return path.join(os.homedir(), '.tink2-data');
    }
    
    /**
     * Ensure user data directory exists
     */
    async ensureUserDataDirectory() {
        try {
            const userDataDir = path.dirname(this.setupFile);
            await fs.mkdir(userDataDir, { recursive: true });
        } catch (error) {
            console.warn('Could not create user data directory:', error.message);
        }
    }

    /**
     * Check if setup has been completed
     */
    async isSetupComplete() {
        try {
            const setupData = await fs.readFile(this.setupFile, 'utf8');
            const config = JSON.parse(setupData);
            return config.setupComplete && config.storeId && isValidStoreId(config.storeId);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get current store configuration
     */
    async getCurrentStore() {
        if (this.currentStore) {
            return this.currentStore;
        }

        try {
            const setupData = await fs.readFile(this.setupFile, 'utf8');
            const config = JSON.parse(setupData);
            
            if (config.storeId && isValidStoreId(config.storeId)) {
                this.currentStore = getStoreConfig(config.storeId);
                return this.currentStore;
            }
        } catch (error) {
            console.log('No existing store configuration found');
        }

        return null;
    }

    /**
     * Get available store options for selection
     */
    getStoreOptions() {
        return getStoreOptions();
    }

    /**
     * Select and configure store
     */
    async selectStore(storeId) {
        if (!isValidStoreId(storeId)) {
            throw new Error(`Invalid store ID: ${storeId}`);
        }

        const storeConfig = getStoreConfig(storeId);
        this.currentStore = storeConfig;

        // Save setup configuration
        const setupConfig = {
            storeId: storeId,
            storeName: storeConfig.name,
            storeDisplayName: storeConfig.displayName,
            setupComplete: true,
            setupDate: new Date().toISOString(),
            version: '1.0'
        };

        await fs.writeFile(this.setupFile, JSON.stringify(setupConfig, null, 2));
        
        console.log(`Store selected: ${storeConfig.displayName}`);
        return storeConfig;
    }

    /**
     * Initialize the phantom inventory system
     */
    async initializePhantomSystem() {
        const currentStore = await this.getCurrentStore();
        if (!currentStore) {
            throw new Error('No store selected. Please run setup first.');
        }

        console.log(`Initializing Phantom Inventory System for ${currentStore.displayName}`);

        // Create enhanced phantom detector
        this.phantomDetector = new EnhancedPhantomDetector(currentStore.id, currentStore);

        // Initialize the system
        const result = await this.phantomDetector.initialize();
        
        if (result.success) {
            this.isInitialized = true;
            console.log('Phantom Inventory System initialized successfully');
            
            // Log initialization results
            console.log(`ML Data Loaded: ${result.mlDataLoaded}`);
            console.log(`Network Stats: ${result.networkStats.totalStores} stores, ${result.networkStats.totalVerifications} verifications`);
            console.log(`Verification Stats: ${result.verificationStats.pending} pending, ${result.verificationStats.completed} completed`);
            
            return {
                success: true,
                store: currentStore,
                systemStats: result
            };
        } else {
            throw new Error(`Failed to initialize phantom system: ${result.error}`);
        }
    }

    /**
     * Get phantom detector instance
     */
    getPhantomDetector() {
        if (!this.isInitialized) {
            throw new Error('Phantom system not initialized. Call initializePhantomSystem() first.');
        }
        return this.phantomDetector;
    }

    /**
     * Run setup wizard
     */
    async runSetupWizard() {
        console.log('Starting Phantom Inventory Setup Wizard...');
        
        // Check if already set up
        const isComplete = await this.isSetupComplete();
        if (isComplete) {
            const currentStore = await this.getCurrentStore();
            console.log(`Setup already complete for ${currentStore.displayName}`);
            
            // Initialize system with existing configuration
            await this.initializePhantomSystem();
            return {
                alreadySetup: true,
                store: currentStore,
                phantomDetector: this.phantomDetector
            };
        }

        // Return setup options for UI
        return {
            needsSetup: true,
            storeOptions: this.getStoreOptions(),
            setupInstructions: this.getSetupInstructions()
        };
    }

    /**
     * Complete setup with selected store
     */
    async completeSetup(storeId) {
        try {
            // Select store
            const storeConfig = await this.selectStore(storeId);
            
            // Initialize phantom system
            const initResult = await this.initializePhantomSystem();
            
            console.log(`Setup completed successfully for ${storeConfig.displayName}`);
            
            return {
                success: true,
                store: storeConfig,
                phantomDetector: this.phantomDetector,
                systemStats: initResult.systemStats
            };
            
        } catch (error) {
            console.error(`Setup failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reset setup (for testing or reconfiguration)
     */
    async resetSetup() {
        try {
            await fs.unlink(this.setupFile);
            this.currentStore = null;
            this.phantomDetector = null;
            this.isInitialized = false;
            console.log('Setup reset successfully');
            return { success: true };
        } catch (error) {
            console.error(`Reset failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get setup instructions for UI
     */
    getSetupInstructions() {
        return {
            title: 'Enhanced Phantom Inventory Setup',
            description: 'Select your store to enable advanced phantom inventory detection with machine learning capabilities.',
            features: [
                'AI-powered phantom inventory detection',
                'Multi-store learning network',
                'Automated verification workflows',
                'Comprehensive reporting and analytics',
                'Seasonal and trend analysis',
                'Category-specific algorithms'
            ],
            steps: [
                'Select your store from the dropdown',
                'Click "Initialize System" to set up the phantom inventory detector',
                'The system will automatically sync with other stores in your network',
                'Start using enhanced phantom inventory detection immediately'
            ]
        };
    }

    /**
     * Get system status
     */
    async getSystemStatus() {
        const isSetup = await this.isSetupComplete();
        const currentStore = await this.getCurrentStore();
        
        const status = {
            isSetup: isSetup,
            isInitialized: this.isInitialized,
            currentStore: currentStore,
            phantomDetectorReady: this.phantomDetector !== null
        };

        if (this.isInitialized && this.phantomDetector) {
            status.systemStats = this.phantomDetector.getSystemStats();
        }

        return status;
    }

    /**
     * Schedule automatic operations after setup
     */
    async scheduleAutomaticOperations(inventoryDataCallback) {
        if (!this.isInitialized || !this.phantomDetector) {
            throw new Error('System not initialized');
        }

        this.phantomDetector.scheduleAutomaticOperations(inventoryDataCallback);
        console.log('Automatic operations scheduled');
    }

    /**
     * Generate initial system report
     */
    async generateInitialReport() {
        if (!this.isInitialized || !this.phantomDetector) {
            throw new Error('System not initialized');
        }

        const report = await this.phantomDetector.generateComprehensiveReport();
        console.log(`Initial system report generated: ${report.filename}`);
        return report;
    }
}

module.exports = PhantomSetup; 