""
#!/usr/bin/env python3
import pandas as pd
import numpy as np
import logging
from typing import Dict, List
import argparse
import json
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_large_csv(file_path: str, chunksize: int = 10000) -> pd.DataFrame:
    """Load large CSV/TSV in chunks."""
    chunks = []
    for chunk in pd.read_csv(file_path, sep='\t', chunksize=chunksize, low_memory=False):
        chunks.append(chunk)
    return pd.concat(chunks, ignore_index=True)

def compare_orders(tink_file: str, paladin_file: str, history_file: str) -> Dict:
    """Compare Tink and Paladin orders with inventory history."""
    try:
        # Load files
        tink_df = pd.read_csv(tink_file, sep='\t')
        paladin_df = pd.read_csv(paladin_file, sep='\t')
        history_df = load_large_csv(history_file)
        
        # After loading DFs, add specific renaming for Paladin
        paladin_df = paladin_df.rename(columns={'Part number': 'PARTNUMBER', 'Quantity': 'QUANTITY'})

        # Then uppercase all
        paladin_df = paladin_df.rename(columns=lambda x: x.upper())
        tink_df = tink_df.rename(columns=lambda x: x.upper())
        history_df = history_df.rename(columns=lambda x: x.upper())
        
        # After renaming columns, convert PARTNUMBER to string
        tink_df['PARTNUMBER'] = tink_df['PARTNUMBER'].astype(str)
        paladin_df['PARTNUMBER'] = paladin_df['PARTNUMBER'].astype(str)
        history_df['PARTNUMBER'] = history_df['PARTNUMBER'].astype(str)
        
        # Merge on PARTNUMBER
        merged = pd.merge(tink_df[['PARTNUMBER', 'QUANTITY']], 
                          paladin_df[['PARTNUMBER', 'QUANTITY']], 
                          on='PARTNUMBER', suffixes=('_TINK', '_PALADIN'), how='outer')
        
        # Update history merge to use correct columns
        merged = pd.merge(merged, history_df[['PARTNUMBER', 'STOCKONHAND', 'MINSTOCK']], 
                          on='PARTNUMBER', how='left')
        merged = merged.rename(columns={'STOCKONHAND': 'ONHAND', 'MINSTOCK': 'MIN'})
        merged = merged.fillna(0)
        
        # Compute differences
        merged['QTY_DIFF'] = merged['QUANTITY_PALADIN'] - merged['QUANTITY_TINK']
        merged['POTENTIAL_STOCKOUT'] = (merged['ONHAND'] < merged['MIN']) & (merged['QUANTITY_TINK'] < merged['QUANTITY_PALADIN'])
        
        # Metrics
        metrics = {
            'total_parts': len(merged),
            'tink_unique': len(merged[merged['QUANTITY_PALADIN'] == 0]),
            'paladin_unique': len(merged[merged['QUANTITY_TINK'] == 0]),
            'avg_qty_diff': np.mean(merged['QTY_DIFF']),
            'total_tink_qty': sum(merged['QUANTITY_TINK']),
            'total_paladin_qty': sum(merged['QUANTITY_PALADIN']),
            'potential_stockouts': sum(merged['POTENTIAL_STOCKOUT']),
            'timestamp': datetime.now().isoformat()
        }
        
        # Sample differences
        samples = merged[abs(merged['QTY_DIFF']) > 0].head(10).to_dict(orient='records')
        
        # Save CSV here
        merged.to_csv('comparison_output.csv', index=False)
        
        return {
            'metrics': metrics,
            'sample_differences': samples,
            'full_comparison_file': 'comparison_output.csv'
        }
    except Exception as e:
        logger.error(f'Error comparing orders: {e}')
        return {'error': str(e)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compare Tink and Paladin orders')
    parser.add_argument('--tink', required=True, help='Tink PO file')
    parser.add_argument('--paladin', required=True, help='Paladin order file')
    parser.add_argument('--history', required=True, help='Inventory history file')
    args = parser.parse_args()
    
    results = compare_orders(args.tink, args.paladin, args.history)
    print(json.dumps(results, indent=2)) 