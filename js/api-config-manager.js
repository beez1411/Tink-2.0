/**
 * API Configuration Manager
 * Handles saving, loading, and validation of API configurations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class APIConfigManager {
    constructor() {
        this.configDir = path.join(os.homedir(), '.tink2');
        this.configFile = path.join(this.configDir, 'api-config.json');
        this.defaultConfig = {
            paladin: {
                enabled: false,
                baseURL: '',
                apiKey: '',
                username: '',
                password: '',
                storeId: '',
                timeout: 30000,
                pageSize: 100,
                maxRetries: 3,
                retryDelay: 1000,
                includeZeroStock: false,
                defaultSupplierFilter: null,
                lastTested: null,
                lastTestResult: null
            },
            general: {
                preferApiOverFiles: false,
                autoRefreshInterval: 300000, // 5 minutes
                enableCaching: true,
                cacheTimeout: 60000 // 1 minute
            }
        };
        
        this.config = { ...this.defaultConfig };
        this.loadConfig();
    }

    /**
     * Load configuration from file
     */
    loadConfig() {
        try {
            // Ensure config directory exists
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            // Load config file if it exists
            if (fs.existsSync(this.configFile)) {
                const configData = fs.readFileSync(this.configFile, 'utf8');
                const loadedConfig = JSON.parse(configData);
                
                // Merge with default config to ensure all properties exist
                this.config = this.mergeConfigs(this.defaultConfig, loadedConfig);
                
                console.log('API configuration loaded successfully');
            } else {
                console.log('No existing API configuration found, using defaults');
                this.saveConfig(); // Create default config file
            }
        } catch (error) {
            console.error('Error loading API configuration:', error);
            this.config = { ...this.defaultConfig };
        }
    }

    /**
     * Save configuration to file
     */
    saveConfig() {
        try {
            // Ensure config directory exists
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            // Save config with proper formatting
            const configData = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configFile, configData, 'utf8');
            
            console.log('API configuration saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving API configuration:', error);
            return false;
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Get Paladin API configuration
     */
    getPaladinConfig() {
        return { ...this.config.paladin };
    }

    /**
     * Update Paladin API configuration
     */
    updatePaladinConfig(updates) {
        this.config.paladin = { ...this.config.paladin, ...updates };
        return this.saveConfig();
    }

    /**
     * Get general configuration
     */
    getGeneralConfig() {
        return { ...this.config.general };
    }

    /**
     * Update general configuration
     */
    updateGeneralConfig(updates) {
        this.config.general = { ...this.config.general, ...updates };
        return this.saveConfig();
    }

    /**
     * Test API connection and save result
     */
    async testPaladinConnection(PaladinAPIClient) {
        try {
            const paladinConfig = this.getPaladinConfig();
            
            if (!this.validatePaladinConfig(paladinConfig)) {
                throw new Error('Invalid Paladin configuration');
            }

            const client = new PaladinAPIClient(paladinConfig);
            const result = await client.testConnection();
            
            // Save test result
            this.updatePaladinConfig({
                lastTested: new Date().toISOString(),
                lastTestResult: result
            });
            
            return result;
        } catch (error) {
            const errorResult = {
                success: false,
                message: error.message,
                error: error.message
            };
            
            this.updatePaladinConfig({
                lastTested: new Date().toISOString(),
                lastTestResult: errorResult
            });
            
            return errorResult;
        }
    }

    /**
     * Validate Paladin API configuration
     */
    validatePaladinConfig(config = null) {
        const paladinConfig = config || this.getPaladinConfig();
        const errors = [];

        // Check required fields
        if (!paladinConfig.baseURL) {
            errors.push('Base URL is required');
        } else {
            try {
                new URL(paladinConfig.baseURL);
            } catch (error) {
                errors.push('Invalid base URL format');
            }
        }

        // Check authentication method
        if (!paladinConfig.apiKey && (!paladinConfig.username || !paladinConfig.password)) {
            errors.push('Either API key or username/password is required');
        }

        // Check numeric values
        if (paladinConfig.timeout < 1000 || paladinConfig.timeout > 300000) {
            errors.push('Timeout must be between 1 and 300 seconds');
        }

        if (paladinConfig.pageSize < 1 || paladinConfig.pageSize > 1000) {
            errors.push('Page size must be between 1 and 1000');
        }

        if (paladinConfig.maxRetries < 0 || paladinConfig.maxRetries > 10) {
            errors.push('Max retries must be between 0 and 10');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get configuration summary for UI display
     */
    getConfigSummary() {
        const paladinConfig = this.getPaladinConfig();
        const generalConfig = this.getGeneralConfig();
        
        return {
            paladin: {
                enabled: paladinConfig.enabled,
                configured: this.validatePaladinConfig().isValid,
                baseURL: paladinConfig.baseURL,
                hasApiKey: !!paladinConfig.apiKey,
                hasCredentials: !!(paladinConfig.username && paladinConfig.password),
                storeId: paladinConfig.storeId,
                lastTested: paladinConfig.lastTested,
                lastTestResult: paladinConfig.lastTestResult
            },
            general: {
                preferApiOverFiles: generalConfig.preferApiOverFiles,
                autoRefreshInterval: generalConfig.autoRefreshInterval,
                enableCaching: generalConfig.enableCaching
            }
        };
    }

    /**
     * Reset configuration to defaults
     */
    resetConfig() {
        this.config = { ...this.defaultConfig };
        return this.saveConfig();
    }

    /**
     * Enable/disable Paladin API
     */
    setPaladinEnabled(enabled) {
        return this.updatePaladinConfig({ enabled });
    }

    /**
     * Set preference for API over files
     */
    setPreferApiOverFiles(prefer) {
        return this.updateGeneralConfig({ preferApiOverFiles: prefer });
    }

    /**
     * Get encrypted password (basic obfuscation)
     */
    getEncryptedPassword(password) {
        if (!password) return '';
        return Buffer.from(password).toString('base64');
    }

    /**
     * Get decrypted password (basic deobfuscation)
     */
    getDecryptedPassword(encryptedPassword) {
        if (!encryptedPassword) return '';
        try {
            return Buffer.from(encryptedPassword, 'base64').toString('utf8');
        } catch (error) {
            return '';
        }
    }

    /**
     * Merge configurations recursively
     */
    mergeConfigs(defaultConfig, loadedConfig) {
        const result = { ...defaultConfig };
        
        for (const key in loadedConfig) {
            if (loadedConfig.hasOwnProperty(key)) {
                if (typeof loadedConfig[key] === 'object' && loadedConfig[key] !== null && !Array.isArray(loadedConfig[key])) {
                    result[key] = this.mergeConfigs(defaultConfig[key] || {}, loadedConfig[key]);
                } else {
                    result[key] = loadedConfig[key];
                }
            }
        }
        
        return result;
    }

    /**
     * Export configuration (without sensitive data)
     */
    exportConfig() {
        const exportData = { ...this.config };
        
        // Remove sensitive data
        if (exportData.paladin) {
            exportData.paladin.password = '';
            exportData.paladin.apiKey = '';
        }
        
        return exportData;
    }

    /**
     * Import configuration
     */
    importConfig(configData) {
        try {
            const importedConfig = this.mergeConfigs(this.defaultConfig, configData);
            this.config = importedConfig;
            return this.saveConfig();
        } catch (error) {
            console.error('Error importing configuration:', error);
            return false;
        }
    }

    /**
     * Get configuration file path
     */
    getConfigPath() {
        return this.configFile;
    }

    /**
     * Check if configuration exists
     */
    configExists() {
        return fs.existsSync(this.configFile);
    }
}

module.exports = APIConfigManager; 