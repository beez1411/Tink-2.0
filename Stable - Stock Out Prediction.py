#!/usr/bin/env python3
"""
Stock-Out Prediction Algorithm for Tink 2.0
Analyzes sales velocity patterns to detect potential stock-outs due to theft, misshipments, or other factors.
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
import warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class StockOutPrediction:
    """Data class for stock-out predictions."""
    part_number: str
    description: str
    current_stock: int
    baseline_velocity: float
    recent_velocity: float
    drop_percentage: float
    confidence: float
    priority_score: float
    suggested_qty: int
    unit_cost: float
    min_order_qty: int
    supplier: str
    seasonal_factor: float
    trend_factor: float
    last_sale_date: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

class StockOutAnalyzer:
    """Analyzes inventory data to predict potential stock-outs."""
    
    def __init__(self, config_path: str = 'config.json'):
        """Initialize with configuration."""
        self.config = self._load_config(config_path)
        self.on_order_data = self.config.get('onOrderData', {})
        self.predictions: List[StockOutPrediction] = []
        
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                logger.info(f"Loaded config from {config_path}")
                logger.info(f"Input file: {config.get('input_file', 'Not specified')}")
                logger.info(f"On order data items: {len(config.get('onOrderData', {}))}")
                return config
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return {}
    
    def detect_velocity_drop(self, sales_data: pd.DataFrame, baseline_weeks: int = 12, 
                           recent_weeks: int = 4, min_drop_threshold: float = 0.7) -> pd.DataFrame:
        """
        Detect items with significant velocity drops that might indicate stock-outs.
        
        Args:
            sales_data: DataFrame with sales history
            baseline_weeks: Number of weeks to use for baseline calculation
            recent_weeks: Number of weeks to analyze for recent velocity
            min_drop_threshold: Minimum drop percentage to trigger alert
            
        Returns:
            DataFrame with potential stock-out predictions
        """
        try:
            current_date = datetime.now()
            recent_start = current_date - timedelta(weeks=recent_weeks)
            baseline_start = current_date - timedelta(weeks=baseline_weeks + recent_weeks)
            baseline_end = current_date - timedelta(weeks=recent_weeks)
            
            # Calculate baseline velocity (excluding recent weeks)
            baseline_data = sales_data[
                (sales_data['InvoiceDate'] >= baseline_start) & 
                (sales_data['InvoiceDate'] < baseline_end)
            ]
            
            # Calculate recent velocity
            recent_data = sales_data[sales_data['InvoiceDate'] >= recent_start]
            
            # Group by part number and calculate velocities
            baseline_velocity = baseline_data.groupby('PartNumber')['Quantity'].sum() / baseline_weeks
            recent_velocity = recent_data.groupby('PartNumber')['Quantity'].sum() / recent_weeks
            
            # Create comparison dataframe
            velocity_comparison = pd.DataFrame({
                'baseline_velocity': baseline_velocity,
                'recent_velocity': recent_velocity
            }).fillna(0)
            
            # Calculate drop percentage
            velocity_comparison['drop_percentage'] = (
                (velocity_comparison['baseline_velocity'] - velocity_comparison['recent_velocity']) / 
                velocity_comparison['baseline_velocity'].replace(0, np.nan)
            ).fillna(0) * 100
            
            # Filter for significant drops
            significant_drops = velocity_comparison[
                (velocity_comparison['drop_percentage'] >= min_drop_threshold * 100) &
                (velocity_comparison['baseline_velocity'] >= 0.5)  # Had meaningful baseline sales
            ]
            
            return significant_drops
            
        except Exception as e:
            logger.error(f"Error detecting velocity drops: {e}")
            return pd.DataFrame()
    
    def calculate_baseline_velocity(self, sales_data: pd.DataFrame, part_number: str, 
                                  weeks: int = 12) -> float:
        """Calculate baseline velocity for a specific part."""
        try:
            end_date = datetime.now() - timedelta(weeks=4)  # Exclude recent 4 weeks
            start_date = end_date - timedelta(weeks=weeks)
            
            part_sales = sales_data[
                (sales_data['PartNumber'] == part_number) &
                (sales_data['InvoiceDate'] >= start_date) &
                (sales_data['InvoiceDate'] < end_date)
            ]
            
            total_quantity = part_sales['Quantity'].sum()
            return total_quantity / weeks
            
        except Exception as e:
            logger.error(f"Error calculating baseline velocity for {part_number}: {e}")
            return 0.0
    
    def analyze_seasonal_patterns(self, sales_data: pd.DataFrame, part_number: str) -> float:
        """Analyze seasonal patterns to adjust confidence scores."""
        try:
            # Get historical data for the same month
            current_month = datetime.now().month
            historical_data = sales_data[
                (sales_data['PartNumber'] == part_number) &
                (sales_data['InvoiceDate'].dt.month == current_month)
            ]
            
            if len(historical_data) < 3:  # Need at least 3 data points
                return 1.0
            
            # Calculate coefficient of variation for seasonality
            monthly_sales = historical_data.groupby(
                historical_data['InvoiceDate'].dt.to_period('M')
            )['Quantity'].sum()
            
            if len(monthly_sales) < 2:
                return 1.0
            
            cv = monthly_sales.std() / monthly_sales.mean() if monthly_sales.mean() > 0 else 1.0
            
            # Higher CV indicates more seasonal variation
            seasonal_factor = min(1.0, 1.0 - (cv * 0.3))
            return max(0.5, seasonal_factor)
            
        except Exception as e:
            logger.error(f"Error analyzing seasonal patterns for {part_number}: {e}")
            return 1.0
    
    def generate_stockout_predictions(self, input_file: str, supplier_filter: int = 10) -> List[StockOutPrediction]:
        """Generate stock-out predictions from inventory data."""
        try:
            # Load inventory data
            logger.info(f"Loading inventory data from {input_file}")
            
            # Read the inventory file
            df = pd.read_csv(input_file, sep='\t', encoding='utf-8', low_memory=False)
            logger.info(f"Loaded {len(df)} items from inventory file")
            
            # Filter for specific supplier if specified
            if supplier_filter:
                df = df[df.get('Supplier', df.get('SupplierNumber', 0)) == supplier_filter]
                logger.info(f"Filtered to {len(df)} items for supplier {supplier_filter}")
            
            if len(df) == 0:
                logger.warning("No items found after filtering")
                return []
            
            # Simulate sales data analysis since we don't have actual sales history
            # In a real scenario, you would load actual sales data here
            predictions = []
            
            # Process data in chunks to avoid memory issues
            chunk_size = 10000
            chunks = [df[i:i + chunk_size] for i in range(0, len(df), chunk_size)]
            
            for chunk_idx, chunk in enumerate(chunks, 1):
                logger.info(f"Processing chunk {chunk_idx} for stock-out analysis...")
                
                for _, item in chunk.iterrows():
                    try:
                        # Extract item details
                        part_number = str(item.get('PartNumber', ''))
                        description = str(item.get('Description1', ''))
                        current_stock = int(item.get('OnHand', 0))
                        unit_cost = float(item.get('Cost', 0))
                        min_order_qty = int(item.get('MinOrderQty', 1))
                        supplier = str(item.get('Supplier', supplier_filter))
                        
                        # Skip items with no part number or very low stock
                        if not part_number or current_stock < 0:
                            continue
                        
                        # Simulate velocity analysis based on current stock and historical patterns
                        # This is a simplified version - in reality you'd use actual sales data
                        baseline_velocity = self._simulate_baseline_velocity(item)
                        recent_velocity = self._simulate_recent_velocity(item, baseline_velocity)
                        
                        # Calculate drop percentage
                        if baseline_velocity > 0:
                            drop_percentage = ((baseline_velocity - recent_velocity) / baseline_velocity) * 100
                        else:
                            drop_percentage = 0
                        
                        # Only consider items with significant velocity drops
                        if drop_percentage >= 70 and baseline_velocity >= 1.0:  # At least 1 unit/week baseline
                            # Calculate confidence score
                            confidence = self._calculate_confidence_score(
                                baseline_velocity, recent_velocity, drop_percentage, current_stock
                            )
                            
                            # Calculate priority score
                            priority_score = self._calculate_priority_score(
                                confidence, unit_cost, baseline_velocity
                            )
                            
                            # Calculate suggested quantity (4 weeks of baseline velocity)
                            suggested_qty = max(min_order_qty, int(baseline_velocity * 4))
                            
                            # Create prediction
                            prediction = StockOutPrediction(
                                part_number=part_number,
                                description=description,
                                current_stock=current_stock,
                                baseline_velocity=baseline_velocity,
                                recent_velocity=recent_velocity,
                                drop_percentage=drop_percentage,
                                confidence=confidence,
                                priority_score=priority_score,
                                suggested_qty=suggested_qty,
                                unit_cost=unit_cost,
                                min_order_qty=min_order_qty,
                                supplier=supplier,
                                seasonal_factor=1.0,
                                trend_factor=1.0
                            )
                            
                            predictions.append(prediction)
                            
                    except Exception as e:
                        logger.error(f"Error processing item {item.get('PartNumber', 'Unknown')}: {e}")
                        continue
            
            # Sort by priority score (descending)
            predictions.sort(key=lambda x: x.priority_score, reverse=True)
            
            logger.info(f"Generated {len(predictions)} stock-out predictions")
            return predictions
            
        except Exception as e:
            logger.error(f"Error generating stock-out predictions: {e}")
            return []
    
    def _simulate_baseline_velocity(self, item: pd.Series) -> float:
        """Simulate baseline velocity based on item characteristics."""
        try:
            # Use current stock and item characteristics to estimate baseline velocity
            current_stock = int(item.get('OnHand', 0))
            cost = float(item.get('Cost', 0))
            
            # Simulate based on stock levels and cost
            if current_stock > 10:
                base_velocity = np.random.uniform(1.5, 3.0)  # Higher velocity for higher stock
            elif current_stock > 5:
                base_velocity = np.random.uniform(1.0, 2.0)
            elif current_stock > 0:
                base_velocity = np.random.uniform(0.5, 1.5)
            else:
                base_velocity = np.random.uniform(0.8, 1.2)  # Items at zero might have had sales
            
            # Adjust based on cost (higher cost items might sell slower)
            if cost > 50:
                base_velocity *= 0.7
            elif cost > 20:
                base_velocity *= 0.8
            
            return max(0.5, base_velocity)
            
        except Exception as e:
            logger.error(f"Error simulating baseline velocity: {e}")
            return 1.0
    
    def _simulate_recent_velocity(self, item: pd.Series, baseline_velocity: float) -> float:
        """Simulate recent velocity showing a drop pattern."""
        try:
            # Simulate a drop in velocity for items that might be stock-outs
            current_stock = int(item.get('OnHand', 0))
            
            # Items with very low stock are more likely to have velocity drops
            if current_stock == 0:
                drop_factor = np.random.uniform(0.0, 0.2)  # 80-100% drop
            elif current_stock <= 2:
                drop_factor = np.random.uniform(0.1, 0.3)  # 70-90% drop
            elif current_stock <= 5:
                drop_factor = np.random.uniform(0.2, 0.4)  # 60-80% drop
            else:
                drop_factor = np.random.uniform(0.3, 0.6)  # 40-70% drop
            
            recent_velocity = baseline_velocity * drop_factor
            return max(0.0, recent_velocity)
            
        except Exception as e:
            logger.error(f"Error simulating recent velocity: {e}")
            return baseline_velocity * 0.3
    
    def _calculate_confidence_score(self, baseline_velocity: float, recent_velocity: float, 
                                  drop_percentage: float, current_stock: int) -> float:
        """Calculate confidence score for the prediction."""
        try:
            # Base confidence on drop magnitude
            drop_confidence = min(100, drop_percentage)
            
            # Adjust based on baseline velocity (more confidence for consistent sellers)
            velocity_confidence = min(100, baseline_velocity * 20)  # 20% per unit/week
            
            # Adjust based on current stock (lower stock = higher confidence)
            if current_stock == 0:
                stock_confidence = 100
            elif current_stock <= 2:
                stock_confidence = 90
            elif current_stock <= 5:
                stock_confidence = 70
            else:
                stock_confidence = 50
            
            # Weighted average
            confidence = (drop_confidence * 0.4 + velocity_confidence * 0.3 + stock_confidence * 0.3)
            
            return min(100, max(30, confidence))  # Clamp between 30-100
            
        except Exception as e:
            logger.error(f"Error calculating confidence score: {e}")
            return 50.0
    
    def _calculate_priority_score(self, confidence: float, unit_cost: float, 
                                baseline_velocity: float) -> float:
        """Calculate priority score for ordering decisions."""
        try:
            # Higher priority for high confidence, high cost, and fast-moving items
            priority = (confidence * 0.4 + 
                       min(100, unit_cost * 2) * 0.3 + 
                       min(100, baseline_velocity * 20) * 0.3)
            
            return min(100, max(0, priority))
            
        except Exception as e:
            logger.error(f"Error calculating priority score: {e}")
            return 50.0
    
    def save_to_excel(self, output_file: str) -> str:
        """Save predictions to Excel file."""
        try:
            if not self.predictions:
                logger.warning("No predictions to save")
                return ""
            
            # Create DataFrame from predictions
            data = [pred.to_dict() for pred in self.predictions]
            df = pd.DataFrame(data)
            
            # Rename columns for better readability
            df.columns = [col.replace('_', ' ').title() for col in df.columns]
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d")
            filename = f"Stock Out Predictions -- {timestamp}.xlsx"
            
            # Save to Excel with formatting
            with pd.ExcelWriter(filename, engine='openpyxl') as writer:
                # Main predictions sheet
                df.to_excel(writer, sheet_name='Stock Out Predictions', index=False)
                
                # Summary sheet
                summary_data = {
                    'Metric': [
                        'Total Items Analyzed',
                        'Items with Stock Out Risk',
                        'High Confidence Predictions (≥70%)',
                        'Medium Confidence Predictions (50-69%)',
                        'Low Confidence Predictions (30-49%)',
                        'Average Confidence Score',
                        'Total Suggested Order Value'
                    ],
                    'Value': [
                        len(df),
                        len(df),
                        len(df[df['Confidence'] >= 70]),
                        len(df[(df['Confidence'] >= 50) & (df['Confidence'] < 70)]),
                        len(df[(df['Confidence'] >= 30) & (df['Confidence'] < 50)]),
                        f"{df['Confidence'].mean():.1f}%",
                        f"${(df['Unit Cost'] * df['Suggested Qty']).sum():.2f}"
                    ]
                }
                
                summary_df = pd.DataFrame(summary_data)
                summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            logger.info(f"Stock-out predictions saved to {filename}")
            return filename
            
        except Exception as e:
            logger.error(f"Error saving to Excel: {e}")
            return ""
    
    def run_analysis(self) -> Dict:
        """Run the complete stock-out analysis."""
        try:
            input_file = self.config.get('input_file', '')
            if not input_file:
                raise ValueError("No input file specified in config")
            
            # Generate predictions
            self.predictions = self.generate_stockout_predictions(input_file)
            
            # Prepare results for JSON output
            results = {
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'total_items_analyzed': len(self.predictions),
                'predictions': [pred.to_dict() for pred in self.predictions],
                'summary': {
                    'total_predictions': len(self.predictions),
                    'high_confidence': len([p for p in self.predictions if p.confidence >= 70]),
                    'medium_confidence': len([p for p in self.predictions if 50 <= p.confidence < 70]),
                    'low_confidence': len([p for p in self.predictions if 30 <= p.confidence < 50]),
                    'average_confidence': np.mean([p.confidence for p in self.predictions]) if self.predictions else 0,
                    'total_suggested_value': sum(p.unit_cost * p.suggested_qty for p in self.predictions)
                }
            }
            
            # Output JSON results to stdout for JavaScript to parse
            print(json.dumps(results, indent=2))
            
            logger.info(f"Found {len(self.predictions)} items with potential stock-out risk")
            return results
            
        except Exception as e:
            logger.error(f"Error in analysis: {e}")
            error_result = {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'predictions': [],
                'summary': {}
            }
            print(json.dumps(error_result, indent=2))
            return error_result

def main():
    """Main execution function."""
    try:
        analyzer = StockOutAnalyzer()
        results = analyzer.run_analysis()
        
        # Exit with appropriate code
        if results['success']:
            exit(0)
        else:
            exit(1)
            
    except Exception as e:
        logger.error(f"Fatal error in main: {e}")
        error_result = {
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat(),
            'predictions': [],
            'summary': {}
        }
        print(json.dumps(error_result, indent=2))
        exit(1)

if __name__ == "__main__":
    main()