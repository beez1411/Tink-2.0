# 🧪 Tink 2.0 Networking Testing Instructions

## 📋 Overview

This guide provides step-by-step instructions to test the multi-location networking functionality of Tink 2.0 on your Digital Ocean droplet. We'll verify that stores can sync ML learning data across different locations.

## 🎯 What We're Testing

- ✅ **Server Health**: Digital Ocean droplet is running correctly
- ✅ **API Connectivity**: Local machines can reach the sync server
- ✅ **Authentication**: API key security is working
- ✅ **Data Sync**: ML data uploads and downloads correctly
- ✅ **Multi-Store**: Multiple stores can sync simultaneously
- ✅ **Error Handling**: System handles failures gracefully
- ✅ **Performance**: Response times are acceptable

## 🚀 Prerequisites

Before starting, ensure you have:

1. **Digital Ocean Droplet** running with Tink ML sync server
2. **SSH access** to your droplet
3. **Node.js** installed on your local testing machine
4. **API key** from your droplet's `.env` file
5. **Droplet IP address**

## 📝 Step-by-Step Testing Process

### **Phase 1: Server Health Check (On Droplet)**

First, let's verify your server is healthy.

#### 1.1 SSH into Your Droplet
```bash
ssh root@YOUR_DROPLET_IP
```

#### 1.2 Run Server Diagnostics
```bash
cd "/opt/Tink 2.0"
node server-diagnostics.js
```

**Expected Output:**
- ✅ All system checks should pass
- ✅ PM2 process should be running
- ✅ Port 3000 should be listening
- ✅ Data directory should exist

**If any checks fail:**
- Check PM2 status: `pm2 status`
- View logs: `pm2 logs tink-ml-sync`
- Restart if needed: `pm2 restart tink-ml-sync`

#### 1.3 Test Local Server Connection
```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "stores": 0,
  "version": "1.0",
  "uptime": 123.45
}
```

### **Phase 2: Network Connectivity (From Your Local Machine)**

Now test from your local development machine.

#### 2.1 Download Testing Scripts
On your local machine, in your Tink 2.0 project directory:

```bash
# The testing scripts should already be in your project
# If not, make sure you have:
# - test-networking-setup.js
# - validate-network-config.js
# - test-data-generator.js
```

#### 2.2 Configure Test Parameters
Edit `test-networking-setup.js` and update these values:

```javascript
const tester = new TinkNetworkTester({
    dropletIP: 'YOUR_ACTUAL_DROPLET_IP',    // Replace with your droplet IP
    apiKey: 'YOUR_ACTUAL_API_KEY'           // Replace with your API key from .env
});
```

**To find your API key:**
```bash
# On your droplet:
cat "/opt/Tink 2.0/.env" | grep API_KEY
```

#### 2.3 Run Network Tests
```bash
node test-networking-setup.js
```

**Expected Results:**
- ✅ Basic Connectivity: Server responds
- ✅ Health Check: All required fields present
- ✅ API Authentication: Valid key accepted, invalid rejected
- ✅ Store Data Upload: Test data uploads successfully
- ✅ Network Learning Download: Can retrieve consolidated data
- ✅ Multiple Store Simulation: Multiple stores sync correctly
- ✅ Error Handling: Invalid requests properly rejected
- ✅ Performance Test: Response times under 1000ms

### **Phase 3: Configuration Validation**

#### 3.1 Validate Client Configuration
```bash
node validate-network-config.js
```

This will check:
- Environment variables
- Configuration files
- Module loading
- Store ID setup
- Dependencies

#### 3.2 Fix Any Configuration Issues

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| No store ID configured | Set `TINK_STORE_ID=17521` environment variable |
| API URL not set | Set `TINK_SYNC_URL=http://YOUR_DROPLET_IP:3000` |
| API key missing | Set `TINK_SYNC_API_KEY=your-api-key` |
| Module not found | Run `npm install` in project directory |

### **Phase 4: End-to-End Testing**

#### 4.1 Generate Test Data
```bash
node test-data-generator.js complete
```

This creates realistic ML data for testing.

#### 4.2 Test Multi-Store Sync Simulation

Create a test script `test-multi-store.js`:

```javascript
const TinkNetworkTester = require('./test-networking-setup.js');

async function testMultiStoreSync() {
    const tester = new TinkNetworkTester({
        dropletIP: 'YOUR_DROPLET_IP',
        apiKey: 'YOUR_API_KEY'
    });

    console.log('🏪 Testing Multi-Store Sync Scenario');
    
    // Simulate 4 stores syncing
    const stores = ['17521', '18179', '18181', '19001'];
    
    for (const storeId of stores) {
        console.log(`\n📊 Syncing store ${storeId}...`);
        
        // Generate and upload store data
        const storeData = tester.generateMockStoreData(storeId);
        const uploadResult = await tester.makeRequest('POST', '/api/stores/sync', storeData);
        
        console.log(`   ✅ Upload: ${uploadResult.success ? 'Success' : 'Failed'}`);
        
        // Download network learning
        const downloadResult = await tester.makeRequest('GET', `/api/network/learning?exclude=${storeId}`);
        
        console.log(`   ✅ Download: Found ${downloadResult.stores.length} other stores`);
    }
    
    console.log('\n🎉 Multi-store sync test complete!');
}

testMultiStoreSync().catch(console.error);
```

