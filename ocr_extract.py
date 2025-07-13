# from PIL import Image

import pytesseract

import sys
from PIL import Image
import json
import re
from typing import List, Dict, Optional, Tuple
import cv2
import numpy as np

class ReceiptParser:
    def __init__(self):
        # Define multiple regex patterns for different receipt formats
        self.patterns = [
            # Pattern 1: Basic format "ITEM_NAME   PRICE"
            {
                'name': 'basic_format',
                'regex': r'^(.+?)\s+(\d+\.\d{1,2})$',
                'item_group': 1,
                'price_group': 2,
                'currency_multiplier': 1
            },
            
            # Pattern 2: Format with currency symbol "ITEM_NAME   $PRICE"
            {
                'name': 'currency_format',
                'regex': r'^(.+?)\s+\$(\d+\.\d{1,2})$',
                'item_group': 1,
                'price_group': 2,
                'currency_multiplier': 1
            },
            
            # Pattern 3: Format with quantity "QTY ITEM_NAME   PRICE"
            {
                'name': 'quantity_format',
                'regex': r'^(\d+)\s+(.+?)\s+(\d+\.\d{1,2})$',
                'item_group': 2,
                'price_group': 3,
                'quantity_group': 1,
                'currency_multiplier': 1
            },
            
            # Pattern 4: Tab-separated format
            {
                'name': 'tab_format',
                'regex': r'^(.+?)\t+(\d+\.\d{1,2})$',
                'item_group': 1,
                'price_group': 2,
                'currency_multiplier': 1
            },
            
            # Pattern 5: European format with comma as decimal separator
            {
                'name': 'european_format',
                'regex': r'^(.+?)\s+(\d+,\d{1,2})$',
                'item_group': 1,
                'price_group': 2,
                'currency_multiplier': 1,
                'decimal_separator': ','
            },
            
            # Pattern 6: Format with prices in parentheses (negative amounts)
            {
                'name': 'negative_format',
                'regex': r'^(.+?)\s+\((\d+\.\d{1,2})\)$',
                'item_group': 1,
                'price_group': 2,
                'currency_multiplier': -1
            },
            
            # Pattern 7: Format with item code "CODE - ITEM_NAME   PRICE"
            {
                'name': 'item_code_format',
                'regex': r'^(\d+)\s*-\s*(.+?)\s+(\d+\.\d{1,2})$',
                'item_group': 2,
                'price_group': 3,
                'code_group': 1,
                'currency_multiplier': 1
            },
            
            # Pattern 8: Multi-space format for thermal printer receipts
            {
                'name': 'thermal_format',
                'regex': r'^(.+?)\s{2,}(\d+\.\d{1,2})\s*[A-Z]?$',
                'item_group': 1,
                'price_group': 2,
                'currency_multiplier': 1
            },
            
            # Pattern 9: Format with price ranges "ITEM_NAME   PRICE1-PRICE2"
            {
                'name': 'price_range_format',
                'regex': r'^(.+?)\s+(\d+\.\d{1,2})-(\d+\.\d{1,2})$',
                'item_group': 1,
                'price_group': 2,  # Take the first price
                'currency_multiplier': 1
            },
            
            # Pattern 10: Format with thousands separator "ITEM_NAME   1,234.56"
            {
                'name': 'thousands_format',
                'regex': r'^(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{1,2})$',
                'item_group': 1,
                'price_group': 2,
                'currency_multiplier': 1,
                'remove_thousands_separator': True
            }
        ]
        
        # Lines to skip (common receipt elements that aren't items)
        self.skip_patterns = [
            r'^subtotal',
            r'^total',
            r'^tax',
            r'^change',
            r'^cash',
            r'^card',
            r'^credit',
            r'^debit',
            r'^thank\s+you',
            r'^receipt',
            r'^store',
            r'^date',
            r'^time',
            r'^cashier',
            r'^transaction',
            r'^ref',
            r'^auth',
            r'^\s*$',  # Empty lines
            r'^-+$',   # Separator lines
            r'^=+$',   # Separator lines
            r'^\*+$',  # Separator lines
        ]
    
    def should_skip_line(self, line: str) -> bool:
        """Check if a line should be skipped based on skip patterns"""
        line_lower = line.lower().strip()
        for pattern in self.skip_patterns:
            if re.search(pattern, line_lower):
                return True
        return False
    
    def normalize_price(self, price_str: str, pattern: Dict) -> float:
        """Normalize price string to float based on pattern configuration"""
        # Handle different decimal separators
        if pattern.get('decimal_separator') == ',':
            price_str = price_str.replace(',', '.')
        
        # Remove thousands separators
        if pattern.get('remove_thousands_separator'):
            price_str = price_str.replace(',', '')
        
        # Convert to float and apply multiplier
        try:
            price = float(price_str) * pattern['currency_multiplier']
            return price
        except ValueError:
            return 0.0
    
    def parse_line(self, line: str) -> Optional[Dict]:
        """Try to parse a line using multiple patterns"""
        line = line.strip()
        
        # Skip empty lines or lines that match skip patterns
        if not line or self.should_skip_line(line):
            return None
        
        for pattern in self.patterns:
            match = re.match(pattern['regex'], line)
            if match:
                try:
                    item_name = match.group(pattern['item_group']).strip()
                    price_str = match.group(pattern['price_group'])
                    price = self.normalize_price(price_str, pattern)
                    
                    # Build result dictionary
                    result = {
                        'name': item_name,
                        'price': price,
                        'pattern_used': pattern['name'],
                        'original_line': line
                    }
                    
                    # Add quantity if available
                    if 'quantity_group' in pattern:
                        result['quantity'] = int(match.group(pattern['quantity_group']))
                    
                    # Add item code if available
                    if 'code_group' in pattern:
                        result['code'] = match.group(pattern['code_group'])
                    
                    return result
                    
                except (ValueError, IndexError):
                    continue
        
        return None
    
