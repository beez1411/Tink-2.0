# Stock-Out Prediction Feature Documentation

## Overview

The Stock-Out Prediction feature has been successfully implemented in Tink 2.0 to help hardware stores identify potential stock-outs based on sales velocity analysis. This feature analyzes historical sales patterns to detect items that may have fallen out of stock due to theft, misshipments, or other factors.

## Key Features

### Predictive Algorithm
- **Velocity Analysis**: Compares recent sales velocity (last 4 weeks) against baseline velocity (previous 12 weeks)
- **Pattern Recognition**: Identifies items with typical sales patterns (1-2 per week) that suddenly drop to zero sales
- **Confidence Scoring**: Multi-factor confidence calculation based on:
  - Magnitude of drop (>30%, >50%, >70%)
  - Consistency of recent period (all zeros vs. near-zero)
  - Baseline consistency (coefficient of variation)
  - Recent trend analysis

### Seasonal Pattern Detection
- **Historical Comparison**: Analyzes same time periods from previous years
- **Seasonal Exclusion**: Filters out items with natural seasonal lows to reduce false positives
- **Data Requirements**: Requires at least 52 weeks of data for seasonal analysis

### Risk Categorization
- **High Confidence (≥70%)**: Strong indicators of stock-out
- **Medium Confidence (50-69%)**: Moderate risk indicators
- **Low Confidence (30-49%)**: Potential concerns requiring manual review

## User Interface Integration

### New Button Placement
- **Location**: Added under "Check On Planogram" in the sidebar
- **Styling**: Red-themed button (`.btn-stock-out`) matching the alert nature of stock-outs
- **Activation**: Enabled when inventory file is selected

### Display Features
- **Results Table**: Uses the same UI as Suggested Order with enhanced information:
  - Confidence badges (color-coded: green=high, yellow=medium, red=low)
  - Velocity drop percentage
  - Baseline vs. recent velocity tooltips
  - Priority scoring for urgency ranking

### Export Functionality
- **Excel Export**: Comprehensive Excel file with two sheets:
  - "Stock Out Predictions": Detailed item-by-item analysis
  - "Summary": Overall statistics and analysis metadata
- **Formatted Output**: Professional formatting with auto-filtering and column sizing

## Technical Implementation

### Backend Processing (`Stable - Stock Out Prediction.py`)
```python
# Key Functions:
- detect_velocity_drop(): Core algorithm for identifying velocity drops
- analyze_seasonal_patterns(): Seasonal pattern detection
- calculate_baseline_velocity(): Baseline sales calculation
- generate_stockout_predictions(): Main processing function
```

### Frontend Integration
- **New UI Elements**: Button, event handlers, table population
- **Data Flow**: Integrates with existing file selection and on-order data
- **Processing Modal**: Uses existing progress tracking system

### Configuration System
- **Dynamic Config**: Creates temporary config.json for Python script communication
- **On-Order Integration**: Passes current on-order data to algorithm
- **Clean Architecture**: Follows existing pattern matching other features

## Algorithm Logic

### Step 1: Data Filtering
- Active items only (DELETED != 1)
- Specified supplier (default: supplier 10)
- Items with valid sales history

### Step 2: Velocity Calculation
- **Baseline Period**: 12 weeks of historical data (excluding recent 4 weeks)
- **Recent Period**: Last 4 weeks of sales data
- **Non-Zero Focus**: Uses actual selling velocity when item was moving

### Step 3: Risk Assessment
```python
# Threshold: Recent velocity < 30% of baseline velocity
velocity_ratio = recent_velocity / baseline_velocity
is_significant_drop = velocity_ratio < 0.3

# Multi-factor confidence scoring
confidence_score = sum([
    magnitude_factor,      # 0.1-0.3 based on drop severity
    consistency_factor,    # 0.15-0.25 for zero/near-zero sales
    baseline_factor,       # 0.1-0.2 for consistent baseline
    trend_factor          # 0.15 for clear downward trend
])
```

### Step 4: Order Suggestions
- **Suggested Quantity**: 4 weeks of baseline velocity
- **MOQ Compliance**: Ensures minimum order quantities are met
- **Priority Scoring**: Combines confidence, drop magnitude, velocity, and current stock

## Installation Requirements

