# 🗄️ Digital Ocean Droplet Database Setup Guide

This guide walks through setting up a MySQL database on your Digital Ocean droplet to store intelligent feedback learning data across all Tink stores.

## 🎯 **Benefits of Centralized Database:**

- ✅ **Multi-store intelligence** - Learn from all 4 stores simultaneously
- ✅ **Cross-store patterns** - Identify regional preferences and trends  
- ✅ **Reliable backup** - No data loss, centralized recovery
- ✅ **Real-time sync** - Changes sync immediately across all stores
- ✅ **Advanced analytics** - Company-wide insights and reporting

---

## 🚀 **Step 1: Install MySQL on Droplet**

SSH into your Digital Ocean droplet and run these commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install MySQL Server
sudo apt install mysql-server -y

# Secure MySQL installation
sudo mysql_secure_installation
```

**During `mysql_secure_installation`, choose:**
- Set root password: **Yes** (use a strong password)
- Remove anonymous users: **Yes**
- Disallow root login remotely: **No** (we'll configure this properly)
- Remove test database: **Yes**
- Reload privilege tables: **Yes**

---

## 🔧 **Step 2: Configure MySQL for Remote Access**

```bash
# Edit MySQL configuration
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# Find this line and change it:
# bind-address = 127.0.0.1
# Change to:
bind-address = 0.0.0.0

# Save and exit (Ctrl+X, Y, Enter)

# Restart MySQL
sudo systemctl restart mysql
```

---

## 👤 **Step 3: Create Database and User**

```bash
# Login to MySQL as root
sudo mysql -u root -p

# Create database
CREATE DATABASE tink_feedback_learning;

# Create dedicated user
CREATE USER 'tink_user'@'%' IDENTIFIED BY 'YourSecurePassword123!';

# Grant privileges
GRANT ALL PRIVILEGES ON tink_feedback_learning.* TO 'tink_user'@'%';
FLUSH PRIVILEGES;

# Exit MySQL
EXIT;
```

---

## 🗂️ **Step 4: Create Database Schema**

```bash
# Download the schema file
cd /opt/tink-ml-sync
wget https://raw.githubusercontent.com/yourusername/Tink-2.0/main/database-schema.sql

# Or create it manually:
nano database-schema.sql
# (Copy the contents from database-schema.sql file)

# Import the schema
mysql -u tink_user -p tink_feedback_learning < database-schema.sql
```

---

## 🔒 **Step 5: Configure Firewall**

```bash
# Allow MySQL port (3306)
sudo ufw allow 3306

# Check firewall status
sudo ufw status
```

**Expected output:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
3000/tcp                   ALLOW       Anywhere
3306/tcp                   ALLOW       Anywhere
```

---

## 📦 **Step 6: Install Node.js MySQL Driver**

```bash
# Navigate to your server directory
cd /opt/tink-ml-sync

# Install MySQL driver
npm install mysql2

# Install additional dependencies
npm install dotenv express cors
```

---

## ⚙️ **Step 7: Configure Environment Variables**

```bash
# Edit your .env file
nano .env
```

**Add these database configuration variables:**
```env
# Existing variables
PORT=3000
API_KEY=tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64
NODE_ENV=production

# New database variables
DB_HOST=localhost
DB_USER=tink_user
DB_PASSWORD=YourSecurePassword123!
DB_NAME=tink_feedback_learning
```

---

## 🚀 **Step 8: Deploy Enhanced Server**

```bash
# Backup current server
cp server.js server-backup.js

# Download enhanced server
wget https://raw.githubusercontent.com/yourusername/Tink-2.0/main/enhanced-sync-server.js -O server.js

# Or copy the enhanced-sync-server.js content manually

# Restart the server with PM2
pm2 restart tink-ml-sync

# Check logs
pm2 logs tink-ml-sync --lines 20
```

**Expected log output:**
```
🚀 Starting Enhanced Tink ML Sync Server...
✅ Database connected successfully
✅ Enhanced Tink ML Sync Server running on port 3000
📊 Database: Connected
🔑 API Key: Configured
```

---

## 🧪 **Step 9: Test Database Integration**

