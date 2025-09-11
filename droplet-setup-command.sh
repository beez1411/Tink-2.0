#!/bin/bash
# 🚀 One-Command Tink Database Setup for Digital Ocean Droplet
# Copy and paste this entire command into your droplet console

echo "🚀 Starting Tink Database Setup..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install MySQL
echo "📦 Installing MySQL Server..."
sudo apt install mysql-server -y

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure MySQL installation (automated)
echo "🔒 Securing MySQL..."
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'TinkRoot2024!';"
sudo mysql -e "DELETE FROM mysql.user WHERE User='';"
sudo mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
sudo mysql -e "DROP DATABASE IF EXISTS test;"
sudo mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Configure MySQL for remote access
echo "🌐 Configuring MySQL for remote access..."
sudo sed -i 's/bind-address.*=.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
sudo systemctl restart mysql

# Create database and user
echo "🗄️ Creating database and user..."
sudo mysql -u root -p'TinkRoot2024!' -e "
CREATE DATABASE IF NOT EXISTS tink_feedback_learning;
CREATE USER IF NOT EXISTS 'tink_user'@'%' IDENTIFIED BY 'TinkDB2024!';
GRANT ALL PRIVILEGES ON tink_feedback_learning.* TO 'tink_user'@'%';
FLUSH PRIVILEGES;
"

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 3306

# Install Node.js MySQL driver
echo "📦 Installing Node.js dependencies..."
cd /opt/tink-ml-sync
npm install mysql2

