/**
 * Quick connectivity test to run from each store location
 * Tests connection to your Digital Ocean sync server
 */

const http = require('http');

async function testStoreConnection(storeId) {
    const config = {
        serverIP: '178.128.185.6',
        port: 3000,
        apiKey: 'tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64',
        storeId: storeId
    };

    console.log(`🏪 Testing Store ${storeId} Connection to Sync Server`);
    console.log(`📡 Server: http://${config.serverIP}:${config.port}`);
    console.log('=' * 50);

    try {
        // Test 1: Health Check
        console.log('🔍 Testing server health...');
        const healthResponse = await makeRequest(config, 'GET', '/api/health');
        console.log(`✅ Server healthy - ${healthResponse.stores} stores in network`);

        // Test 2: Upload test data
        console.log('📤 Testing data upload...');
        const testData = {
            storeId: config.storeId,
            timestamp: new Date().toISOString(),
            stats: {
                totalVerifications: 10,
                accuracy: 0.9,
                categories: ['Hardware']
            }
        };
        
        const uploadResponse = await makeRequest(config, 'POST', '/api/stores/sync', testData);
        console.log('✅ Data upload successful');

        // Test 3: Download network learning
        console.log('📥 Testing network learning download...');
        const networkResponse = await makeRequest(config, 'GET', `/api/network/learning?exclude=${config.storeId}`);
        console.log(`✅ Network learning downloaded - ${networkResponse.stores.length} other stores`);

        console.log('\n🎉 ALL TESTS PASSED!');
        console.log(`Store ${storeId} can successfully sync with the network!`);
        
        return true;
    } catch (error) {
        console.log(`\n❌ CONNECTION FAILED: ${error.message}`);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check internet connection');
        console.log('2. Verify firewall allows outbound connections to port 3000');
        console.log('3. Confirm server IP is correct: 178.128.185.6');
        console.log('4. Test with: ping 178.128.185.6');
        
        return false;
    }
}

function makeRequest(config, method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: config.serverIP,
            port: config.port,
            path: endpoint,
            method: method,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': `Tink-Store-${config.storeId}`
            }
        };

        // Add auth for protected endpoints
        if (endpoint.includes('/sync') || endpoint.includes('/learning')) {
            options.headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
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

        req.on('error', error => reject(new Error(`Request failed: ${error.message}`)));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout - server may be unreachable'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Get store ID from command line or default
const storeId = process.argv[2] || '17521';
testStoreConnection(storeId);