def extract_items_and_prices(self, image_path: str) -> List[Dict]:
    """Extract items and prices from receipt image"""
    try:
        # Load and preprocess with OpenCV
        image_cv = cv2.imread(image_path)

        # Convert to grayscale
        gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)

        # Apply adaptive threshold to enhance contrast
        processed = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11, 2
        )

        # Convert back to PIL Image for pytesseract
        image = Image.fromarray(processed)

        # Try different OCR configurations for better results
        ocr_configs = [
            '--psm 6',  # Uniform block of text
            '--psm 4',  # Single column of text
            '--psm 8',  # Single word
            '--psm 13'  # Raw line
        ]

        best_text = ""
        best_line_count = 0

        for config in ocr_configs:
            try:
                text = pytesseract.image_to_string(image, config=config)
                line_count = len([l for l in text.split('\n') if l.strip()])
                if line_count > best_line_count:
                    best_text = text
                    best_line_count = line_count
            except:
                continue

        if not best_text:
            return []

        # Parse each line
        items = []
        lines = best_text.split('\n')
                
        for line in lines:
            parsed_item = self.parse_line(line)
            if parsed_item:
                items.append(parsed_item)
            elif re.search(r'\d+\.\d{2}', line):  # Fallback if line has a price
                parts = line.rsplit(' ', 1)
                if len(parts) == 2:
                    name, price_str = parts
                    try:
                        price = float(price_str)
                        items.append({'name': name.strip(), 'price': price})
                    except ValueError:
                        pass

        return items

    except Exception as e:
        print(f"Error processing image: {e}", file=sys.stderr)
        return []

def main():
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(1)
    
    image_path = sys.argv[1]
    parser = ReceiptParser()
    
    try:
        items = parser.extract_items_and_prices(image_path)
        
        # Convert to the expected format for your Node.js backend
        formatted_items = []
        for item in items:
            formatted_items.append({
                'name': item['name'],
                'price': item['price']
            })
        
        print(json.dumps(formatted_items))
        
    except Exception as e:
        print(json.dumps([]))
        sys.exit(1)

if __name__ == "__main__":
    main()