# Create database schema
echo "🏗️ Creating database schema..."
cat > /tmp/schema.sql << 'EOF'
-- Stores table
CREATE TABLE IF NOT EXISTS stores (
    store_id VARCHAR(10) PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    region VARCHAR(50),
    manager_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- SKU master data
CREATE TABLE IF NOT EXISTS skus (
    sku VARCHAR(50) PRIMARY KEY,
    description TEXT,
    category VARCHAR(100),
    supplier VARCHAR(100),
    unit_cost DECIMAL(10,2),
    min_order_qty INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Manager overrides
CREATE TABLE IF NOT EXISTS manager_overrides (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    original_tink_recommendation INTEGER NOT NULL,
    manager_preference INTEGER NOT NULL,
    feedback_type ENUM('not-needed', 'too-much', 'not-enough') NOT NULL,
    current_multiplier DECIMAL(5,3) NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 1.00,
    comments TEXT,
    manager_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY unique_store_sku (store_id, sku),
    INDEX idx_store_sku (store_id, sku)
);

-- Feedback history
CREATE TABLE IF NOT EXISTS feedback_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    tink_recommendation INTEGER NOT NULL,
    manager_recommendation INTEGER,
    feedback_type ENUM('not-needed', 'too-much', 'not-enough') NOT NULL,
    comments TEXT,
    manager_name VARCHAR(100),
    order_context JSON,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_sku_date (store_id, sku, submitted_at)
);

-- Sales trends
CREATE TABLE IF NOT EXISTS sales_trends (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    week_ending_date DATE NOT NULL,
    units_sold INTEGER DEFAULT 0,
    avg_weekly_sales DECIMAL(8,2) DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    stock_on_hand INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_store_sku_week (store_id, sku, week_ending_date)
);

-- Override adjustments
CREATE TABLE IF NOT EXISTS override_adjustments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    adjustment_reason TEXT NOT NULL,
    growth_rate DECIMAL(5,2),
    confidence DECIMAL(3,2),
    accepted_by ENUM('manager', 'system-suggestion', 'auto-adjustment') NOT NULL,
    manager_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample stores
INSERT IGNORE INTO stores (store_id, store_name, location, region, manager_name) VALUES
('16719', 'Fairview Hardware', 'Fairview, CO', 'Mountain West', 'John Smith'),
('17521', 'Eagle Hardware', 'Eagle, CO', 'Mountain West', 'Sarah Johnson'),
('18179', 'Broadway Hardware', 'Denver, CO', 'Mountain West', 'Mike Wilson'),
('18181', 'State Street Hardware', 'Denver, CO', 'Mountain West', 'Lisa Brown');

-- Insert sample SKUs
INSERT IGNORE INTO skus (sku, description, category, supplier, unit_cost, min_order_qty) VALUES
('8207433', 'HICKORY BBQ PELLETS 20LB', 'seasonal', 'ACE', 12.50, 6),
('10009', 'REMOVER RUST EXTEND 8 OZ', 'maintenance', 'ACE', 4.25, 1),
('1015610', 'MOUNTING PUTTY HS 2OZ', 'hardware', 'ACE', 2.15, 1);
EOF

# Import schema
mysql -u tink_user -p'TinkDB2024!' tink_feedback_learning < /tmp/schema.sql

# Update .env file
echo "⚙️ Updating environment configuration..."
cat >> .env << 'EOF'

# Database Configuration
DB_HOST=localhost
DB_USER=tink_user
DB_PASSWORD=TinkDB2024!
DB_NAME=tink_feedback_learning
EOF

# Backup current server
cp server.js server-backup-$(date +%Y%m%d).js

# Create enhanced server
cat > server-enhanced.js << 'EOF'
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Database configuration
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'tink_user',
    password: process.env.DB_PASSWORD || 'TinkDB2024!',
    database: process.env.DB_NAME || 'tink_feedback_learning',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let dbPool;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database connection
async function initializeDatabase() {
    try {
        dbPool = mysql.createPool(DB_CONFIG);
        const connection = await dbPool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Authentication middleware
function validateApiKey(req, res, next) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Health check with database status
app.get('/api/health', async (req, res) => {
    try {
        let dbStatus = 'disconnected';
        let storeCount = 0;
        
        if (dbPool) {
            try {
                const [rows] = await dbPool.execute('SELECT COUNT(*) as count FROM stores WHERE is_active = TRUE');
                storeCount = rows[0].count;
                dbStatus = 'connected';
            } catch (dbError) {
                dbStatus = 'error';
            }
        }
        
        res.json({
            status: 'healthy',
            database: dbStatus,
            activeStores: storeCount,
            version: '2.0-enhanced',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

// Submit manager feedback
app.post('/api/feedback/submit', validateApiKey, async (req, res) => {
    try {
        const { storeId, sku, tinkRecommendation, managerRecommendation, feedbackType, comments, managerName } = req.body;
        
        if (!storeId || !sku || !tinkRecommendation || !feedbackType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const connection = await dbPool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Insert feedback history
            await connection.execute(`
                INSERT INTO feedback_history 
                (store_id, sku, tink_recommendation, manager_recommendation, feedback_type, comments, manager_name)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [storeId, sku, tinkRecommendation, managerRecommendation, feedbackType, comments, managerName]);
            
            // Calculate multiplier and preference
            let currentMultiplier = 1.0;
            let managerPref = parseInt(managerRecommendation) || 0;
            
            switch (feedbackType) {
                case 'not-needed':
                    currentMultiplier = 0;
                    managerPref = 0;
                    break;
                case 'too-much':
                case 'not-enough':
                    currentMultiplier = managerRecommendation ? (managerRecommendation / tinkRecommendation) : 0.5;
                    break;
            }
            
            // Create or update override
            await connection.execute(`
                INSERT INTO manager_overrides 
                (store_id, sku, original_tink_recommendation, manager_preference, feedback_type, current_multiplier, comments, manager_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                manager_preference = VALUES(manager_preference),
                feedback_type = VALUES(feedback_type),
                current_multiplier = VALUES(current_multiplier),
                comments = VALUES(comments),
                updated_at = CURRENT_TIMESTAMP
            `, [storeId, sku, tinkRecommendation, managerPref, feedbackType, currentMultiplier, comments, managerName]);
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: 'Feedback submitted successfully',
                override: { sku, managerPreference: managerPref, multiplier: currentMultiplier }
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Feedback submission error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// Get overrides for a store
app.get('/api/overrides/:storeId', validateApiKey, async (req, res) => {
    try {
        const { storeId } = req.params;
        
        const [rows] = await dbPool.execute(`
            SELECT mo.*, sk.description, sk.category
            FROM manager_overrides mo
            LEFT JOIN skus sk ON mo.sku = sk.sku
            WHERE mo.store_id = ? AND mo.is_active = TRUE
            ORDER BY mo.updated_at DESC
        `, [storeId]);
        
        res.json({ success: true, overrides: rows });
        
    } catch (error) {
        console.error('Get overrides error:', error);
        res.status(500).json({ error: 'Failed to get overrides' });
    }
});

// Apply overrides to recommendations
app.post('/api/overrides/apply', validateApiKey, async (req, res) => {
    try {
        const { storeId, orderRecommendations } = req.body;
        
        if (!storeId || !Array.isArray(orderRecommendations)) {
            return res.status(400).json({ error: 'Store ID and order recommendations are required' });
        }
        
        const [overrides] = await dbPool.execute(`
            SELECT sku, manager_preference, current_multiplier, feedback_type, confidence
            FROM manager_overrides 
            WHERE store_id = ? AND is_active = TRUE
        `, [storeId]);
        
        const overrideMap = new Map(overrides.map(o => [o.sku, o]));
        
        const adjustedRecommendations = orderRecommendations.map(item => {
            const override = overrideMap.get(item.sku || item.partNumber);
            
            if (override) {
                const originalQty = item.recommendedQuantity || item.quantity || 0;
                const adjustedQty = Math.round(originalQty * override.current_multiplier);
                
                return {
                    ...item,
                    originalRecommendation: originalQty,
                    recommendedQuantity: adjustedQty,
                    quantity: adjustedQty,
                    overrideApplied: true,
                    overrideReason: `Manager preference: ${override.feedback_type}`,
                    overrideMultiplier: override.current_multiplier
                };
            }
            
            return { ...item, overrideApplied: false };
        });
        
        res.json({ 
            success: true, 
            adjustedRecommendations,
            overridesApplied: adjustedRecommendations.filter(item => item.overrideApplied).length
        });
        
    } catch (error) {
        console.error('Apply overrides error:', error);
        res.status(500).json({ error: 'Failed to apply overrides' });
    }
});

// Backward compatibility - existing sync endpoint
app.post('/api/stores/sync', validateApiKey, async (req, res) => {
    try {
        const { storeId, timestamp, verificationResults, categoryPatterns, modelWeights, stats } = req.body;
        
        if (!storeId) {
            return res.status(400).json({ error: 'Store ID is required' });
        }
        
        // Store in database if available, otherwise use file system
        if (dbPool) {
            try {
                // Update store info if it exists
                await dbPool.execute(`
                    INSERT IGNORE INTO stores (store_id, store_name, is_active) 
                    VALUES (?, ?, TRUE)
                `, [storeId, `Store ${storeId}`]);
            } catch (dbError) {
                console.log('Database store update failed, continuing...');
            }
        }
        
        // Continue with existing file-based sync for compatibility
        const DATA_DIR = '/opt/tink-ml-data';
        const STORES_FILE = path.join(DATA_DIR, 'stores.json');
        
        let storesData = { stores: {} };
        try {
            const data = await fs.readFile(STORES_FILE, 'utf8');
            storesData = JSON.parse(data);
        } catch (e) {
            // File doesn't exist, use default
        }
        
        storesData.stores[storeId] = {
            storeId,
            timestamp,
            verificationResults: verificationResults || [],
            categoryPatterns: categoryPatterns || [],
            modelWeights: modelWeights || {},
            stats: stats || {},
            lastSync: new Date().toISOString()
        };
        
        await fs.writeFile(STORES_FILE, JSON.stringify(storesData, null, 2));
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Sync failed' });
    }
});

// Backward compatibility - existing network learning endpoint
app.get('/api/network/learning', validateApiKey, async (req, res) => {
    try {
        const exclude = req.query.exclude;
        
        // Try database first
        if (dbPool) {
            try {
                const [stores] = await dbPool.execute(`
                    SELECT store_id as storeId, store_name, created_at as lastSync
                    FROM stores 
                    WHERE is_active = TRUE AND store_id != ?
                `, [exclude || '']);
                
                res.json({
                    success: true,
                    consolidatedLearning: {
                        categoryPatterns: [],
                        modelWeights: {},
                        totalVerifications: 0,
                        networkAccuracy: 0,
                        lastUpdated: new Date().toISOString()
                    },
                    stores: stores.map(s => ({ storeId: s.storeId, stats: {}, lastSync: s.lastSync }))
                });
                return;
            } catch (dbError) {
                console.log('Database query failed, falling back to file system...');
            }
        }
        
        // Fallback to file system
        const DATA_DIR = '/opt/tink-ml-data';
        const STORES_FILE = path.join(DATA_DIR, 'stores.json');
        const NETWORK_FILE = path.join(DATA_DIR, 'network-learning.json');
        
        let storesData = { stores: {} };
        let networkData = { consolidatedLearning: {} };
        
        try {
            storesData = JSON.parse(await fs.readFile(STORES_FILE, 'utf8'));
            networkData = JSON.parse(await fs.readFile(NETWORK_FILE, 'utf8'));
        } catch (e) {
            // Files don't exist, use defaults
        }
        
        const stores = Object.values(storesData.stores)
            .filter(s => s.storeId !== exclude)
            .map(s => ({ storeId: s.storeId, stats: s.stats, lastSync: s.lastSync }));
        
        res.json({
            success: true,
            consolidatedLearning: networkData.consolidatedLearning,
            stores
        });
        
    } catch (error) {
        console.error('Network learning error:', error);
        res.status(500).json({ error: 'Fetch failed' });
    }
});

// Start server
async function startServer() {
    console.log('🚀 Starting Enhanced Tink ML Sync Server...');
    
    const dbConnected = await initializeDatabase();
    if (!dbConnected) {
        console.log('⚠️ Starting server without database connection (file-based fallback)');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Enhanced Tink ML Sync Server running on port ${PORT}`);
        console.log(`📊 Database: ${dbConnected ? 'Connected' : 'File-based fallback'}`);
        console.log(`🔑 API Key: ${API_KEY ? 'Configured' : 'Not configured'}`);
    });
}

startServer();
EOF

# Restart server with enhanced version
echo "🔄 Restarting server with database integration..."
pm2 stop tink-ml-sync
pm2 start server-enhanced.js --name tink-ml-sync
pm2 save

# Test the setup
echo "🧪 Testing database setup..."
sleep 3

# Test health endpoint
curl -s http://localhost:3000/api/health | python3 -m json.tool

echo ""
echo "✅ Database setup complete!"
echo ""
echo "🔑 Database Credentials:"
echo "   Host: localhost"
echo "   Database: tink_feedback_learning"
echo "   Username: tink_user"
echo "   Password: TinkDB2024!"
echo ""
echo "🚀 Enhanced server is running with database integration!"
echo "📊 Check logs with: pm2 logs tink-ml-sync"
echo ""
EOF
