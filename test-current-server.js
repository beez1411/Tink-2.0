/**
 * Test script specifically for your current compact Tink ML sync server
 * Tests the actual endpoints and functionality that exist
 */

const http = require('http');

class CurrentServerTester {
    constructor() {
        this.dropletIP = '178.128.185.6';
        this.apiKey = 'tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64';
        this.port = 3000;
        this.baseUrl = `http://${this.dropletIP}:${this.port}`;
        this.testResults = [];
    }

    async runAllTests() {
        console.log('🚀 Testing Your Current Tink ML Sync Server');
        console.log(`📡 Server: ${this.baseUrl}`);
        console.log('=' * 50);

        const tests = [
            { name: 'Health Check (No Auth)', test: () => this.testHealthCheck() },
            { name: 'Authentication Test', test: () => this.testAuthentication() },
            { name: 'Store Data Upload', test: () => this.testStoreUpload() },
            { name: 'Network Learning Download', test: () => this.testNetworkDownload() },
            { name: 'Multi-Store Scenario', test: () => this.testMultiStoreScenario() },
            { name: 'Server Performance', test: () => this.testPerformance() }
        ];

        for (const test of tests) {
            try {
                console.log(`\n🧪 ${test.name}:`);
                const result = await test.test();
                this.logResult(test.name, true, result);
            } catch (error) {
                this.logResult(test.name, false, error.message);
            }
        }

        this.printSummary();
    }

    async testHealthCheck() {
        const response = await this.makeRequest('GET', '/api/health');
        
        if (response.status === 'healthy' && typeof response.stores === 'number') {
            return `✅ Health check working - ${response.stores} stores registered`;
        }
        throw new Error('Health check failed or invalid response');
    }

    async testAuthentication() {
        // Test with valid API key
        const validResponse = await this.makeRequest('POST', '/api/stores/sync', {
            storeId: 'AUTH_TEST_STORE',
            stats: { totalVerifications: 1, accuracy: 1.0 }
        });

        // Test with invalid API key
        try {
            await this.makeRequest('POST', '/api/stores/sync', {
                storeId: 'AUTH_TEST_STORE_2'
            }, 'invalid-key');
            throw new Error('Invalid API key was accepted');
        } catch (error) {
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                return '✅ Authentication working correctly - valid key accepted, invalid rejected';
            }
            throw error;
        }
    }

    async testStoreUpload() {
        const testData = {
            storeId: 'TEST_UPLOAD_STORE',
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

        const response = await this.makeRequest('POST', '/api/stores/sync', testData);
        
        if (response.success) {
            return '✅ Store data uploaded successfully';
        }
        throw new Error('Store upload failed');
    }

    async testNetworkDownload() {
        const response = await this.makeRequest('GET', '/api/network/learning?exclude=TEST_DOWNLOAD_STORE');
        
        if (response.success && response.consolidatedLearning && Array.isArray(response.stores)) {
            const totalVerifications = response.consolidatedLearning.totalVerifications || 0;
            const storeCount = response.stores.length;
            const networkAccuracy = (response.consolidatedLearning.networkAccuracy * 100).toFixed(1);
            
            return `✅ Network learning downloaded - ${storeCount} stores, ${totalVerifications} verifications, ${networkAccuracy}% accuracy`;
        }
        throw new Error('Network learning download failed or invalid response');
    }

    async testMultiStoreScenario() {
        const stores = ['MULTI_STORE_A', 'MULTI_STORE_B', 'MULTI_STORE_C'];
        const results = [];

        // Upload data for multiple stores
        for (const storeId of stores) {
            const storeData = {
                storeId: storeId,
                timestamp: new Date().toISOString(),
                categoryPatterns: [
                    ['Hardware', { totalVerifications: 25, correctPredictions: 20, avgDiscrepancy: 1.1 }]
                ],
                modelWeights: {
                    seasonalWeight: Math.random() * 0.5,
                    trendWeight: Math.random() * 0.5
                },
                stats: {
                    totalVerifications: 25,
                    accuracy: 0.8,
                    categories: ['Hardware']
                }
            };

            const uploadResult = await this.makeRequest('POST', '/api/stores/sync', storeData);
            results.push(uploadResult.success);
        }

        // Verify each store can see the others
        for (const storeId of stores) {
            const networkData = await this.makeRequest('GET', `/api/network/learning?exclude=${storeId}`);
            const otherStores = networkData.stores.filter(store => stores.includes(store.storeId) && store.storeId !== storeId);
            
            if (otherStores.length < stores.length - 1) {
                throw new Error(`Store ${storeId} not seeing all other test stores`);
            }
        }

        const allUploaded = results.every(r => r === true);
        if (allUploaded) {
            return `✅ Multi-store scenario successful - ${stores.length} stores syncing correctly`;
        }
        throw new Error('Some store uploads failed in multi-store test');
    }

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

        if (avgTime > 2000) {
            throw new Error(`Performance issue: Average response time ${avgTime}ms`);
        }

        return `✅ Performance excellent - Avg: ${avgTime.toFixed(1)}ms, Min: ${minTime}ms, Max: ${maxTime}ms`;
    }

    async makeRequest(method, endpoint, data = null, apiKey = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + endpoint);
            
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Tink-Current-Server-Tester'
                }
            };

            // Add auth header for protected endpoints
            if (endpoint.includes('/sync') || endpoint.includes('/learning')) {
                options.headers['Authorization'] = `Bearer ${apiKey || this.apiKey}`;
            }
            
            const req = http.request(options, (res) => {
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

    logResult(testName, success, message) {
        const status = success ? '✅ PASS' : '❌ FAIL';
        this.testResults.push({ testName, success, message });
        console.log(`   ${status}: ${message}`);
    }

    printSummary() {
        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.success).length;
        const failed = total - passed;

        console.log('\n' + '=' * 50);
        console.log('📊 TEST SUMMARY');
        console.log('=' * 50);
        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\n🚨 FAILED TESTS:');
            this.testResults
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.testName}: ${r.message}`));
        }

        if (passed === total) {
            console.log('\n🎉 ALL TESTS PASSED! Your server is working perfectly!');
            console.log('\n🚀 NEXT STEPS:');
            console.log('1. Configure your Tink 2.0 clients to use this server');
            console.log('2. Set environment variables on each store machine:');
            console.log('   TINK_SYNC_URL=http://178.128.185.6:3000');
            console.log('   TINK_SYNC_API_KEY=tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64');
            console.log('   TINK_STORE_ID=17521 (unique for each store)');
            console.log('3. Test from your actual store locations');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the errors above.');
        }
    }
}

// Run the tests
const tester = new CurrentServerTester();
tester.runAllTests().catch(console.error);
