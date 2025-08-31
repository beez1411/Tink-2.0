# Paladin API Integration for Tink 2.0

## Overview

Tink 2.0 now supports direct integration with the Paladin Point of Sale (POS) API, allowing you to pull inventory data directly from your Paladin system instead of manually uploading inventory files. This integration provides real-time inventory data and eliminates the need for manual file exports.

## Features

- **Real-time inventory data**: Pull current inventory levels directly from Paladin POS
- **Automatic data conversion**: Seamlessly converts Paladin API data to Tink's expected format
- **Robust error handling**: Comprehensive error handling with retry logic and fallback mechanisms
- **Configuration management**: Secure storage and management of API credentials
- **Progress tracking**: Real-time progress updates during data retrieval
- **Dual mode support**: Choose between API data and traditional file uploads

## Prerequisites

- Paladin POS system with API access enabled
- API credentials (username/password or API key)
- Your Paladin server base URL
- Store ID (if required by your Paladin setup)

## Installation

The Paladin API integration is built into Tink 2.0. No additional installation is required.

## Configuration

### 1. Access API Configuration

1. Open Tink 2.0
2. In the sidebar, locate the "API Configuration" section
3. Click the "Configure" button

### 2. Configure Paladin API Settings

**Basic Settings:**
- **API Base URL**: Your Paladin server URL (e.g., `https://your-paladin-server.com`)
- **Store ID**: Your unique store identifier (if required)

**Authentication:**
Choose one of two authentication methods:

**Option A: Username/Password**
- Username: Your Paladin username
- Password: Your Paladin password

**Option B: API Key**
- API Key: Provided by your Paladin administrator

**Advanced Settings:**
- **Timeout**: Connection timeout in seconds (default: 30)
- **Page Size**: Number of items per API request (default: 100)
- **Max Retries**: Maximum retry attempts for failed requests (default: 3)
- **Retry Delay**: Delay between retry attempts in milliseconds (default: 1000)
- **Include Zero Stock**: Include items with zero stock on hand (default: false)
- **Default Supplier Filter**: Filter by specific supplier (optional)

**General Settings:**
- **Prefer API Over Files**: When enabled, API data is used by default
- **Auto-refresh Interval**: How often to refresh data in API mode (default: 5 minutes)

### 3. Test Connection

1. Click "Test Connection" to verify your configuration
2. If successful, you'll see a "Connected" status
3. If failed, review your settings and network connectivity

### 4. Save Configuration

1. Click "Save Configuration" to store your settings
2. Your credentials are securely stored locally

## Usage

### Enabling API Mode

1. In the API Configuration section, check "Use API Instead of Files"
2. This activates API mode and disables file upload requirements
3. The system will automatically fetch inventory data from your Paladin API

### Refreshing Data

- **Manual Refresh**: Click "Refresh Data" to update inventory information
- **Automatic Refresh**: Data refreshes automatically based on your configured interval
- **Progress Tracking**: Watch real-time progress during data retrieval

### Using API Data

Once API mode is enabled and data is loaded:

1. **Suggested Order**: Works with live inventory data
2. **AceNet Integration**: Uses current inventory levels
3. **Phantom Inventory Detection**: Analyzes real-time stock data
4. **Stock-out Prediction**: Based on current inventory status

## Data Mapping

The integration automatically maps Paladin API data to Tink's expected format:

| Paladin Field | Tink Field | Description |
|---------------|------------|-------------|
| `partNumber` | `PARTNUMBER` | Part/SKU number |
| `description` | `DESCRIPTION1` | Primary description |
| `qtyOnHand` | `STOCKONHAND` | Current stock quantity |
| `unitCost` | `UNITCOST` | Unit cost |
| `retailPrice1` | `RETAILPRICE1` | Primary retail price |
| `minStock` | `MINSTOCK` | Minimum stock level |
| `minOrderQty` | `MINORDERQTY` | Minimum order quantity |
| `supplier` | `SUPPLIER` | Supplier identifier |

**Note**: Sales history data (WEEK_1 through WEEK_104) is currently set to placeholder values as this requires additional API endpoints for historical sales data.

## Error Handling

