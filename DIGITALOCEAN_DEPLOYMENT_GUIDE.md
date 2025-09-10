# DigitalOcean Droplet Deployment Guide for Tink ML Sync Server

## 🌊 Why DigitalOcean is Perfect for This

✅ **Dedicated IP Address** - Your stores can reliably connect  
✅ **Full Root Access** - Install anything you need  
✅ **Predictable Costs** - $6/month for basic droplet  
✅ **99.99% Uptime** - Reliable for 24/7 sync operations  
✅ **Easy Scaling** - Upgrade resources as you add more stores  
✅ **Simple Firewall** - Built-in security controls  

## 💰 Cost Breakdown

**Recommended Droplet:**
- **Size**: Basic Droplet ($6/month)
- **RAM**: 1GB (plenty for ML sync)
- **CPU**: 1 vCPU (sufficient for 4-10 stores)
- **Storage**: 25GB SSD (way more than needed)
- **Bandwidth**: 1TB transfer (thousands of syncs)

**Total Cost**: ~$6/month for unlimited store synchronization

## 🚀 Step-by-Step Deployment

### **Step 1: Create the Droplet**

1. **Go to DigitalOcean** → Create → Droplets
2. **Choose Image**: Ubuntu 22.04 LTS (recommended)
3. **Choose Size**: Basic - $6/month (1GB RAM, 1 vCPU)
4. **Choose Region**: Closest to your stores (e.g., Denver if stores are in Colorado)
5. **Authentication**: Add your SSH key (or use password)
6. **Hostname**: `tink-ml-sync-server`
7. **Click Create Droplet**

### **Step 2: Initial Server Setup**

SSH into your droplet:
```bash
ssh root@your-droplet-ip
```

Update the system:
```bash
apt update && apt upgrade -y
```

### **Step 3: Install Required Software**

Install Node.js (required for the sync server):
```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x
```

Install PM2 (process manager to keep server running):
```bash
npm install -g pm2
```

Install Git (to clone your code):
```bash
apt install -y git
```

### **Step 4: Deploy Your Sync Server**

Clone your Tink repository:
```bash
cd /opt
git clone https://github.com/beez1411/Tink-2.0.git
cd "Tink 2.0"
```

Install dependencies:
```bash
npm install express cors
```

Create production configuration:
```bash
# Create environment file
cat > .env << EOF
PORT=3000
API_KEY=tink-ml-sync-secure-key-2024-$(openssl rand -hex 8)
NODE_ENV=production
EOF
```

### **Step 5: Configure the Server**

