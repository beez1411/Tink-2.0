import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import math
import logging
import warnings
from typing import List, Tuple, Dict, Optional
from scipy import stats
import json
import os
warnings.filterwarnings('ignore', category=RuntimeWarning)

def setup_logging():
    """Set up logging configuration."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )

def calculate_baseline_velocity(sales_series: np.ndarray, baseline_weeks: int = 12) -> float:
    """
    Calculate baseline sales velocity over a specified period.
    Returns average sales per week during the baseline period.
    """
    if len(sales_series) < baseline_weeks:
        baseline_weeks = len(sales_series)
    
    baseline_data = sales_series[-baseline_weeks:]
    # Remove zeros to get actual sales velocity when item was moving
    non_zero_sales = baseline_data[baseline_data > 0]
    
    if len(non_zero_sales) == 0:
        return 0.0
    
    return np.mean(non_zero_sales)

def detect_velocity_drop(sales_series: np.ndarray, recent_weeks: int = 4, 
                        baseline_weeks: int = 12, threshold_ratio: float = 0.3) -> Dict:
    """
    Detect significant drops in sales velocity that might indicate stock-outs.
    
    Args:
        sales_series: Array of weekly sales data
        recent_weeks: Number of recent weeks to analyze
        baseline_weeks: Number of weeks to use for baseline calculation
        threshold_ratio: Minimum ratio of recent to baseline velocity to trigger alert
    
    Returns:
        Dict with detection results
    """
    if len(sales_series) < recent_weeks + baseline_weeks:
        return {
            'is_stockout_risk': False,
            'reason': 'Insufficient data',
            'baseline_velocity': 0.0,
            'recent_velocity': 0.0,
            'drop_percentage': 0.0,
            'confidence_score': 0.0
        }
    
    # Calculate baseline velocity (excluding recent weeks)
    baseline_data = sales_series[-(baseline_weeks + recent_weeks):-recent_weeks]
    recent_data = sales_series[-recent_weeks:]
    
    baseline_velocity = calculate_baseline_velocity(baseline_data, baseline_weeks)
    recent_velocity = np.mean(recent_data)
    
    # If baseline velocity is too low, item wasn't moving much anyway
    if baseline_velocity < 0.5:  # Less than 0.5 units per week on average
        return {
            'is_stockout_risk': False,
            'reason': 'Low baseline velocity',
            'baseline_velocity': baseline_velocity,
            'recent_velocity': recent_velocity,
            'drop_percentage': 0.0,
            'confidence_score': 0.0
        }
    
    # Calculate drop percentage
    if baseline_velocity > 0:
        velocity_ratio = recent_velocity / baseline_velocity
        drop_percentage = (1 - velocity_ratio) * 100
    else:
        velocity_ratio = 0
        drop_percentage = 0
    
    # Check for significant drop
    is_significant_drop = velocity_ratio < threshold_ratio
    
    # Calculate confidence score based on multiple factors
    confidence_factors = []
    
    # Factor 1: Magnitude of drop
    if drop_percentage > 70:
        confidence_factors.append(0.3)  # High confidence for severe drops
    elif drop_percentage > 50:
        confidence_factors.append(0.2)  # Medium confidence
    elif drop_percentage > 30:
        confidence_factors.append(0.1)  # Low confidence
    
    # Factor 2: Consistency of recent period (all zeros or very low)
    if np.all(recent_data == 0):
        confidence_factors.append(0.25)  # High confidence for complete stop
    elif np.mean(recent_data) < 0.1:
        confidence_factors.append(0.15)  # Medium confidence for near-zero
    
    # Factor 3: Baseline consistency (was it a steady seller?)
    baseline_std = np.std(baseline_data)
    baseline_cv = baseline_std / baseline_velocity if baseline_velocity > 0 else 0
    if baseline_cv < 0.5:  # Low coefficient of variation = consistent sales
        confidence_factors.append(0.2)
    elif baseline_cv < 1.0:
        confidence_factors.append(0.1)
    
    # Factor 4: Recent trend analysis
    if len(recent_data) > 1:
        # Check if there's a clear downward trend
        recent_trend = np.polyfit(range(len(recent_data)), recent_data, 1)[0]
        if recent_trend < -0.1:  # Negative trend
            confidence_factors.append(0.15)
    
    confidence_score = min(sum(confidence_factors), 1.0)
    
    return {
        'is_stockout_risk': is_significant_drop and confidence_score > 0.3,
        'reason': 'Significant velocity drop detected' if is_significant_drop else 'No significant drop',
        'baseline_velocity': baseline_velocity,
        'recent_velocity': recent_velocity,
        'drop_percentage': drop_percentage,
        'confidence_score': confidence_score,
        'velocity_ratio': velocity_ratio
    }

def analyze_seasonal_patterns(sales_series: np.ndarray) -> Dict:
    """
    Analyze if the current low sales could be due to seasonal patterns.
    """
    if len(sales_series) < 52:  # Need at least a year of data
        return {'is_seasonal': False, 'seasonal_confidence': 0.0}
    
    # Look for similar patterns in previous years
    current_week = len(sales_series) % 52
    
    # Get sales for the same week in previous years
    same_week_sales = []
    for year_offset in range(1, min(3, len(sales_series) // 52 + 1)):  # Look back up to 2 years
        week_index = len(sales_series) - (52 * year_offset)
        if week_index >= 0:
            same_week_sales.append(sales_series[week_index])
    
    if len(same_week_sales) < 1:
        return {'is_seasonal': False, 'seasonal_confidence': 0.0}
    
    # If current sales match historical pattern for this time of year
    current_recent = np.mean(sales_series[-4:])  # Last 4 weeks
    historical_avg = np.mean(same_week_sales)
    
    if historical_avg < 0.5 and current_recent < 0.5:
        return {'is_seasonal': True, 'seasonal_confidence': 0.8}
    
    return {'is_seasonal': False, 'seasonal_confidence': 0.0}

def generate_stockout_predictions(
    input_file: str,
    output_file: str,
    supplier_number: int = 10,
    chunk_size: int = 10000,
    on_order_data: Optional[Dict] = None
) -> Dict:
    """
    Generate stock-out predictions based on sales velocity analysis.
    
    Returns:
        Dictionary with prediction results and statistics
    """
    setup_logging()
    
    if on_order_data is None:
        on_order_data = {}
    
    stockout_items = []
    analysis_stats = {
        'total_items_analyzed': 0,
        'items_with_stockout_risk': 0,
        'high_confidence_predictions': 0,
        'seasonal_exclusions': 0
    }
    
    week_columns = [f'WEEK_{i}' for i in range(104)]
    
    try:
        chunk_iter = pd.read_csv(input_file, sep='\t', encoding='utf-8', 
                                low_memory=False, chunksize=chunk_size)
    except FileNotFoundError:
        logging.error(f"Input file '{input_file}' not found.")
        return {'success': False, 'error': 'Input file not found'}
    
    for chunk_idx, df_chunk in enumerate(chunk_iter):
        logging.info(f"Processing chunk {chunk_idx + 1} for stock-out analysis...")
        
        df_chunk = df_chunk.copy()
        df_chunk['PARTNUMBER'] = df_chunk['PARTNUMBER'].astype(str)
        
        # Filter active items from specified supplier
        df_chunk = df_chunk[df_chunk['DELETED'] != 1]
        df_chunk = df_chunk[df_chunk['SUPPLIER_NUMBER1'] == supplier_number]
        
        # Ensure numeric columns
        numeric_columns = ['STOCKONHAND', 'MINSTOCK', 'UNITCOST', 'MINORDERQTY']
        for col in numeric_columns:
            df_chunk[col] = pd.to_numeric(df_chunk[col], errors='coerce').fillna(0)
        
        # Ensure sales columns exist and are numeric
        for col in week_columns:
            if col in df_chunk.columns:
                df_chunk[col] = pd.to_numeric(df_chunk[col], errors='coerce').fillna(0)
            else:
                df_chunk[col] = 0
        
        # Analyze each item
        for idx, row in df_chunk.iterrows():
            analysis_stats['total_items_analyzed'] += 1
            
            part_number = row['PARTNUMBER']
            sales_series = row[week_columns].values.astype(float)
            stock_on_hand = row['STOCKONHAND']
            min_stock = row['MINSTOCK']
            unit_cost = row['UNITCOST']
            min_order_qty = row['MINORDERQTY']
            
            # Get on-order quantity if available
            on_order_qty = on_order_data.get(part_number, 0)
            effective_stock = stock_on_hand + on_order_qty
            
            # Run stock-out detection
            stockout_analysis = detect_velocity_drop(sales_series)
            
            if stockout_analysis['is_stockout_risk']:
                # Check if it might be seasonal
                seasonal_analysis = analyze_seasonal_patterns(sales_series)
                
                if seasonal_analysis['is_seasonal']:
                    analysis_stats['seasonal_exclusions'] += 1
                    continue
                
                analysis_stats['items_with_stockout_risk'] += 1
                
                if stockout_analysis['confidence_score'] > 0.7:
                    analysis_stats['high_confidence_predictions'] += 1
                
                # Calculate suggested order quantity
                baseline_velocity = stockout_analysis['baseline_velocity']
                suggested_weeks_stock = 4  # Suggest 4 weeks of stock
                suggested_qty = math.ceil(baseline_velocity * suggested_weeks_stock)
                
                # Ensure minimum order quantity is met
                if min_order_qty > 0:
                    suggested_qty = max(suggested_qty, min_order_qty)
                
                # Calculate priority score (higher = more urgent)
                priority_score = (
                    stockout_analysis['confidence_score'] * 0.4 +
                    (stockout_analysis['drop_percentage'] / 100) * 0.3 +
                    (baseline_velocity / 10) * 0.2 +  # Higher velocity = higher priority
                    (1 - min(effective_stock / max(baseline_velocity, 1), 1)) * 0.1
                )
                
                stockout_items.append({
                    'Date': datetime.now().strftime('%d-%b-%Y %I:%M:%S %p'),
                    'Type': 'Stock Out Prediction',
                    'Filename': f'Stock Out Predictions -- {datetime.now().strftime("%d-%b-%Y %H:%M")}',
                    'Part number': part_number,
                    'Description 1': row['DESCRIPTION1'],
                    'Current Stock': int(stock_on_hand),
                    'On Order': int(on_order_qty),
                    'Effective Stock': int(effective_stock),
                    'Baseline Velocity': round(baseline_velocity, 2),
                    'Recent Velocity': round(stockout_analysis['recent_velocity'], 2),
                    'Drop %': round(stockout_analysis['drop_percentage'], 1),
                    'Confidence': round(stockout_analysis['confidence_score'] * 100, 1),
                    'Suggested Qty': int(suggested_qty),
                    'Unit Cost': round(unit_cost, 2),
                    'Total Cost': round(suggested_qty * unit_cost, 2),
                    'Priority Score': round(priority_score, 3),
                    'Min Order Qty': int(min_order_qty),
                    'Analysis Details': {
                        'velocity_ratio': stockout_analysis['velocity_ratio'],
                        'reason': stockout_analysis['reason']
                    }
                })
    
    # Sort by priority score (highest first)
    stockout_items.sort(key=lambda x: x['Priority Score'], reverse=True)
    
    # Create output DataFrame
    if stockout_items:
        stockout_df = pd.DataFrame(stockout_items)
        
        # Remove the analysis details column for Excel output
        export_df = stockout_df.drop(columns=['Analysis Details']).copy()
        
        try:
            # Save to Excel with formatting
            with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
                export_df.to_excel(writer, sheet_name='Stock Out Predictions', index=False)
                
                # Add summary sheet
                summary_data = {
                    'Metric': [
                        'Total Items Analyzed',
                        'Items with Stock Out Risk',
                        'High Confidence Predictions',
                        'Seasonal Exclusions',
                        'Analysis Date'
                    ],
                    'Value': [
                        analysis_stats['total_items_analyzed'],
                        analysis_stats['items_with_stockout_risk'],
                        analysis_stats['high_confidence_predictions'],
                        analysis_stats['seasonal_exclusions'],
                        datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    ]
                }
                
                summary_df = pd.DataFrame(summary_data)
                summary_df.to_excel(writer, sheet_name='Summary', index=False)
                
                # Format the main sheet
                worksheet = writer.sheets['Stock Out Predictions']
                worksheet.auto_filter.ref = worksheet.dimensions
                
                # Set column widths
                column_widths = {
                    'A': 12,  # Date
                    'B': 15,  # Type
                    'C': 30,  # Filename
                    'D': 15,  # Part number
                    'E': 40,  # Description
                    'F': 12,  # Current Stock
                    'G': 10,  # On Order
                    'H': 12,  # Effective Stock
                    'I': 15,  # Baseline Velocity
                    'J': 15,  # Recent Velocity
                    'K': 10,  # Drop %
                    'L': 12,  # Confidence
                    'M': 12,  # Suggested Qty
                    'N': 12,  # Unit Cost
                    'O': 12,  # Total Cost
                    'P': 15,  # Priority Score
                    'Q': 12   # Min Order Qty
                }
                
                for col_letter, width in column_widths.items():
                    worksheet.column_dimensions[col_letter].width = width
            
            logging.info(f"Stock-out predictions saved to {output_file}")
            logging.info(f"Found {len(stockout_items)} items with potential stock-out risk")
            
        except Exception as e:
            logging.error(f"Failed to save Excel file: {e}")
            return {'success': False, 'error': str(e)}
    else:
        logging.info("No stock-out risks detected")
    
    return {
        'success': True,
        'predictions': stockout_items,
        'stats': analysis_stats,
        'total_predictions': len(stockout_items)
    }

def main():
    """Main entry point for the script."""
    setup_logging()
    
    import sys
    import json
    
    # Check if we're being called with command line arguments or via wrapper
    input_file = "Inventory.txt"
    on_order_data = {}
    
    # Try to read from config file if it exists (for Electron integration)
    config_file = "config.json"
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
                input_file = config.get('input_file', input_file)
                on_order_data = config.get('onOrderData', {})
                logging.info(f"Loaded config from {config_file}")
                logging.info(f"Input file: {input_file}")
                logging.info(f"On order data items: {len(on_order_data)}")
        except Exception as e:
            logging.warning(f"Could not read config file: {e}")
    
    output_file = f"Stock Out Predictions -- {datetime.now().strftime('%Y-%m-%d')}.xlsx"
    
    result = generate_stockout_predictions(input_file, output_file, on_order_data=on_order_data)
    
    if result['success']:
        print(f"\nStock-out analysis completed successfully!")
        print(f"Found {result['total_predictions']} items with potential stock-out risk")
        print(f"Results saved to: {output_file}")
        
        # Output results in JSON format for the wrapper to parse
        print("JSON_RESULT_START")
        print(json.dumps({
            'success': True,
            'predictions': len(result.get('predictions', [])),
            'output_file': output_file,
            'stats': result.get('stats', {})
        }))
        print("JSON_RESULT_END")
    else:
        print(f"Analysis failed: {result.get('error', 'Unknown error')}")
        print("JSON_RESULT_START")
        print(json.dumps({
            'success': False,
            'error': result.get('error', 'Unknown error')
        }))
        print("JSON_RESULT_END")

if __name__ == "__main__":
    main()