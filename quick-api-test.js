/**
 * Quick API test to understand what endpoints are available
 */

const http = require('http');

async function testAPI(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '178.128.185.6',
            port: 3000,
            path: endpoint,
            method: method,
            headers: {
                'Authorization': 'Bearer tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64',
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                console.log(`\n${method} ${endpoint}:`);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${responseData}`);
                resolve({ status: res.statusCode, data: responseData });
            });
        });

        req.on('error', (error) => {
            console.log(`Error: ${error.message}`);
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runQuickTests() {
    console.log('🔍 Testing Current Server API Endpoints');
    console.log('=' * 40);

    try {
        // Test basic endpoints
        await testAPI('/api/health');
        await testAPI('/api/stores');
        await testAPI('/api/network/learning');
        
        // Test with invalid API key
        console.log('\n🔒 Testing Authentication:');
        const options = {
            hostname: '178.128.185.6',
            port: 3000,
            path: '/api/health',
            method: 'GET',
            headers: {
                'Authorization': 'Bearer invalid-key',
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                console.log(`\nInvalid API Key Test:`);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${responseData}`);
            });
        });

        req.on('error', (error) => {
            console.log(`Error with invalid key: ${error.message}`);
        });

        req.end();

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

runQuickTests();
