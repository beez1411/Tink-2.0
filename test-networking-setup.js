/**
 * Comprehensive Network Testing Script for Tink 2.0 ML Sync
 * Tests the Digital Ocean droplet sync server from local machine
 */

const https = require('https');
const http = require('http');

class TinkNetworkTester {
    constructor(config = {}) {
        // Updated with actual droplet details
        this.dropletIP = config.dropletIP || '178.128.185.6';
        this.apiKey = config.apiKey || 'tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64';
        this.port = config.port || 3000;
        this.baseUrl = `http://${this.dropletIP}:${this.port}`;
        
        this.testResults = [];
    }

    /**
     * Run all network tests
     */
    async runAllTests() {
        console.log('🚀 Starting Tink 2.0 Network Testing Suite');
        console.log(`📡 Testing server: ${this.baseUrl}`);
        console.log(`🔑 Using API key: ${this.apiKey.substring(0, 10)}...`);
        console.log('=' * 60);

        const tests = [
            { name: 'Basic Connectivity', test: () => this.testBasicConnectivity() },
            { name: 'Health Check', test: () => this.testHealthCheck() },
            { name: 'API Authentication', test: () => this.testAuthentication() },
            { name: 'Store Data Upload', test: () => this.testStoreDataUpload() },
            { name: 'Network Learning Download', test: () => this.testNetworkLearningDownload() },
            { name: 'Multiple Store Simulation', test: () => this.testMultipleStores() },
            { name: 'Error Handling', test: () => this.testErrorHandling() },
            { name: 'Performance Test', test: () => this.testPerformance() }
        ];

        for (const testCase of tests) {
            try {
                console.log(`\n🧪 Running: ${testCase.name}`);
                const result = await testCase.test();
                this.logTestResult(testCase.name, true, result);
            } catch (error) {
                this.logTestResult(testCase.name, false, error.message);
            }
        }

        this.printSummary();
    }

    /**
     * Test basic network connectivity to droplet
     */
    async testBasicConnectivity() {
        const response = await this.makeRequest('GET', '/api/health');
        if (response.status === 'healthy') {
            return `✅ Server is reachable and responding`;
        }
        throw new Error('Server not responding correctly');
    }

    /**
     * Test health check endpoint
     */
    async testHealthCheck() {
        const response = await this.makeRequest('GET', '/api/health');
        
        const requiredFields = ['status', 'timestamp', 'stores', 'version', 'uptime'];
        const missingFields = requiredFields.filter(field => !(field in response));
        
        if (missingFields.length > 0) {
            throw new Error(`Missing health check fields: ${missingFields.join(', ')}`);
        }

        return `✅ Health check complete - ${response.stores} stores, uptime: ${Math.floor(response.uptime)}s`;
    }

    /**
     * Test API key authentication
     */
    async testAuthentication() {
        // Test with correct API key
        const validResponse = await this.makeRequest('GET', '/api/health');
        if (!validResponse.status) {
            throw new Error('Valid API key was rejected');
        }

        // Test with invalid API key
        try {
            await this.makeRequest('GET', '/api/health', null, 'invalid-key');
            throw new Error('Invalid API key was accepted');
        } catch (error) {
            if (error.message.includes('401')) {
                return '✅ Authentication working correctly';
            }
            throw error;
        }
    }

    /**
     * Test uploading store ML data
     */
    async testStoreDataUpload() {
        const testStoreData = {
            storeId: 'TEST_STORE_001',
            timestamp: new Date().toISOString(),
            verificationResults: [
                ['SKU123', { predicted: 10, actual: 12, accuracy: 0.83 }],
                ['SKU456', { predicted: 5, actual: 5, accuracy: 1.0 }]
            ],
            categoryPatterns: [
                ['Hardware', { totalVerifications: 50, correctPredictions: 42, avgDiscrepancy: 1.2 }],
                ['Tools', { totalVerifications: 30, correctPredictions: 28, avgDiscrepancy: 0.8 }]
            ],
            modelWeights: {
                seasonalWeight: 0.3,
                trendWeight: 0.4,
                categoryWeight: 0.3
            },
            stats: {
                totalVerifications: 80,
                accuracy: 0.875,
                categories: ['Hardware', 'Tools']
            }
        };

        const response = await this.makeRequest('POST', '/api/stores/sync', testStoreData);
        
        if (response.success && response.message.includes('TEST_STORE_001')) {
            return `✅ Store data uploaded successfully - ${response.networkStores} stores in network`;
        }
        
        throw new Error('Store data upload failed');
    }

    /**
     * Test downloading network learning data
     */
    async testNetworkLearningDownload() {
        const response = await this.makeRequest('GET', '/api/network/learning?exclude=TEST_STORE_001');
        
        const requiredFields = ['success', 'consolidatedLearning', 'stores', 'networkStats'];
        const missingFields = requiredFields.filter(field => !(field in response));
        
        if (missingFields.length > 0) {
            throw new Error(`Missing network learning fields: ${missingFields.join(', ')}`);
        }

        return `✅ Network learning downloaded - ${response.stores.length} other stores, ${response.networkStats.totalVerifications} total verifications`;
    }

