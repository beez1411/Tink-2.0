/**
 * Network Configuration Validator for Tink 2.0 Client Applications
 * Validates and tests network sync configuration before deployment
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

class TinkNetworkConfigValidator {
    constructor() {
        this.configPaths = {
            userConfig: path.join(os.homedir(), '.tink2', 'network-sync.json'),
            projectConfig: path.join(process.cwd(), 'config.json'),
            testConfig: path.join(process.cwd(), 'test_config.json')
        };
        
        this.validationResults = [];
        this.currentConfig = null;
    }

    /**
     * Run complete network configuration validation
     */
    async validateNetworkConfiguration() {
        console.log('🔧 Tink 2.0 Network Configuration Validator');
        console.log('=' * 50);

        const validations = [
            { name: 'Environment Variables', test: () => this.validateEnvironmentVariables() },
            { name: 'Configuration Files', test: () => this.validateConfigurationFiles() },
            { name: 'Network Config Manager', test: () => this.validateNetworkConfigManager() },
            { name: 'HTTP Sync Manager', test: () => this.validateHTTPSyncManager() },
            { name: 'Multi-Store Sync Manager', test: () => this.validateMultiStoreSyncManager() },
            { name: 'Server Connectivity', test: () => this.validateServerConnectivity() },
            { name: 'API Authentication', test: () => this.validateAPIAuthentication() },
            { name: 'Store ID Configuration', test: () => this.validateStoreIDConfiguration() },
            { name: 'Sync Dependencies', test: () => this.validateSyncDependencies() },
            { name: 'Configuration Priority', test: () => this.validateConfigurationPriority() }
        ];

        for (const validation of validations) {
            try {
                console.log(`\n🔍 Validating: ${validation.name}`);
                const result = await validation.test();
                this.logValidationResult(validation.name, true, result);
            } catch (error) {
                this.logValidationResult(validation.name, false, error.message);
            }
        }

        this.printValidationSummary();
        await this.generateConfigurationReport();
    }

    /**
     * Validate environment variables
     */
    async validateEnvironmentVariables() {
        const envVars = {
            'TINK_SYNC_URL': process.env.TINK_SYNC_URL || process.env.TINK_SYNC_BASE_URL,
            'TINK_SYNC_API_KEY': process.env.TINK_SYNC_API_KEY || process.env.TINK_API_KEY,
            'NODE_ENV': process.env.NODE_ENV
        };

        const results = ['Environment Variables:'];
        let hasRequiredVars = false;

        Object.entries(envVars).forEach(([key, value]) => {
            if (value) {
                if (key.includes('API_KEY')) {
                    results.push(`   ✅ ${key}: Set (${value.substring(0, 10)}...)`);
                } else {
                    results.push(`   ✅ ${key}: ${value}`);
                }
                if (key.includes('SYNC_URL') || key.includes('API_KEY')) {
                    hasRequiredVars = true;
                }
            } else {
                results.push(`   ⚪ ${key}: Not set`);
            }
        });

        if (hasRequiredVars) {
            results.push('   ✅ Required environment variables are configured');
        } else {
            results.push('   ⚠️ No sync environment variables set - will use config files or defaults');
        }

        return results.join('\n');
    }

    /**
     * Validate configuration files
     */
    async validateConfigurationFiles() {
        const results = ['Configuration Files:'];
        let foundConfigs = 0;

        for (const [name, configPath] of Object.entries(this.configPaths)) {
            try {
                const stats = await fs.stat(configPath);
                const content = await fs.readFile(configPath, 'utf8');
                const config = JSON.parse(content);
                
                results.push(`   ✅ ${name}: Found (${configPath})`);
                
                // Check for network sync configuration
                if (config.networkSync || config.apiBaseUrl || config.TINK_SYNC_URL) {
                    results.push(`       Contains network sync configuration`);
                    foundConfigs++;
                }
                
                if (name === 'userConfig') {
                    this.currentConfig = config;
                }
                
            } catch (error) {
                if (error.code === 'ENOENT') {
                    results.push(`   ⚪ ${name}: Not found (${configPath})`);
                } else {
                    results.push(`   ❌ ${name}: Error - ${error.message}`);
                }
            }
        }

        if (foundConfigs === 0) {
            results.push('   ⚠️ No network sync configuration found in any config file');
        }

        return results.join('\n');
    }

    /**
     * Validate NetworkConfigManager integration
     */
    async validateNetworkConfigManager() {
        try {
            // Try to load the NetworkConfigManager
            const NetworkConfigManager = require('./js/network-config-manager.js');
            const configManager = new NetworkConfigManager();
            const config = configManager.getConfig();

            const results = ['Network Config Manager:'];
            results.push(`   ✅ Module loads successfully`);
            results.push(`   Network Sync: ${config.networkSync}`);
            results.push(`   API Base URL: ${config.apiBaseUrl || 'Not set'}`);
            results.push(`   API Key: ${config.apiKey ? 'Set' : 'Not set'}`);
            results.push(`   Enabled: ${config.enabled}`);

            // Test configuration priority
            if (config.networkSync === 'local' && !config.apiBaseUrl) {
                results.push('   ✅ Correctly falling back to local sync (no URL/key configured)');
            } else if (config.networkSync === 'http' && config.apiBaseUrl && config.apiKey) {
                results.push('   ✅ HTTP sync properly configured');
            }

            return results.join('\n');
        } catch (error) {
            throw new Error(`NetworkConfigManager validation failed: ${error.message}`);
        }
    }

    /**
     * Validate HTTPSyncManager integration
     */
    async validateHTTPSyncManager() {
        try {
            const HTTPSyncManager = require('./js/http-sync-manager.js');
            
            // Test with mock configuration
            const mockConfig = {
                storeId: 'TEST_STORE',
                apiBaseUrl: 'http://test-server:3000',
                apiKey: 'test-key'
            };

            const syncManager = new HTTPSyncManager(mockConfig);
            
            const results = ['HTTP Sync Manager:'];
            results.push(`   ✅ Module loads successfully`);
            results.push(`   Store ID: ${syncManager.storeId}`);
            results.push(`   API Base URL: ${syncManager.apiBaseUrl}`);
            results.push(`   Timeout: ${syncManager.timeout}ms`);
            results.push(`   User Data Dir: ${syncManager.userDataDir}`);

            // Check if required methods exist
            const requiredMethods = ['initialize', 'testConnection', 'syncViaHTTP', 'makeRequest'];
            const missingMethods = requiredMethods.filter(method => typeof syncManager[method] !== 'function');
            
            if (missingMethods.length === 0) {
                results.push('   ✅ All required methods present');
            } else {
                results.push(`   ❌ Missing methods: ${missingMethods.join(', ')}`);
            }

            return results.join('\n');
        } catch (error) {
            throw new Error(`HTTPSyncManager validation failed: ${error.message}`);
        }
    }

    /**
     * Validate MultiStoreSyncManager integration
     */
    async validateMultiStoreSyncManager() {
        try {
            const MultiStoreSyncManager = require('./js/multi-store-sync.js');
            
            const mockConfig = {
                storeId: 'TEST_STORE',
                networkSync: 'http',
                apiBaseUrl: 'http://test-server:3000',
                apiKey: 'test-key'
            };

            const syncManager = new MultiStoreSyncManager(mockConfig);
            
            const results = ['Multi-Store Sync Manager:'];
            results.push(`   ✅ Module loads successfully`);
            results.push(`   Sync Config: ${JSON.stringify(syncManager.syncConfig, null, 2).replace(/\n/g, '\n       ')}`);

            // Check if network sync managers are initialized
            if (syncManager.httpSyncManager) {
                results.push('   ✅ HTTP sync manager initialized');
            }
            if (syncManager.cloudSyncManager) {
                results.push('   ✅ Cloud sync manager initialized');
            }

            return results.join('\n');
        } catch (error) {
            throw new Error(`MultiStoreSyncManager validation failed: ${error.message}`);
        }
    }

    /**
     * Validate server connectivity
     */
    async validateServerConnectivity() {
        // Get configuration from various sources
        const config = await this.getCurrentConfiguration();
        
        if (!config.apiBaseUrl) {
            return '⚠️ No API base URL configured - skipping connectivity test';
        }

        try {
            const response = await this.makeTestRequest(config.apiBaseUrl + '/api/health', config.apiKey);
            
            const results = ['Server Connectivity:'];
            results.push(`   ✅ Server is reachable: ${config.apiBaseUrl}`);
            results.push(`   Status: ${response.status}`);
            results.push(`   Stores: ${response.stores || 0}`);
            results.push(`   Version: ${response.version || 'Unknown'}`);
            
            if (response.uptime !== undefined) {
                results.push(`   Uptime: ${Math.floor(response.uptime)}s`);
            }

            return results.join('\n');
        } catch (error) {
            throw new Error(`Server connectivity failed: ${error.message}`);
        }
    }

    /**
     * Validate API authentication
     */
    async validateAPIAuthentication() {
        const config = await this.getCurrentConfiguration();
        
        if (!config.apiBaseUrl || !config.apiKey) {
            return '⚠️ API URL or key not configured - skipping authentication test';
        }

        const results = ['API Authentication:'];

        try {
            // Test with correct API key
            await this.makeTestRequest(config.apiBaseUrl + '/api/health', config.apiKey);
            results.push('   ✅ Valid API key accepted');

            // Test with invalid API key
            try {
                await this.makeTestRequest(config.apiBaseUrl + '/api/health', 'invalid-key');
                results.push('   ❌ Invalid API key was accepted (security issue)');
            } catch (error) {
                if (error.message.includes('401')) {
                    results.push('   ✅ Invalid API key correctly rejected');
                } else {
                    results.push(`   ⚠️ Unexpected error with invalid key: ${error.message}`);
                }
            }

            return results.join('\n');
        } catch (error) {
            throw new Error(`API authentication test failed: ${error.message}`);
        }
    }

    /**
     * Validate store ID configuration
     */
    async validateStoreIDConfiguration() {
        const config = await this.getCurrentConfiguration();
        
        const results = ['Store ID Configuration:'];
        
        // Check for store ID in various places
        const storeIdSources = [
            { name: 'Environment Variable', value: process.env.TINK_STORE_ID },
            { name: 'Config File', value: config.storeId },
            { name: 'Default Pattern', value: this.detectStoreIdFromSystem() }
        ];

        let foundStoreId = null;
        storeIdSources.forEach(source => {
            if (source.value) {
                results.push(`   ✅ ${source.name}: ${source.value}`);
                if (!foundStoreId) foundStoreId = source.value;
            } else {
                results.push(`   ⚪ ${source.name}: Not set`);
            }
        });

        if (foundStoreId) {
            // Validate store ID format
            if (/^\d{5}$/.test(foundStoreId)) {
                results.push('   ✅ Store ID format is valid (5 digits)');
            } else if (/^[A-Z0-9_]{3,20}$/.test(foundStoreId)) {
                results.push('   ✅ Store ID format is valid (alphanumeric)');
            } else {
                results.push('   ⚠️ Store ID format may be invalid');
            }
        } else {
            results.push('   ❌ No store ID configured - this is required for sync');
        }

        return results.join('\n');
    }

    /**
     * Validate sync dependencies
     */
    async validateSyncDependencies() {
        const results = ['Sync Dependencies:'];
        
        // Check for required Node.js modules
        const requiredModules = [
            'fs',
            'path',
            'os',
            'crypto',
            'https',
            'http'
        ];

        const optionalModules = [
            'express',
            'cors'
        ];

        requiredModules.forEach(moduleName => {
            try {
                require(moduleName);
                results.push(`   ✅ ${moduleName}: Available`);
            } catch (error) {
                results.push(`   ❌ ${moduleName}: Missing (required)`);
            }
        });

        optionalModules.forEach(moduleName => {
            try {
                require(moduleName);
                results.push(`   ✅ ${moduleName}: Available`);
            } catch (error) {
                results.push(`   ⚪ ${moduleName}: Not available (optional)`);
            }
        });

        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
        
        if (majorVersion >= 16) {
            results.push(`   ✅ Node.js version: ${nodeVersion} (compatible)`);
        } else {
            results.push(`   ⚠️ Node.js version: ${nodeVersion} (may have compatibility issues)`);
        }

        return results.join('\n');
    }

    /**
     * Validate configuration priority order
     */
    async validateConfigurationPriority() {
        const results = ['Configuration Priority:'];
        
        // Test priority order: Environment > User Config > Defaults
        const testUrl = 'http://test-priority.example.com';
        const testKey = 'test-priority-key';
        
        // Set test environment variables
        const originalUrl = process.env.TINK_SYNC_URL;
        const originalKey = process.env.TINK_SYNC_API_KEY;
        
        process.env.TINK_SYNC_URL = testUrl;
        process.env.TINK_SYNC_API_KEY = testKey;
        
        try {
            // Reload NetworkConfigManager to pick up env vars
            delete require.cache[require.resolve('./js/network-config-manager.js')];
            const NetworkConfigManager = require('./js/network-config-manager.js');
            const configManager = new NetworkConfigManager();
            const config = configManager.getConfig();
            
            if (config.apiBaseUrl === testUrl && config.apiKey === testKey) {
                results.push('   ✅ Environment variables take priority');
            } else {
                results.push('   ❌ Environment variables not taking priority');
            }
            
        } finally {
            // Restore original environment variables
            if (originalUrl) {
                process.env.TINK_SYNC_URL = originalUrl;
            } else {
                delete process.env.TINK_SYNC_URL;
            }
            
            if (originalKey) {
                process.env.TINK_SYNC_API_KEY = originalKey;
            } else {
                delete process.env.TINK_SYNC_API_KEY;
            }
        }

        results.push('   ✅ Configuration priority validation complete');
        return results.join('\n');
    }

    /**
     * Get current configuration from all sources
     */
    async getCurrentConfiguration() {
        // Try NetworkConfigManager first
        try {
            const NetworkConfigManager = require('./js/network-config-manager.js');
            const configManager = new NetworkConfigManager();
            return configManager.getConfig();
        } catch (error) {
            // Fallback to manual configuration detection
            return {
                apiBaseUrl: process.env.TINK_SYNC_URL || process.env.TINK_SYNC_BASE_URL || '',
                apiKey: process.env.TINK_SYNC_API_KEY || process.env.TINK_API_KEY || '',
                storeId: process.env.TINK_STORE_ID || '',
                networkSync: 'local'
            };
        }
    }

    /**
     * Detect store ID from system
     */
    detectStoreIdFromSystem() {
        // Try to detect from hostname, user directory, or other system info
        const hostname = os.hostname();
        const username = os.userInfo().username;
        
        // Look for patterns like STORE17521, POS18179, etc.
        const storeIdMatch = hostname.match(/(\d{5})/);
        if (storeIdMatch) {
            return storeIdMatch[1];
        }
        
        return null;
    }

    /**
     * Make test HTTP request
     */
    async makeTestRequest(url, apiKey) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const httpModule = urlObj.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                timeout: 10000,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'User-Agent': 'Tink-Config-Validator'
                }
            };
            
            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${response.error || 'Unknown error'}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse response: ${parseError.message}`));
                    }
                });
            });
            
            req.on('error', error => reject(new Error(`Request failed: ${error.message}`)));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    /**
     * Log validation result
     */
    logValidationResult(testName, success, message) {
        const status = success ? '✅ PASS' : '❌ FAIL';
        const result = { testName, success, message };
        this.validationResults.push(result);
        
        console.log(`   ${status}: ${message.split('\n')[0]}`);
        if (message.includes('\n')) {
            const additionalLines = message.split('\n').slice(1);
            additionalLines.forEach(line => {
                if (line.trim()) console.log(`       ${line}`);
            });
        }
    }

    /**
     * Print validation summary
     */
    printValidationSummary() {
        const totalValidations = this.validationResults.length;
        const passedValidations = this.validationResults.filter(r => r.success).length;
        const failedValidations = totalValidations - passedValidations;

        console.log('\n' + '=' * 50);
        console.log('📊 VALIDATION SUMMARY');
        console.log('=' * 50);
        console.log(`Total Validations: ${totalValidations}`);
        console.log(`✅ Passed: ${passedValidations}`);
        console.log(`❌ Failed: ${failedValidations}`);
        console.log(`Success Rate: ${((passedValidations / totalValidations) * 100).toFixed(1)}%`);

        if (failedValidations > 0) {
            console.log('\n🚨 VALIDATION FAILURES:');
            this.validationResults
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.testName}: ${r.message}`));
        }

        if (passedValidations === totalValidations) {
            console.log('\n🎉 ALL VALIDATIONS PASSED! Your network configuration is ready.');
        } else {
            console.log('\n⚠️ Some validations failed. Please address the issues above.');
        }
    }

    /**
     * Generate configuration report
     */
    async generateConfigurationReport() {
        const config = await this.getCurrentConfiguration();
        
        const report = {
            timestamp: new Date().toISOString(),
            hostname: os.hostname(),
            platform: os.platform(),
            nodeVersion: process.version,
            currentConfiguration: config,
            validationResults: this.validationResults,
            summary: {
                total: this.validationResults.length,
                passed: this.validationResults.filter(r => r.success).length,
                failed: this.validationResults.filter(r => !r.success).length
            },
            recommendations: this.generateRecommendations()
        };

        const reportPath = 'network-config-validation-report.json';
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Configuration report saved to: ${reportPath}`);
    }

    /**
     * Generate configuration recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        const failedValidations = this.validationResults.filter(r => !r.success);
        
        if (failedValidations.some(v => v.testName === 'Server Connectivity')) {
            recommendations.push('Configure a valid API base URL and ensure the sync server is running');
        }
        
        if (failedValidations.some(v => v.testName === 'Store ID Configuration')) {
            recommendations.push('Set a unique store ID using environment variable TINK_STORE_ID or config file');
        }
        
        if (failedValidations.some(v => v.testName === 'API Authentication')) {
            recommendations.push('Verify the API key matches the server configuration');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Configuration looks good! Ready for production deployment.');
        }
        
        return recommendations;
    }
}

// Export for use in other scripts
module.exports = TinkNetworkConfigValidator;

// Run validator if this script is executed directly
if (require.main === module) {
    const validator = new TinkNetworkConfigValidator();
    validator.validateNetworkConfiguration().catch(console.error);
}