Update the sync server for production:
```bash
cat > production-server.js << 'EOF'
/**
 * Production Tink ML Sync Server for DigitalOcean
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'tink-ml-sync-key-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Data storage directory
const DATA_DIR = '/opt/tink-ml-data';
const STORES_FILE = path.join(DATA_DIR, 'stores.json');
const NETWORK_FILE = path.join(DATA_DIR, 'network-learning.json');

// Initialize data directory
async function initializeDataDirectory() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        // Initialize stores file if it doesn't exist
        try {
            await fs.access(STORES_FILE);
        } catch {
            await fs.writeFile(STORES_FILE, JSON.stringify({ stores: {} }));
        }
        
        // Initialize network learning file
        try {
            await fs.access(NETWORK_FILE);
        } catch {
            const initialData = {
                consolidatedLearning: {
                    categoryPatterns: [],
                    modelWeights: {},
                    totalVerifications: 0,
                    networkAccuracy: 0,
                    lastUpdated: new Date().toISOString()
                },
                stores: []
            };
            await fs.writeFile(NETWORK_FILE, JSON.stringify(initialData, null, 2));
        }
        
        console.log('Data directory initialized:', DATA_DIR);
    } catch (error) {
        console.error('Failed to initialize data directory:', error);
        process.exit(1);
    }
}

// API Key validation
function validateApiKey(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }
    
    const token = authHeader.substring(7);
    if (token !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    
    next();
}

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const storesData = JSON.parse(await fs.readFile(STORES_FILE, 'utf8'));
        const storeCount = Object.keys(storesData.stores).length;
        
        res.json({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            stores: storeCount,
            version: '1.0',
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

// Upload store ML data
app.post('/api/stores/sync', validateApiKey, async (req, res) => {
    try {
        const { storeId, timestamp, verificationResults, categoryPatterns, modelWeights, stats } = req.body;
        
        if (!storeId) {
            return res.status(400).json({ error: 'Store ID is required' });
        }
        
        // Load existing stores data
        const storesData = JSON.parse(await fs.readFile(STORES_FILE, 'utf8'));
        
        // Update store data
        storesData.stores[storeId] = {
            storeId,
            timestamp,
            verificationResults: verificationResults || [],
            categoryPatterns: categoryPatterns || [],
            modelWeights: modelWeights || {},
            stats: stats || {},
            lastSync: new Date().toISOString()
        };
        
        // Save updated stores data
        await fs.writeFile(STORES_FILE, JSON.stringify(storesData, null, 2));
        
        // Update consolidated learning
        await updateConsolidatedLearning();
        
        console.log(`Synced data from store ${storeId} - ${stats?.totalVerifications || 0} verifications`);
        
        res.json({ 
            success: true, 
            message: `Data synced for store ${storeId}`,
            networkStores: Object.keys(storesData.stores).length
        });
        
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync store data' });
    }
});

// Download network learning data
app.get('/api/network/learning', validateApiKey, async (req, res) => {
    try {
        const excludeStore = req.query.exclude;
        
        // Load stores and network data
        const storesData = JSON.parse(await fs.readFile(STORES_FILE, 'utf8'));
        const networkData = JSON.parse(await fs.readFile(NETWORK_FILE, 'utf8'));
        
        // Filter out requesting store
        const stores = Object.values(storesData.stores)
            .filter(store => store.storeId !== excludeStore)
            .map(store => ({
                storeId: store.storeId,
                stats: store.stats,
                lastSync: store.lastSync
            }));
        
        res.json({
            success: true,
            consolidatedLearning: networkData.consolidatedLearning,
            stores: stores,
            networkStats: {
                totalStores: Object.keys(storesData.stores).length,
                totalVerifications: networkData.consolidatedLearning.totalVerifications,
                networkAccuracy: networkData.consolidatedLearning.networkAccuracy,
                lastUpdated: networkData.consolidatedLearning.lastUpdated
            }
        });
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to get network learning data' });
    }
});

// Update consolidated learning
async function updateConsolidatedLearning() {
    try {
        const storesData = JSON.parse(await fs.readFile(STORES_FILE, 'utf8'));
        const stores = Object.values(storesData.stores);
        
        const consolidated = {
            categoryPatterns: new Map(),
            modelWeights: {},
            totalVerifications: 0,
            networkAccuracy: 0,
            storeCount: 0
        };
        
        let totalAccuracy = 0;
        let storeCount = 0;
        
        // Process each store's data
        stores.forEach((store) => {
            consolidated.totalVerifications += store.stats?.totalVerifications || 0;
            
            if (store.stats?.accuracy) {
                totalAccuracy += store.stats.accuracy;
                storeCount++;
            }
            
            // Merge category patterns
            if (store.categoryPatterns) {
                const categoryMap = new Map(store.categoryPatterns);
                categoryMap.forEach((pattern, category) => {
                    if (consolidated.categoryPatterns.has(category)) {
                        const existing = consolidated.categoryPatterns.get(category);
                        existing.totalVerifications += pattern.totalVerifications || 0;
                        existing.correctPredictions += pattern.correctPredictions || 0;
                        existing.avgDiscrepancy = (existing.avgDiscrepancy + (pattern.avgDiscrepancy || 0)) / 2;
                    } else {
                        consolidated.categoryPatterns.set(category, {
                            totalVerifications: pattern.totalVerifications || 0,
                            correctPredictions: pattern.correctPredictions || 0,
                            avgDiscrepancy: pattern.avgDiscrepancy || 0
                        });
                    }
                });
            }
            
            // Merge model weights
            if (store.modelWeights) {
                Object.keys(store.modelWeights).forEach(key => {
                    if (!consolidated.modelWeights[key]) {
                        consolidated.modelWeights[key] = [];
                    }
                    consolidated.modelWeights[key].push(store.modelWeights[key]);
                });
            }
        });
        
        // Calculate average model weights
        Object.keys(consolidated.modelWeights).forEach(key => {
            const weights = consolidated.modelWeights[key];
            consolidated.modelWeights[key] = weights.reduce((sum, w) => sum + w, 0) / weights.length;
        });
        
        // Calculate network accuracy
        consolidated.networkAccuracy = storeCount > 0 ? totalAccuracy / storeCount : 0;
        
        // Save consolidated learning
        const networkData = {
            consolidatedLearning: {
                categoryPatterns: Array.from(consolidated.categoryPatterns.entries()),
                modelWeights: consolidated.modelWeights,
                totalVerifications: consolidated.totalVerifications,
                networkAccuracy: consolidated.networkAccuracy,
                lastUpdated: new Date().toISOString()
            },
            stores: Object.keys(storesData.stores)
        };
        
        await fs.writeFile(NETWORK_FILE, JSON.stringify(networkData, null, 2));
        
        console.log(`Updated consolidated learning: ${consolidated.totalVerifications} verifications from ${storeCount} stores`);
        
    } catch (error) {
        console.error('Error updating consolidated learning:', error);
    }
}

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize and start server
async function startServer() {
    await initializeDataDirectory();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Tink ML Sync Server running on port ${PORT}`);
        console.log(`🔑 API Key: ${API_KEY}`);
        console.log(`📊 Data Directory: ${DATA_DIR}`);
        console.log(`🌐 Health Check: http://your-droplet-ip:${PORT}/api/health`);
    });
}

