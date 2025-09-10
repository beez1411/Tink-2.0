/**
 * Network Config Manager
 * Stores and retrieves multi-location sync configuration for Tink
 * Priority order: Environment variables -> user config file -> defaults
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class NetworkConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.tink2');
    this.configFile = path.join(this.configDir, 'network-sync.json');

    this.defaultConfig = {
      enabled: true,
      networkSync: 'http', // 'http' | 'cloud' | 'local'
      apiBaseUrl: '',
      apiKey: '',
      cloudProvider: 'dropbox'
    };

    this.config = { ...this.defaultConfig };
    this.loadConfig();
  }

  ensureDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  loadConfig() {
    try {
      this.ensureDir();

      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        const fileCfg = JSON.parse(raw);
        this.config = { ...this.defaultConfig, ...fileCfg };
      }

      // Environment variable overrides
      const envUrl = process.env.TINK_SYNC_URL || process.env.TINK_SYNC_BASE_URL;
      const envKey = process.env.TINK_SYNC_API_KEY || process.env.TINK_API_KEY;
      if (envUrl) this.config.apiBaseUrl = envUrl;
      if (envKey) this.config.apiKey = envKey;

      // If no URL or API key, fall back to local to avoid errors in prod
      if (!this.config.apiBaseUrl || !this.config.apiKey) {
        this.config.networkSync = 'local';
      }
    } catch (error) {
      // On any error, fall back to safe defaults
      this.config = { ...this.defaultConfig, networkSync: 'local' };
    }
  }

  saveConfig() {
    try {
      this.ensureDir();
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
      return true;
    } catch (error) {
      return false;
    }
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    return this.saveConfig();
  }
}

module.exports = NetworkConfigManager;