### Common Issues and Solutions

**Connection Failed**
- Verify your base URL is correct and accessible
- Check your network connection
- Ensure your Paladin server is running

**Authentication Failed**
- Verify your username/password or API key
- Check with your Paladin administrator for correct credentials
- Ensure your account has API access permissions

**No Data Retrieved**
- Check if your supplier filter is too restrictive
- Verify your store ID is correct
- Ensure there are items in your inventory

**Timeout Errors**
- Increase the timeout value in advanced settings
- Check your network connection speed
- Contact your Paladin administrator about server performance

### Fallback Mechanisms

- **Automatic Retry**: Failed requests are automatically retried based on your configuration
- **Progressive Delays**: Retry delays increase progressively to avoid overwhelming the server
- **File Upload Fallback**: You can always disable API mode and return to file uploads
- **Error Logging**: All errors are logged for troubleshooting

## API Endpoints Used

The integration uses the following Paladin API endpoints:

- `POST /api/auth/login` - Authentication
- `GET /api/inventory/items` - Inventory data retrieval
- `POST /api/invoice/process` - Invoice processing (future use)

## Security

- **Local Storage**: All credentials are stored locally in encrypted format
- **No Cloud Storage**: No sensitive data is transmitted to external servers
- **Secure Transmission**: All API communications use HTTPS
- **Automatic Token Refresh**: Authentication tokens are automatically refreshed

## Performance Considerations

- **Pagination**: Large inventories are retrieved in pages to avoid memory issues
- **Rate Limiting**: Built-in delays prevent overwhelming your Paladin server
- **Caching**: Optional caching reduces API calls for frequently accessed data
- **Progress Feedback**: Real-time progress updates for large data retrievals

## Troubleshooting

### Enable Debug Mode

1. Open Developer Tools (F12)
2. Check the Console tab for detailed error messages
3. Look for API-related log messages

### Common Log Messages

**"API Progress: X/Y (Page N/M)"**
- Normal operation - shows data retrieval progress

**"Failed to fetch inventory items"**
- Check network connectivity and API configuration

**"Authentication failed"**
- Verify credentials and server accessibility

**"Invalid configuration"**
- Review required fields in API configuration

### Getting Help

1. Check the error messages in the console
2. Verify your Paladin server is accessible
3. Contact your Paladin administrator for API access issues
4. Review this documentation for configuration steps

## Future Enhancements

### Planned Features

- **Historical Sales Data**: Integration with sales history API endpoints
- **Real-time Sync**: Automatic synchronization with POS transactions
- **Multi-store Support**: Support for multiple store locations
- **Advanced Filtering**: More sophisticated inventory filtering options
- **Performance Metrics**: API performance monitoring and optimization

### API Expansion

- **Invoice Processing**: Automated invoice creation after online sales
- **Customer Data**: Integration with customer management systems
- **Reporting**: Direct integration with Paladin reporting systems

## Technical Architecture

### Components

1. **PaladinAPIClient** (`js/paladin-api-client.js`)
   - Handles HTTP communication with Paladin API
   - Manages authentication and token refresh
   - Provides data conversion utilities

2. **APIConfigManager** (`js/api-config-manager.js`)
   - Manages configuration storage and retrieval
   - Handles validation and security
   - Provides configuration UI support

3. **Main Process Integration** (`main.js`)
   - IPC handlers for configuration and data retrieval
   - Error handling and logging
   - Progress tracking

4. **Renderer Process** (`renderer.js`)
   - UI components for configuration
   - Data loading and display
   - User interaction handling

### Data Flow

1. **Configuration**: User configures API settings through UI
2. **Authentication**: System authenticates with Paladin API
3. **Data Retrieval**: Inventory data is fetched in paginated requests
4. **Conversion**: Paladin data is mapped to Tink format
5. **Processing**: Converted data is used by Tink's analysis engines

## Support

For technical support or questions about the Paladin API integration:

1. Check this documentation first
2. Review error messages in the console
3. Contact your Paladin administrator for API-specific issues
4. Reach out to the Tink development team for integration problems

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Compatible with**: Tink 2.0+, Paladin POS API v1.0+ 