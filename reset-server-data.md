# 🧹 Server Data Reset Instructions

The cleanup script couldn't delete stores because the server doesn't have a DELETE endpoint. We need to reset the data files directly on the server.

## 🔧 **Manual Reset on Digital Ocean Droplet:**

**SSH into your droplet and run these commands:**

```bash
# SSH into your droplet
ssh root@178.128.185.6

# Stop the server temporarily
pm2 stop tink-ml-sync

# Reset the data files
rm -f /opt/tink-ml-data/stores.json
rm -f /opt/tink-ml-data/network-learning.json

# Recreate empty data files
echo '{"stores":{}}' > /opt/tink-ml-data/stores.json
echo '{"consolidatedLearning":{"categoryPatterns":[],"modelWeights":{},"totalVerifications":0,"networkAccuracy":0,"lastUpdated":"'$(date -Iseconds)'"},"stores":[]}' > /opt/tink-ml-data/network-learning.json

# Restart the server
pm2 start tink-ml-sync

# Verify it's clean
curl http://localhost:3000/api/health
```

## ✅ **Expected Result:**
The health check should show:
```json
{"status":"healthy","stores":0,"version":"1.0","timestamp":"..."}
```

## 🚀 **After Reset:**
Your server will be completely clean and ready for your real store deployments:
- Store 16719 - Fairview
- Store 17521 - Eagle  
- Store 18179 - Broadway
- Store 18181 - State

Each store will show up as it connects with the new version 2.0.17!
