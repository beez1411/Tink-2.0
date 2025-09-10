/**
 * Server Diagnostics Script for Digital Ocean Droplet
 * Run this ON the droplet to check server health and configuration
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class TinkServerDiagnostics {
    constructor() {
        this.diagnosticResults = [];
        this.serverPaths = {
            dataDir: '/opt/tink-ml-data',
            storesFile: '/opt/tink-ml-data/stores.json',
            networkFile: '/opt/tink-ml-data/network-learning.json',
            serverDir: '/opt/Tink 2.0',
            envFile: '/opt/Tink 2.0/.env',
            productionServer: '/opt/Tink 2.0/production-server.js'
        };
    }

    /**
     * Run all server diagnostics
     */
    async runAllDiagnostics() {
        console.log('🔍 Tink ML Sync Server Diagnostics');
        console.log('=' * 50);

        const diagnostics = [
            { name: 'System Information', test: () => this.checkSystemInfo() },
            { name: 'Node.js Installation', test: () => this.checkNodeJS() },
            { name: 'PM2 Process Status', test: () => this.checkPM2Status() },
            { name: 'Server Files', test: () => this.checkServerFiles() },
            { name: 'Data Directory', test: () => this.checkDataDirectory() },
            { name: 'Environment Configuration', test: () => this.checkEnvironmentConfig() },
            { name: 'Network Connectivity', test: () => this.checkNetworkConnectivity() },
            { name: 'Firewall Status', test: () => this.checkFirewallStatus() },
            { name: 'Server Logs', test: () => this.checkServerLogs() },
            { name: 'Disk Usage', test: () => this.checkDiskUsage() },
            { name: 'Memory Usage', test: () => this.checkMemoryUsage() },
            { name: 'Port Availability', test: () => this.checkPortAvailability() }
        ];

        for (const diagnostic of diagnostics) {
            try {
                console.log(`\n🔍 Checking: ${diagnostic.name}`);
                const result = await diagnostic.test();
                this.logDiagnosticResult(diagnostic.name, true, result);
            } catch (error) {
                this.logDiagnosticResult(diagnostic.name, false, error.message);
            }
        }

        this.printDiagnosticSummary();
        await this.generateDiagnosticReport();
    }

    /**
     * Check system information
     */
    async checkSystemInfo() {
        const { stdout: osInfo } = await execAsync('uname -a');
        const { stdout: uptime } = await execAsync('uptime');
        
        return `✅ OS: ${osInfo.trim()}\n   Uptime: ${uptime.trim()}`;
    }

    /**
     * Check Node.js installation
     */
    async checkNodeJS() {
        try {
            const { stdout: nodeVersion } = await execAsync('node --version');
            const { stdout: npmVersion } = await execAsync('npm --version');
            
            const nodeVersionNum = parseFloat(nodeVersion.replace('v', ''));
            if (nodeVersionNum < 16) {
                throw new Error(`Node.js version ${nodeVersion.trim()} is too old. Need v16+`);
            }
            
            return `✅ Node.js: ${nodeVersion.trim()}, NPM: ${npmVersion.trim()}`;
        } catch (error) {
            throw new Error('Node.js not installed or not in PATH');
        }
    }

    /**
     * Check PM2 process status
     */
    async checkPM2Status() {
        try {
            const { stdout: pm2List } = await execAsync('pm2 list');
            const { stdout: pm2Status } = await execAsync('pm2 show tink-ml-sync || echo "Process not found"');
            
            if (pm2Status.includes('Process not found')) {
                throw new Error('Tink ML sync process not running in PM2');
            }
            
            return `✅ PM2 Status:\n${pm2List}\n\nTink Process Details:\n${pm2Status}`;
        } catch (error) {
            if (error.message.includes('pm2: command not found')) {
                throw new Error('PM2 not installed. Install with: npm install -g pm2');
            }
            throw error;
        }
    }

    /**
     * Check server files exist
     */
    async checkServerFiles() {
        const fileChecks = [];
        
        for (const [name, filePath] of Object.entries(this.serverPaths)) {
            try {
                const stats = await fs.stat(filePath);
                if (stats.isDirectory()) {
                    fileChecks.push(`✅ ${name}: Directory exists (${filePath})`);
                } else {
                    const sizeKB = (stats.size / 1024).toFixed(1);
                    fileChecks.push(`✅ ${name}: File exists, ${sizeKB}KB (${filePath})`);
                }
            } catch (error) {
                fileChecks.push(`❌ ${name}: Missing (${filePath})`);
            }
        }
        
        return fileChecks.join('\n   ');
    }

    /**
     * Check data directory and contents
     */
    async checkDataDirectory() {
        try {
            const dataDir = this.serverPaths.dataDir;
            const files = await fs.readdir(dataDir);
            
            const checks = [`✅ Data directory exists: ${dataDir}`];
            checks.push(`   Files: ${files.join(', ')}`);
            
            // Check stores.json
            if (files.includes('stores.json')) {
                const storesContent = await fs.readFile(path.join(dataDir, 'stores.json'), 'utf8');
                const storesData = JSON.parse(storesContent);
                const storeCount = Object.keys(storesData.stores || {}).length;
                checks.push(`   Stores registered: ${storeCount}`);
            }
            
            // Check network-learning.json
            if (files.includes('network-learning.json')) {
                const networkContent = await fs.readFile(path.join(dataDir, 'network-learning.json'), 'utf8');
                const networkData = JSON.parse(networkContent);
                const totalVerifications = networkData.consolidatedLearning?.totalVerifications || 0;
                checks.push(`   Total network verifications: ${totalVerifications}`);
            }
            
            return checks.join('\n   ');
        } catch (error) {
            throw new Error(`Data directory issue: ${error.message}`);
        }
    }

    /**
     * Check environment configuration
     */
    async checkEnvironmentConfig() {
        try {
            const envContent = await fs.readFile(this.serverPaths.envFile, 'utf8');
            const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
            
            const requiredVars = ['PORT', 'API_KEY', 'NODE_ENV'];
            const foundVars = [];
            const missingVars = [];
            
            envLines.forEach(line => {
                const [key] = line.split('=');
                if (requiredVars.includes(key)) {
                    foundVars.push(key);
                }
            });
            
            requiredVars.forEach(varName => {
                if (!foundVars.includes(varName)) {
                    missingVars.push(varName);
                }
            });
            
            const result = [`✅ Environment file exists`];
            result.push(`   Found variables: ${foundVars.join(', ')}`);
            
            if (missingVars.length > 0) {
                result.push(`   ⚠️ Missing variables: ${missingVars.join(', ')}`);
            }
            
            return result.join('\n   ');
        } catch (error) {
            throw new Error(`Environment configuration issue: ${error.message}`);
        }
    }

    /**
     * Check network connectivity
     */
    async checkNetworkConnectivity() {
        try {
            // Check if server is listening on port 3000
            const { stdout: netstat } = await execAsync('netstat -tlnp | grep :3000 || echo "Port 3000 not listening"');
            
            // Test local connection
            const { stdout: curlTest } = await execAsync('curl -s http://localhost:3000/api/health || echo "Local connection failed"');
            
            const results = [`Network Status:`];
            
            if (netstat.includes('Port 3000 not listening')) {
                results.push(`   ❌ Server not listening on port 3000`);
            } else {
                results.push(`   ✅ Server listening on port 3000`);
            }
            
            if (curlTest.includes('Local connection failed')) {
                results.push(`   ❌ Local health check failed`);
            } else {
                try {
                    const healthData = JSON.parse(curlTest);
                    results.push(`   ✅ Local health check passed - ${healthData.stores} stores`);
                } catch {
                    results.push(`   ⚠️ Local connection works but response invalid`);
                }
            }
            
            return results.join('\n   ');
        } catch (error) {
            throw new Error(`Network connectivity check failed: ${error.message}`);
        }
    }

    /**
     * Check firewall status
     */
    async checkFirewallStatus() {
        try {
            const { stdout: ufwStatus } = await execAsync('ufw status || echo "UFW not available"');
            
            if (ufwStatus.includes('UFW not available')) {
                return '⚠️ UFW firewall not available';
            }
            
            const port3000Open = ufwStatus.includes('3000') || ufwStatus.includes('Anywhere');
            const sshOpen = ufwStatus.includes('22/tcp') || ufwStatus.includes('OpenSSH');
            
            const results = ['Firewall Status:'];
            results.push(`   Port 3000: ${port3000Open ? '✅ Open' : '❌ Blocked'}`);
            results.push(`   SSH: ${sshOpen ? '✅ Open' : '❌ Blocked'}`);
            results.push(`\nFull UFW Status:\n${ufwStatus}`);
            
            return results.join('\n   ');
        } catch (error) {
            throw new Error(`Firewall check failed: ${error.message}`);
        }
    }

    /**
     * Check server logs
     */
    async checkServerLogs() {
        try {
            const { stdout: pm2Logs } = await execAsync('pm2 logs tink-ml-sync --lines 10 --nostream || echo "No logs available"');
            
            if (pm2Logs.includes('No logs available')) {
                return '⚠️ No PM2 logs available for tink-ml-sync';
            }
            
            // Check for common error patterns
            const errorPatterns = ['Error:', 'Failed:', 'ECONNREFUSED', 'EADDRINUSE'];
            const hasErrors = errorPatterns.some(pattern => pm2Logs.includes(pattern));
            
            const result = [`Recent logs (last 10 lines):`];
            if (hasErrors) {
                result.push(`   ⚠️ Errors detected in logs`);
            } else {
                result.push(`   ✅ No obvious errors in recent logs`);
            }
            result.push(`\n${pm2Logs}`);
            
            return result.join('\n   ');
        } catch (error) {
            throw new Error(`Log check failed: ${error.message}`);
        }
    }

    /**
     * Check disk usage
     */
    async checkDiskUsage() {
        try {
            const { stdout: diskUsage } = await execAsync('df -h /');
            const { stdout: dataDirSize } = await execAsync(`du -sh ${this.serverPaths.dataDir} 2>/dev/null || echo "0K"`);
            
            const lines = diskUsage.split('\n');
            const rootUsage = lines[1]; // Second line has root filesystem info
            const usagePercent = rootUsage.split(/\s+/)[4]; // 5th column is usage percentage
            
            const results = [`Disk Usage:`];
            results.push(`   Root filesystem: ${usagePercent} used`);
            results.push(`   Data directory size: ${dataDirSize.trim()}`);
            
            if (parseInt(usagePercent) > 80) {
                results.push(`   ⚠️ Disk usage is high (${usagePercent})`);
            } else {
                results.push(`   ✅ Disk usage is healthy`);
            }
            
            return results.join('\n   ');
        } catch (error) {
            throw new Error(`Disk usage check failed: ${error.message}`);
        }
    }

    /**
     * Check memory usage
     */
    async checkMemoryUsage() {
        try {
            const { stdout: memInfo } = await execAsync('free -h');
            const { stdout: nodeProcess } = await execAsync('ps aux | grep "production-server.js" | grep -v grep || echo "Process not found"');
            
            const results = [`Memory Usage:`];
            results.push(`\nSystem Memory:\n${memInfo}`);
            
            if (nodeProcess.includes('Process not found')) {
                results.push(`   ⚠️ Node.js server process not found`);
            } else {
                const memUsage = nodeProcess.split(/\s+/)[5]; // 6th column is memory usage
                results.push(`   Node.js process memory: ${memUsage}KB`);
            }
            
            return results.join('\n   ');
        } catch (error) {
            throw new Error(`Memory usage check failed: ${error.message}`);
        }
    }

    /**
     * Check port availability
     */
    async checkPortAvailability() {
        try {
            const { stdout: portCheck } = await execAsync('ss -tlnp | grep :3000');
            
            if (portCheck.trim()) {
                const processInfo = portCheck.includes('node') ? 'Node.js process' : 'Unknown process';
                return `✅ Port 3000 is in use by ${processInfo}`;
            } else {
                throw new Error('Port 3000 is not in use - server may not be running');
            }
        } catch (error) {
            if (error.message.includes('not in use')) {
                throw error;
            }
            throw new Error(`Port check failed: ${error.message}`);
        }
    }

    /**
     * Log diagnostic result
     */
    logDiagnosticResult(testName, success, message) {
        const status = success ? '✅ PASS' : '❌ FAIL';
        const result = { testName, success, message };
        this.diagnosticResults.push(result);
        
        console.log(`   ${status}: ${message.split('\n')[0]}`);
        if (message.includes('\n')) {
            const additionalLines = message.split('\n').slice(1);
            additionalLines.forEach(line => {
                if (line.trim()) console.log(`       ${line}`);
            });
        }
    }

    /**
     * Print diagnostic summary
     */
    printDiagnosticSummary() {
        const totalChecks = this.diagnosticResults.length;
        const passedChecks = this.diagnosticResults.filter(r => r.success).length;
        const failedChecks = totalChecks - passedChecks;

        console.log('\n' + '=' * 50);
        console.log('📊 DIAGNOSTIC SUMMARY');
        console.log('=' * 50);
        console.log(`Total Checks: ${totalChecks}`);
        console.log(`✅ Passed: ${passedChecks}`);
        console.log(`❌ Failed: ${failedChecks}`);
        console.log(`Health Score: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);

        if (failedChecks > 0) {
            console.log('\n🚨 ISSUES FOUND:');
            this.diagnosticResults
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.testName}: ${r.message}`));
        }

        if (passedChecks === totalChecks) {
            console.log('\n🎉 ALL CHECKS PASSED! Your server is healthy and ready.');
        } else {
            console.log('\n⚠️ Some issues found. Please address the failed checks above.');
        }
    }

    /**
     * Generate diagnostic report file
     */
    async generateDiagnosticReport() {
        const reportData = {
            timestamp: new Date().toISOString(),
            hostname: process.env.HOSTNAME || 'unknown',
            diagnostics: this.diagnosticResults,
            summary: {
                total: this.diagnosticResults.length,
                passed: this.diagnosticResults.filter(r => r.success).length,
                failed: this.diagnosticResults.filter(r => !r.success).length
            }
        };

        const reportPath = '/tmp/tink-server-diagnostics.json';
        await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
        
        console.log(`\n📄 Diagnostic report saved to: ${reportPath}`);
        console.log('You can share this file for troubleshooting if needed.');
    }
}

// Export for use in other scripts
module.exports = TinkServerDiagnostics;

// Run diagnostics if this script is executed directly
if (require.main === module) {
    const diagnostics = new TinkServerDiagnostics();
    diagnostics.runAllDiagnostics().catch(console.error);
}