Run the test:
```bash
node test-multi-store.js
```

### **Phase 5: Production Readiness Check**

#### 5.1 Performance Test
```bash
# Generate performance test data
node test-data-generator.js performance 10 500

# This creates data for 10 stores with 500 verifications each
```

#### 5.2 Load Test (Optional)
Create `load-test.js`:

```javascript
const TinkNetworkTester = require('./test-networking-setup.js');

async function loadTest() {
    const tester = new TinkNetworkTester({
        dropletIP: 'YOUR_DROPLET_IP',
        apiKey: 'YOUR_API_KEY'
    });

    const concurrentRequests = 10;
    const promises = [];

    console.log(`🚀 Running load test with ${concurrentRequests} concurrent requests...`);

    for (let i = 0; i < concurrentRequests; i++) {
        promises.push(tester.makeRequest('GET', '/api/health'));
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();

    console.log(`✅ All ${results.length} requests completed in ${endTime - startTime}ms`);
    console.log(`Average: ${(endTime - startTime) / results.length}ms per request`);
}

loadTest().catch(console.error);
```

#### 5.3 Security Test
```bash
# Test with invalid API key
curl -H "Authorization: Bearer invalid-key" http://YOUR_DROPLET_IP:3000/api/health

# Should return 401 Unauthorized
```

## 🔧 Troubleshooting Guide

### **Server Not Responding**

1. **Check PM2 Status:**
   ```bash
   pm2 status
   pm2 logs tink-ml-sync
   ```

2. **Check Firewall:**
   ```bash
   ufw status
   # Should show port 3000 as allowed
   ```

3. **Check Process:**
   ```bash
   netstat -tlnp | grep :3000
   ```

### **Authentication Failures**

1. **Verify API Key:**
   ```bash
   cat "/opt/Tink 2.0/.env" | grep API_KEY
   ```

2. **Test API Key Format:**
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" http://YOUR_DROPLET_IP:3000/api/health
   ```

### **Connection Timeouts**

1. **Check Network Connectivity:**
   ```bash
   ping YOUR_DROPLET_IP
   telnet YOUR_DROPLET_IP 3000
   ```

2. **Check DigitalOcean Firewall:**
   - Log into DigitalOcean dashboard
   - Check droplet firewall settings
   - Ensure port 3000 is open

### **Data Sync Issues**

1. **Check Data Directory:**
   ```bash
   ls -la /opt/tink-ml-data/
   cat /opt/tink-ml-data/stores.json
   ```

2. **Monitor Real-time Logs:**
   ```bash
   pm2 logs tink-ml-sync --lines 50
   ```

## ✅ Success Criteria

Your networking setup is working correctly when:

- [ ] **Server Diagnostics**: All checks pass
- [ ] **Network Tests**: All 8 tests pass with 100% success rate
- [ ] **Configuration Validation**: All validations pass
- [ ] **Multi-Store Sync**: 4+ stores can sync simultaneously
- [ ] **Performance**: Average response time < 500ms
- [ ] **Security**: Invalid API keys are rejected
- [ ] **Error Handling**: Malformed requests return appropriate errors

## 📊 Expected Performance Benchmarks

| Metric | Target | Acceptable |
|--------|--------|------------|
| Health Check Response | < 100ms | < 500ms |
| Store Data Upload | < 200ms | < 1000ms |
| Network Learning Download | < 300ms | < 1500ms |
| Concurrent Requests (10) | < 1000ms total | < 3000ms total |
| Server Uptime | 99.9% | 99% |

## 🎉 Next Steps After Successful Testing

Once all tests pass:

1. **Configure Production Stores:**
   - Set environment variables on each store's machine
   - Update store IDs to be unique
   - Test from actual store locations

2. **Set Up Monitoring:**
   - Configure log rotation
   - Set up uptime monitoring
   - Create backup procedures

3. **Deploy to Additional Stores:**
   - Update Tink 2.0 installations
   - Configure network sync settings
   - Test cross-store learning

## 📞 Support

If you encounter issues during testing:

1. **Save Diagnostic Reports:**
   - `network-config-validation-report.json`
   - `/tmp/tink-server-diagnostics.json`
   - PM2 logs: `pm2 logs tink-ml-sync > sync-logs.txt`

2. **Document the Issue:**
   - What test failed?
   - Error messages
   - Server response codes
   - Network configuration

3. **Check Common Solutions:**
   - Restart PM2 process
   - Verify firewall settings
   - Confirm API key matches
   - Check disk space and memory

---

**🚀 Ready to test? Start with Phase 1 and work through each phase systematically. Good luck!**
