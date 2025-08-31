/**
 * Paladin POS API Client
 * Handles communication with Paladin Point of Sale system for inventory data
 * Based on Paladin eCommerce API specification
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class PaladinAPIClient {
    constructor(config = {}) {
        this.baseURL = config.baseURL || '';
        this.apiKey = config.apiKey || '';
        this.username = config.username || '';
        this.password = config.password || '';
        this.storeId = config.storeId || '';
        this.timeout = config.timeout || 30000; // 30 seconds
        this.pageSize = config.pageSize || 100; // Default page size for pagination
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000; // 1 second
        
        // Cache for authentication tokens
        this.authToken = null;
        this.tokenExpiry = null;
        
        console.log('Paladin API Client initialized');
    }

    /**
     * Configure API connection settings
     */
    configure(config) {
        this.baseURL = config.baseURL || this.baseURL;
        this.apiKey = config.apiKey || this.apiKey;
        this.username = config.username || this.username;
        this.password = config.password || this.password;
        this.storeId = config.storeId || this.storeId;
        this.timeout = config.timeout || this.timeout;
        this.pageSize = config.pageSize || this.pageSize;
        
        // Clear cached auth when config changes
        this.authToken = null;
        this.tokenExpiry = null;
        
        console.log('Paladin API Client reconfigured');
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            // First, try authentication
            await this.authenticate();
            
            // Then try to make a simple API call to test the connection
            try {
                // Try to get a small sample of inventory data
                const result = await this.getInventoryItems({ limit: 1 });
                return {
                    success: true,
                    message: 'Successfully connected to Paladin API',
                    itemCount: result.totalItems || 0
                };
            } catch (apiError) {
                // If inventory fails, try a basic connectivity test
                console.log('Inventory call failed, testing basic connectivity:', apiError.message);
                
                // Try a simple GET request to test connectivity
                const response = await this.makeRequest('GET', '/api/v1/pos');
                
                return {
                    success: true,
                    message: 'Connection successful (basic connectivity test)',
                    itemCount: 0
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Authenticate with Paladin API
     * Based on the actual Paladin eCommerce API structure
     */
    async authenticate() {
        if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.authToken;
        }

        try {
            // For the Paladin eCommerce API, authentication might be basic auth
            // Let's try a simple test call first to validate the connection
            console.log('Testing Paladin API connection...');
            
            // If using basic auth, we don't need a separate authentication endpoint
            // The authentication is handled in the HTTP headers
            if (this.username && this.password) {
                // Set up basic auth - we'll use this for all requests
                this.authToken = 'BASIC_AUTH'; // Placeholder token
                this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
                
                console.log('Using basic authentication for Paladin API');
                return this.authToken;
            } else if (this.apiKey) {
                // If using API key
                this.authToken = this.apiKey;
                this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
                
                console.log('Using API key authentication for Paladin API');
                return this.authToken;
            } else {
                throw new Error('No authentication credentials provided');
            }
        } catch (error) {
            console.error('Paladin API authentication failed:', error);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Get inventory items from Paladin API
     * Based on the actual Paladin eCommerce API structure
     */
    async getInventoryItems(options = {}) {
        const {
            partNumber = null,
            page = 1,
            limit = this.pageSize,
            includeZeroStock = false,
            supplierFilter = null
        } = options;

        try {
            await this.authenticate();

            // For the Paladin eCommerce API, the endpoint structure is different
            // Based on the base URL structure, inventory endpoints should be:
            let endpoint = '/api/v1/pos/api/inventory';
            
            if (partNumber) {
                // Get specific item by part number
                endpoint = `/api/v1/pos/api/inventory/${partNumber}`;
            } else {
                // Get all items with pagination
                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: limit.toString()
                });

                if (!includeZeroStock) {
                    params.append('excludeZeroStock', 'true');
                }

                if (supplierFilter) {
                    params.append('supplier', supplierFilter);
                }

                endpoint = `/api/v1/pos/api/inventory?${params}`;
            }

            const response = await this.makeRequest('GET', endpoint);
            
            // Handle different response formats
            if (Array.isArray(response)) {
                // If response is directly an array
                return {
                    success: true,
                    items: response,
                    totalItems: response.length,
                    currentPage: page,
                    totalPages: 1,
                    hasMore: false
                };
            } else if (response && typeof response === 'object') {
                // If response is an object with data
                return {
                    success: true,
                    items: response.items || response.data || [response],
                    totalItems: response.totalItems || response.total || (response.items ? response.items.length : 1),
                    currentPage: response.currentPage || page,
                    totalPages: response.totalPages || 1,
                    hasMore: response.hasMore || false
                };
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            console.error('Error fetching inventory items:', error);
            throw new Error(`Failed to fetch inventory items: ${error.message}`);
        }
    }

    /**
     * Get all inventory items with pagination
     */
    async getAllInventoryItems(options = {}) {
        const {
            supplierFilter = null,
            includeZeroStock = false,
            onProgress = null
        } = options;

        console.log('Starting to fetch all inventory items from Paladin API...');
        
        const allItems = [];
        let currentPage = 1;
        let hasMore = true;

        try {
            while (hasMore) {
                console.log(`Fetching page ${currentPage}...`);
                
                const result = await this.getInventoryItems({
                    page: currentPage,
                    limit: this.pageSize,
                    includeZeroStock,
                    supplierFilter
                });

                allItems.push(...result.items);
                
                // Progress callback
                if (onProgress) {
                    onProgress({
                        current: allItems.length,
                        total: result.totalItems,
                        page: currentPage,
                        totalPages: result.totalPages
                    });
                }

                hasMore = result.hasMore;
                currentPage++;

                // Add delay between requests to avoid overwhelming the API
                if (hasMore) {
                    await this.delay(200);
                }
            }

            console.log(`Successfully fetched ${allItems.length} items from Paladin API`);
            
            return {
                success: true,
                items: allItems,
                totalItems: allItems.length
            };
        } catch (error) {
            console.error('Error fetching all inventory items:', error);
            throw new Error(`Failed to fetch all inventory items: ${error.message}`);
        }
    }

    /**
     * Get single inventory item by part number
     */
    async getInventoryItem(partNumber) {
        try {
            const result = await this.getInventoryItems({ partNumber, limit: 1 });
            
            if (result.items && result.items.length > 0) {
                return {
                    success: true,
                    item: result.items[0]
                };
            } else {
                return {
                    success: false,
                    message: `Item not found: ${partNumber}`
                };
            }
        } catch (error) {
            console.error(`Error fetching item ${partNumber}:`, error);
            throw new Error(`Failed to fetch item ${partNumber}: ${error.message}`);
        }
    }

    /**
     * Process completed invoice (for future use)
     * Based on the actual Paladin eCommerce API structure
     */
    async processCompletedInvoice(invoiceData) {
        try {
            await this.authenticate();

            // For the Paladin eCommerce API, invoice processing might be different
            const response = await this.makeRequest('POST', '/api/v1/pos/invoice', invoiceData);
            
            return {
                success: true,
                invoiceId: response.invoiceId || response.id,
                message: 'Invoice processed successfully'
            };
        } catch (error) {
            console.error('Error processing invoice:', error);
            throw new Error(`Failed to process invoice: ${error.message}`);
        }
    }

    /**
     * Convert Paladin API data to Tink format
     */
    convertToTinkFormat(paladinItems) {
        console.log(`Converting ${paladinItems.length} Paladin items to Tink format...`);
        
        const tinkItems = paladinItems.map(item => {
            // Map Paladin API fields to Tink expected fields
            const tinkItem = {
                PARTNUMBER: item.partNumber || item.sku || '',
                DESCRIPTION1: item.description || item.desc1 || '',
                DESCRIPTION2: item.description2 || item.desc2 || '',
                STOCKONHAND: this.parseNumber(item.qtyOnHand) || 0,
                UNITCOST: this.parseNumber(item.unitCost) || 0,
                RETAILPRICE1: this.parseNumber(item.retailPrice1) || 0,
                RETAILPRICE2: this.parseNumber(item.retailPrice2) || 0,
                MINSTOCK: this.parseNumber(item.minStock) || 0,
                MAXSTOCK: this.parseNumber(item.maxStock) || 0,
                MINORDERQTY: this.parseNumber(item.minOrderQty) || 1,
                SUPPLIER: item.supplier || item.supplierNumber || '',
                SUPPLIERPARTNUMBER: item.supplierPartNumber || '',
                CATEGORY: item.category || '',
                LOCATION: item.location || '',
                ACTIVE: item.active !== false ? 'Y' : 'N',
                LASTMODIFIED: item.lastModified || new Date().toISOString(),
                
                // Add placeholder sales history (would need historical data API)
                ...this.generatePlaceholderSalesHistory()
            };

            return tinkItem;
        });

        console.log(`Successfully converted ${tinkItems.length} items to Tink format`);
        return tinkItems;
    }

    /**
     * Generate placeholder sales history for Tink compatibility
     * In a real implementation, this would come from a sales history API
     */
    generatePlaceholderSalesHistory() {
        const salesHistory = {};
        
        // Generate 104 weeks of placeholder sales data
        for (let week = 1; week <= 104; week++) {
            salesHistory[`WEEK_${week}`] = 0; // Placeholder - would need actual sales data
        }
        
        return salesHistory;
    }

    /**
     * Make HTTP request with retry logic
     */
    async makeRequest(method, endpoint, data = null, retryCount = 0) {
        // Handle URL construction properly
        let fullUrl;
        try {
            // If endpoint starts with /, it's relative to the base URL
            if (endpoint.startsWith('/')) {
                fullUrl = this.baseURL + endpoint;
            } else {
                fullUrl = this.baseURL + '/' + endpoint;
            }
            
            // Clean up any double slashes (except after protocol)
            fullUrl = fullUrl.replace(/([^:]\/)\/+/g, '$1');
            
            const url = new URL(fullUrl);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            
            console.log(`Making ${method} request to: ${fullUrl}`);
            
            // Log authentication details for debugging
            if (this.username && this.password) {
                console.log(`Using basic auth with username: ${this.username}`);
                console.log(`Store ID: ${this.storeId}`);
            }
        } catch (urlError) {
            throw new Error(`Invalid URL format: ${this.baseURL} + ${endpoint} - ${urlError.message}`);
        }
        
        const url = new URL(fullUrl);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Tink-2.0-API-Client'
            }
        };

        // Add authentication header
        if (this.authToken === 'BASIC_AUTH' && this.username && this.password) {
            // Basic authentication
            const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            options.headers['Authorization'] = `Basic ${credentials}`;
            console.log(`Setting Authorization header: Basic ${credentials.substring(0, 20)}...`);
        } else if (this.apiKey) {
            // API key authentication
            options.headers['X-API-Key'] = this.apiKey;
            console.log(`Setting X-API-Key header: ${this.apiKey.substring(0, 20)}...`);
        } else if (this.authToken && this.authToken !== 'BASIC_AUTH') {
            // Token-based authentication
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
            console.log(`Setting Authorization header: Bearer ${this.authToken.substring(0, 20)}...`);
        }

        return new Promise((resolve, reject) => {
            const req = httpModule.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = responseData ? JSON.parse(responseData) : {};
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsedData);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.message || 'Request failed'}`));
                        }
                    } catch (error) {
                        reject(new Error(`Invalid JSON response: ${error.message}`));
                    }
                });
            });

            req.on('error', async (error) => {
                if (retryCount < this.maxRetries) {
                    console.log(`Request failed, retrying... (${retryCount + 1}/${this.maxRetries})`);
                    await this.delay(this.retryDelay * (retryCount + 1));
                    try {
                        const result = await this.makeRequest(method, endpoint, data, retryCount + 1);
                        resolve(result);
                    } catch (retryError) {
                        reject(retryError);
                    }
                } else {
                    reject(new Error(`Request failed after ${this.maxRetries} retries: ${error.message}`));
                }
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            // Send request body if provided
            if (data && (method === 'POST' || method === 'PUT')) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    /**
     * Parse number from string with fallback
     */
    parseNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    /**
     * Delay utility for rate limiting
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get connection status
     */
    isConfigured() {
        return !!(this.baseURL && (this.apiKey || (this.username && this.password)));
    }

    /**
     * Get configuration summary
     */
    getConfigSummary() {
        return {
            baseURL: this.baseURL,
            hasApiKey: !!this.apiKey,
            hasCredentials: !!(this.username && this.password),
            storeId: this.storeId,
            isConfigured: this.isConfigured()
        };
    }
}

module.exports = PaladinAPIClient; 