startServer().catch(console.error);
EOF
```

### **Step 6: Start the Server**

Create package.json for dependencies:
```bash
cat > package.json << 'EOF'
{
  "name": "tink-ml-sync-server",
  "version": "1.0.0",
  "description": "Tink ML Synchronization Server",
  "main": "production-server.js",
  "scripts": {
    "start": "node production-server.js",
    "dev": "nodemon production-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
EOF
```

Install dependencies:
```bash
npm install
```

Start the server with PM2:
```bash
pm2 start production-server.js --name "tink-ml-sync"
pm2 startup  # Follow the instructions to auto-start on boot
pm2 save     # Save current processes
```

### **Step 7: Configure Firewall**

Allow HTTP traffic:
```bash
ufw allow 3000/tcp
ufw allow ssh
ufw --force enable
```

### **Step 8: Test Your Server**

Test from your local machine:
```bash
# Replace YOUR_DROPLET_IP with your actual IP
curl http://YOUR_DROPLET_IP:3000/api/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "stores": 0,
  "version": "1.0",
  "uptime": 123.45
}
```

## 🔧 Configure Your Tink Stores

### **Update Each Store's Configuration**

In your Tink 2.0 application, update the sync configuration:

```javascript
// In js/enhanced-phantom-detector.js or wherever you initialize the sync manager
const syncConfig = {
    storeId: '17521',  // Unique for each store: '17521', '18179', '18181', etc.
    networkSync: 'http',
    apiBaseUrl: 'http://YOUR_DROPLET_IP:3000',  // Your DigitalOcean droplet IP
    apiKey: 'tink-ml-sync-secure-key-2024-XXXXXXXX'  // From your .env file
};

const syncManager = new MultiStoreSyncManager(syncConfig);
```

### **Test Store Connection**

From each store, test the connection:
```javascript
// This should work from your Tink application
const testResult = await syncManager.httpSyncManager.testConnection();
console.log('Connection test:', testResult);
```

## 🔒 Security Setup

### **SSL Certificate (Optional but Recommended)**

Install Certbot for free SSL:
```bash
apt install -y certbot
```

Get a domain name (optional) and set up SSL:
```bash
# If you have a domain pointing to your droplet
certbot certonly --standalone -d your-domain.com
```

### **Enhanced Security**

Create a non-root user:
```bash
adduser tinkadmin
usermod -aG sudo tinkadmin
```

Update SSH configuration:
```bash
# Edit /etc/ssh/sshd_config
nano /etc/ssh/sshd_config

# Add these lines:
PermitRootLogin no
PasswordAuthentication no
```

## 📊 Monitoring & Maintenance

### **Check Server Status**
```bash
pm2 status
pm2 logs tink-ml-sync
```

### **View Sync Activity**
```bash
tail -f /opt/tink-ml-data/stores.json
```

### **Server Stats**
```bash
htop  # Install with: apt install htop
df -h  # Disk usage
free -h  # Memory usage
```

## 💡 Expected Performance

### **With 4 Stores:**
- **CPU Usage**: <5%
- **RAM Usage**: ~100MB
- **Disk Usage**: <1GB (even after years of data)
- **Bandwidth**: ~1KB per sync per store
- **Response Time**: <100ms for sync operations

### **Scaling Capacity:**
- **Current Setup**: Handles 10-20 stores easily
- **Upgrade Path**: $12/month droplet handles 50+ stores
- **Database**: Current file-based storage fine for 100+ stores

## 🚀 Go Live Checklist

✅ **Droplet Created** - Ubuntu 22.04, $6/month  
✅ **Node.js Installed** - Version 18 LTS  
✅ **Server Deployed** - PM2 running production server  
✅ **Firewall Configured** - Port 3000 open  
✅ **API Key Generated** - Secure random key  
✅ **Health Check Passing** - Server responds correctly  
✅ **Store Configuration** - Each store has unique ID and API endpoint  
✅ **Test Sync** - At least one store successfully syncs  

## 🎯 Total Setup Time: ~30 minutes

This gives you a **production-ready, scalable ML synchronization server** that will reliably sync phantom inventory learning data between all your store locations for just **$6/month**!