### **Test 1: Health Check**
```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "activeStores": 0,
  "version": "2.0",
  "timestamp": "2025-09-11T..."
}
```

### **Test 2: Register a Store**
```bash
curl -X POST http://localhost:3000/api/stores/register \
  -H "Authorization: Bearer tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "17521",
    "storeName": "Eagle Hardware",
    "location": "Eagle, CO",
    "region": "Mountain West",
    "managerName": "Test Manager"
  }'
```

### **Test 3: Submit Feedback**
```bash
curl -X POST http://localhost:3000/api/feedback/submit \
  -H "Authorization: Bearer tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "17521",
    "sku": "8207433",
    "tinkRecommendation": 100,
    "managerRecommendation": 50,
    "feedbackType": "too-much",
    "comments": "Too many pellets for our store size",
    "managerName": "Test Manager"
  }'
```

---

## 📊 **Step 10: Verify Database Data**

```bash
# Login to MySQL
mysql -u tink_user -p tink_feedback_learning

# Check stores
SELECT * FROM stores;

# Check feedback
SELECT * FROM feedback_history;

# Check overrides
SELECT * FROM manager_overrides;

# Exit
EXIT;
```

---

## 🔄 **Step 11: Update Client Applications**

The client applications will automatically use the new database-backed API endpoints. The enhanced server provides:

### **New API Endpoints:**
- `POST /api/stores/register` - Register store information
- `POST /api/feedback/submit` - Submit manager feedback  
- `GET /api/overrides/:storeId` - Get store overrides
- `POST /api/overrides/apply` - Apply overrides to recommendations
- `POST /api/sales/update` - Update sales trend data
- `GET /api/suggestions/:storeId` - Get override adjustment suggestions
- `POST /api/suggestions/accept` - Accept override adjustments
- `GET /api/analytics/:storeId` - Get store analytics

### **Backward Compatibility:**
The server maintains compatibility with existing endpoints while adding new database functionality.

---

## 🛡️ **Security Considerations**

### **Database Security:**
- Use strong passwords for MySQL users
- Limit database user privileges to only necessary operations
- Consider SSL/TLS encryption for database connections in production

### **API Security:**
- API key authentication for all endpoints
- Input validation and sanitization
- Rate limiting (consider adding nginx reverse proxy)

### **Network Security:**
- Firewall rules limiting access to necessary ports only
- Consider VPN access for database administration
- Regular security updates

---

## 📈 **Monitoring & Maintenance**

### **Database Monitoring:**
```bash
# Check database size
mysql -u tink_user -p -e "
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'tink_feedback_learning'
GROUP BY table_schema;
"

# Check table row counts
mysql -u tink_user -p tink_feedback_learning -e "
SELECT 
    table_name AS 'Table',
    table_rows AS 'Rows'
FROM information_schema.tables 
WHERE table_schema = 'tink_feedback_learning'
ORDER BY table_rows DESC;
"
```

### **Performance Optimization:**
```sql
-- Add indexes for common queries (already included in schema)
-- Monitor slow query log
-- Consider partitioning for large tables (sales_trends, feedback_history)
```

### **Backup Strategy:**
```bash
# Create daily backup script
nano /opt/tink-ml-sync/backup-db.sh

#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/tink-ml-sync/backups"
mkdir -p $BACKUP_DIR

mysqldump -u tink_user -p'YourSecurePassword123!' tink_feedback_learning > $BACKUP_DIR/tink_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "tink_backup_*.sql" -mtime +7 -delete

# Make executable
chmod +x /opt/tink-ml-sync/backup-db.sh

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /opt/tink-ml-sync/backup-db.sh
```

---

## 🎉 **Success! Your Database is Ready**

Your Digital Ocean droplet now has:
- ✅ **MySQL database** storing all feedback learning data
- ✅ **Enhanced API server** with database integration  
- ✅ **Multi-store intelligence** across all 4 locations
- ✅ **Advanced analytics** and cross-store insights
- ✅ **Reliable backup** and recovery system

**Next Steps:**
1. Update client applications to use new database endpoints
2. Deploy updated Tink 2.0 to all stores  
3. Monitor database performance and growth
4. Set up automated backups and monitoring

**The intelligent feedback learning system is now enterprise-ready!** 🚀
