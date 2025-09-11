/**
 * Server Cleanup Script - Wipe Test Data from Digital Ocean Sync Server
 * This will reset the server to a clean state for production deployment
 */

const http = require('http');

class ServerCleanup {
    constructor() {
        this.serverIP = '178.128.185.6';
        this.port = 3000;
        this.apiKey = 'tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64';
        this.baseUrl = `http://${this.serverIP}:${this.port}`;
    }

    async cleanupServer() {
        console.log('🧹 Cleaning up Digital Ocean Sync Server');
        console.log(`📡 Server: ${this.baseUrl}`);
        console.log('=' * 50);

        try {
            // First, get list of all stores
            console.log('📋 Getting current store list...');
            const storeList = await this.getStoreList();
            
            if (storeList.length === 0) {
                console.log('✅ Server is already clean - no stores to remove');
                return;
            }

            console.log(`Found ${storeList.length} stores to clean up:`);
            storeList.forEach((store, i) => {
                console.log(`  ${i+1}. ${store.storeId} (${store.stats.totalVerifications} verifications)`);
            });

            console.log('\n🗑️ Removing all test stores...');
            
            // Delete each store
            for (const store of storeList) {
                try {
                    await this.deleteStore(store.storeId);
                    console.log(`   ✅ Deleted: ${store.storeId}`);
                } catch (error) {
                    console.log(`   ❌ Failed to delete ${store.storeId}: ${error.message}`);
                }
            }

            // Verify cleanup
            console.log('\n🔍 Verifying cleanup...');
            const finalCheck = await this.getServerHealth();
            console.log(`✅ Cleanup complete! Server now has ${finalCheck.stores} stores`);
            
            if (finalCheck.stores === 0) {
                console.log('🎉 Server is completely clean and ready for production deployment!');
            } else {
                console.log('⚠️ Some stores may still remain - check server manually');
            }

        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }

    async getStoreList() {
        const response = await this.makeRequest('GET', '/api/network/learning');
        return response.stores || [];
    }

    async getServerHealth() {
        return await this.makeRequest('GET', '/api/health');
    }

    async deleteStore(storeId) {
        return await this.makeRequest('DELETE', `/api/stores/${storeId}`);
    }

    async makeRequest(method, endpoint, data = null) {
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
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'Tink-Server-Cleanup'
                }
            };
            
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
}

// Run cleanup
const cleanup = new ServerCleanup();
cleanup.cleanupServer().catch(console.error);