### Python Dependencies
All dependencies are automatically installed in virtual environment:
```
pandas>=1.5.0          # Data manipulation
numpy>=1.24.0           # Numerical computing
scipy>=1.10.0           # Statistical functions
scikit-learn>=1.3.0     # Machine learning (clustering)
statsmodels>=0.14.0     # Statistical modeling
openpyxl>=3.1.0         # Excel file handling
matplotlib>=3.7.0       # Plotting (for summary charts)
```

### Virtual Environment Setup
- **Location**: `tink_env/` directory
- **Activation**: Automatically handled by main.js
- **Isolation**: Prevents conflicts with system Python packages

## Usage Instructions

### For End Users
1. **File Selection**: Click "Import Inventory" and select inventory data file
2. **Run Analysis**: Click "Detect Stock-Outs" button (red button in sidebar)
3. **Review Results**: Examine items in the order table with confidence indicators
4. **Export Results**: Use existing export functionality to save to Excel
5. **Take Action**: Investigate high-confidence predictions for immediate action

### Sample Output Interpretation
- **High Confidence (≥70%)**: Immediate investigation recommended
- **Drop % >50%**: Significant velocity reduction detected
- **Baseline Velocity >1**: Item was a regular seller
- **Current Stock = 0**: Likely confirms stock-out

## Performance Characteristics

### Processing Speed
- **Chunk Processing**: Handles large datasets (10,000 items per chunk)
- **Memory Efficient**: Processes data in manageable segments
- **Progress Tracking**: Real-time updates during analysis

### Accuracy Considerations
- **Minimum Data**: Requires sufficient sales history for reliable analysis
- **Seasonal Adjustment**: Reduces false positives from seasonal variations
- **Baseline Quality**: More consistent baselines produce better predictions

## Error Handling

### Robust Processing
- **Data Validation**: Handles missing or corrupt data gracefully
- **Fallback Logic**: Continues processing even with partial data issues
- **User Feedback**: Clear error messages and progress indication

### Logging System
- **Detailed Logs**: Comprehensive logging for troubleshooting
- **Statistics Tracking**: Analysis metrics for performance monitoring
- **Debug Output**: Additional information for development/support

## Integration with Existing Features

### On-Order Data
- **Current Integration**: Uses existing on-order tracking
- **Effective Stock**: Considers both on-hand and on-order quantities
- **Dynamic Updates**: Real-time integration with order management

### File Compatibility
- **Same Format**: Uses existing inventory.txt format
- **No Changes Required**: Works with current data structure
- **Backward Compatible**: Doesn't affect existing functionality

## Future Enhancement Opportunities

### Potential Improvements
1. **Machine Learning**: Advanced pattern recognition using neural networks
2. **Supplier Integration**: Direct integration with supplier stock levels
3. **Alert System**: Automated notifications for critical stock-outs
4. **Historical Tracking**: Long-term accuracy monitoring and improvement
5. **Custom Thresholds**: User-configurable sensitivity settings

### Analytics Expansion
1. **Trend Analysis**: Long-term velocity trend identification
2. **Category Analysis**: Stock-out patterns by product category
3. **Supplier Performance**: Track which suppliers have more stock-out issues
4. **Cost Impact**: Calculate financial impact of detected stock-outs

## Technical Support

### File Locations
- **Python Script**: `Stable - Stock Out Prediction.py`
- **Frontend Integration**: `renderer.js` (lines ~722-850)
- **Backend Processing**: `main.js` (lines ~496-620)
- **Styling**: `css/styles.css` (new button and badge styles)

### Dependencies
- **Virtual Environment**: `tink_env/`
- **Requirements**: `requirements.txt`
- **Node Packages**: Uses existing ExcelJS for file parsing

### Troubleshooting
1. **Python Errors**: Check virtual environment activation
2. **Missing Dependencies**: Reinstall requirements.txt
3. **File Access**: Ensure write permissions for output directory
4. **Performance Issues**: Consider reducing dataset size or chunk size

## Summary

The Stock-Out Prediction feature successfully extends Tink 2.0's analytical capabilities by providing intelligent stock-out detection based on sales velocity patterns. The implementation follows the existing architecture patterns, maintains code quality standards, and provides a seamless user experience consistent with other features in the application.

The feature is production-ready and provides immediate value to hardware store operators by helping them identify potential stock-outs before they become critical shortages, ultimately improving customer satisfaction and revenue retention.