    /**
     * Test multiple store simulation
     */
    async testMultipleStores() {
        const stores = ['STORE_17521', 'STORE_18179', 'STORE_18181'];
        const uploadResults = [];

        for (const storeId of stores) {
            const storeData = this.generateMockStoreData(storeId);
            const response = await this.makeRequest('POST', '/api/stores/sync', storeData);
            uploadResults.push(response.success);
        }

        const allSuccessful = uploadResults.every(result => result === true);
        if (!allSuccessful) {
            throw new Error('Some store uploads failed');
        }

        // Test that each store can download data from others
        for (const storeId of stores) {
            const networkData = await this.makeRequest('GET', `/api/network/learning?exclude=${storeId}`);
            const otherStores = networkData.stores.filter(store => store.storeId !== storeId);
            
            if (otherStores.length !== stores.length - 1) {
                throw new Error(`Store ${storeId} not seeing correct number of other stores`);
            }
        }

        return `✅ Multi-store simulation successful - ${stores.length} stores syncing correctly`;
    }

    /**
     * Test error handling
     */
    async testErrorHandling() {
        const errorTests = [
            {
                name: 'Missing Store ID',
                request: () => this.makeRequest('POST', '/api/stores/sync', { timestamp: new Date().toISOString() }),
                expectedError: '400'
            },
            {
                name: 'Invalid Endpoint',
                request: () => this.makeRequest('GET', '/api/invalid-endpoint'),
                expectedError: '404'
            },
            {
                name: 'Malformed JSON',
                request: () => this.makeRawRequest('POST', '/api/stores/sync', 'invalid-json'),
                expectedError: '400'
            }
        ];

        const results = [];
        for (const errorTest of errorTests) {
            try {
                await errorTest.request();
                results.push(`❌ ${errorTest.name}: Should have failed`);
            } catch (error) {
                if (error.message.includes(errorTest.expectedError)) {
                    results.push(`✅ ${errorTest.name}: Correctly handled`);
                } else {
                    results.push(`⚠️ ${errorTest.name}: Unexpected error - ${error.message}`);
                }
            }
        }

        return results.join('\n   ');
    }

    /**
     * Test server performance
     */
    async testPerformance() {
        const iterations = 10;
        const times = [];

        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            await this.makeRequest('GET', '/api/health');
            const endTime = Date.now();
            times.push(endTime - startTime);
        }

        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        if (avgTime > 1000) {
            throw new Error(`Performance issue: Average response time ${avgTime}ms`);
        }

        return `✅ Performance test passed - Avg: ${avgTime.toFixed(1)}ms, Min: ${minTime}ms, Max: ${maxTime}ms`;
    }

    /**
     * Generate mock store data for testing
     */
    generateMockStoreData(storeId) {
        const categories = ['Hardware', 'Tools', 'Plumbing', 'Electrical', 'Garden'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        
        return {
            storeId: storeId,
            timestamp: new Date().toISOString(),
            verificationResults: [
                [`SKU${Math.floor(Math.random() * 1000)}`, { 
                    predicted: Math.floor(Math.random() * 20), 
                    actual: Math.floor(Math.random() * 20), 
                    accuracy: Math.random() 
                }]
            ],
            categoryPatterns: [
                [randomCategory, { 
                    totalVerifications: Math.floor(Math.random() * 100) + 10, 
                    correctPredictions: Math.floor(Math.random() * 80) + 5, 
                    avgDiscrepancy: Math.random() * 2 
                }]
            ],
            modelWeights: {
                seasonalWeight: Math.random() * 0.5,
                trendWeight: Math.random() * 0.5,
                categoryWeight: Math.random() * 0.5
            },
            stats: {
                totalVerifications: Math.floor(Math.random() * 200) + 50,
                accuracy: Math.random(),
                categories: [randomCategory]
            }
        };
    }

    /**
     * Make HTTP request to sync server
     */
    async makeRequest(method, endpoint, data = null, apiKey = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + endpoint);
            const httpModule = url.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey || this.apiKey}`,
                    'User-Agent': 'Tink-Network-Tester'
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
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    /**
     * Make raw HTTP request (for testing malformed data)
     */
    async makeRawRequest(method, endpoint, rawData) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + endpoint);
            const httpModule = url.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'Tink-Network-Tester'
                }
            };
            
            const req = httpModule.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(responseData);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });
            
            req.on('error', (error) => reject(new Error(`Request failed: ${error.message}`)));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.write(rawData);
            req.end();
        });
    }

    /**
     * Log test result
     */
    logTestResult(testName, success, message) {
        const status = success ? '✅ PASS' : '❌ FAIL';
        const result = { testName, success, message };
        this.testResults.push(result);
        
        console.log(`   ${status}: ${message}`);
    }

    /**
     * Print test summary
     */
    printSummary() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;

        console.log('\n' + '=' * 60);
        console.log('📊 TEST SUMMARY');
        console.log('=' * 60);
        console.log(`Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\n🚨 FAILED TESTS:');
            this.testResults
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.testName}: ${r.message}`));
        }

        if (passedTests === totalTests) {
            console.log('\n🎉 ALL TESTS PASSED! Your networking setup is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the errors above and verify your server configuration.');
        }
    }
}

// Export for use in other scripts
module.exports = TinkNetworkTester;

// Run tests if this script is executed directly
if (require.main === module) {
    console.log('⚠️ CONFIGURATION REQUIRED:');
    console.log('Please update the dropletIP and apiKey in this script before running tests.');
    console.log('');
    console.log('Example usage:');
    console.log('const tester = new TinkNetworkTester({');
    console.log('    dropletIP: "YOUR_ACTUAL_DROPLET_IP",');
    console.log('    apiKey: "YOUR_ACTUAL_API_KEY"');
    console.log('});');
    console.log('tester.runAllTests();');
}
