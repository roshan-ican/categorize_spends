import pytesseract
import sys
from PIL import Image
import json
import re
from typing import List, Dict, Optional
import cv2
import numpy as np

import re
from google import genai
import os

API_KEY = os.getenv('GEMINI_API_KEY', 'Message in group for api key or take from gemeni')

class ReceiptParser:
    def __init__(self):
        self.patterns = [
            {'name': 'basic_format', 'regex': r'^(.+?)\s+(\d+\.\d{1,2})$', 'item_group': 1, 'price_group': 2, 'currency_multiplier': 1},
            {'name': 'currency_format', 'regex': r'^(.+?)\s+\$(\d+\.\d{1,2})$', 'item_group': 1, 'price_group': 2, 'currency_multiplier': 1},
            {'name': 'quantity_format', 'regex': r'^(\d+)\s+(.+?)\s+(\d+\.\d{1,2})$', 'item_group': 2, 'price_group': 3, 'quantity_group': 1, 'currency_multiplier': 1},
            {'name': 'tab_format', 'regex': r'^(.+?)\t+(\d+\.\d{1,2})$', 'item_group': 1, 'price_group': 2, 'currency_multiplier': 1},
            {'name': 'european_format', 'regex': r'^(.+?)\s+(\d+,\d{1,2})$', 'item_group': 1, 'price_group': 2, 'currency_multiplier': 1, 'decimal_separator': ','},
            {'name': 'negative_format', 'regex': r'^(.+?)\s+\((\d+\.\d{1,2})\)$', 'item_group': 1, 'price_group': 2, 'currency_multiplier': -1},
            {'name': 'item_code_format', 'regex': r'^(\d+)\s*-\s*(.+?)\s+(\d+\.\d{1,2})$', 'item_group': 2, 'price_group': 3, 'code_group': 1, 'currency_multiplier': 1},
            {'name': 'thermal_format', 'regex': r'^(.+?)\s{2,}(\d+\.\d{1,2})\s*[A-Z]?$', 'item_group': 1, 'price_group': 2, 'currency_multiplier': 1},
            {'name': 'price_range_format', 'regex': r'^(.+?)\s+(\d+\.\d{1,2})-(\d+\.\d{1,2})$', 'item_group': 1, 'price_group': 2, 'currency_multiplier': 1},
            {'name': 'thousands_format', 'regex': r'^(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{1,2})$', 'item_group': 1, 'price_group': 2, 'currency_multiplier': 1, 'remove_thousands_separator': True},
            {      # put it first so it matches early
            'name': 'int_price_format',
            'regex': r'^(.+?)\s+(\d+)$',   # e.g.  ONIONS 50
            'item_group': 1,
            'price_group': 2,
            'currency_multiplier': 1
}
        ]

        self.skip_patterns = [
            r'^subtotal', r'^total', r'^tax', r'^change', r'^cash', r'^card', r'^credit', r'^debit', r'^thank\s+you', r'^receipt',
            r'^store', r'^date', r'^time', r'^cashier', r'^transaction', r'^ref', r'^auth',
            r'^\s*$', r'^-+$', r'^=+$', r'^\*+$'
        ]

    def should_skip_line(self, line: str) -> bool:
        line_lower = line.lower().strip()
        return any(re.search(pattern, line_lower) for pattern in self.skip_patterns)

    def normalize_price(self, price_str: str, pattern: Dict) -> float:
        if pattern.get('decimal_separator') == ',':
            price_str = price_str.replace(',', '.')
        if pattern.get('remove_thousands_separator'):
            price_str = price_str.replace(',', '')
        try:
            return float(price_str) * pattern['currency_multiplier']
        except ValueError:
            return 0.0

    def parse_line(self, line: str) -> Optional[Dict]:
        line = line.strip()
        if not line or self.should_skip_line(line):
            return None

        for pattern in self.patterns:
            match = re.match(pattern['regex'], line)
            if match:
                try:
                    item_name = match.group(pattern['item_group']).strip()
                    price_str = match.group(pattern['price_group'])
                    price = self.normalize_price(price_str, pattern)

                    result = {
                        'name': item_name,
                        'price': price,
                        'pattern_used': pattern['name'],
                        'original_line': line
                    }

                    if 'quantity_group' in pattern:
                        result['quantity'] = int(match.group(pattern['quantity_group']))
                    if 'code_group' in pattern:
                        result['code'] = match.group(pattern['code_group'])

                    return result
                except (ValueError, IndexError):
                    continue

        return None

    def extract_items_and_prices(self, image_path: str) -> List[Dict]:
        try:
            # image_cv = cv2.imread(image_path)
            # gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)

            # processed = cv2.adaptiveThreshold(
            #     gray, 255,
            #     cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            #     cv2.THRESH_BINARY,
            #     11, 2
            # )

            # # ✅ Add dilation to help with handwritten text
            # kernel = np.ones((2, 2), np.uint8)
            # processed = cv2.dilate(processed, kernel, iterations=1)

            # image = Image.fromarray(processed)

            # ocr_configs = ['--psm 6', '--psm 4', '--psm 8', '--psm 13']


            # Above code not working

            image_cv = cv2.imread(image_path)
            image = Image.fromarray(image_cv)

            ocr_configs = ['--psm 6', '--psm 11', '--psm 4']


            best_text = ""
            best_line_count = 0

            for config in ocr_configs:
                try:
                    text = pytesseract.image_to_string(image, config=config)
                    line_count = len([l for l in text.split('\n') if l.strip()])
                    if line_count > best_line_count:
                        best_text = text
                        best_line_count = line_count
                except Exception as e:
                    print(f"[OCR error] {e}", file=sys.stderr)

            if not best_text:
                print(">>> No OCR text found", file=sys.stderr)
                return []
            # print('is it working')
            # ✅ Log raw OCR output
            # print(">>> OCR Raw Output:\n", best_text, file=sys.stderr)

            # Configure the API key (using an environment variable)
            client = genai.Client(api_key=API_KEY)

            # print('here here')

            # Create a GenerativeModel instance
            # model = genai.('gemini-2.5-flash')

            prompt = f"""
Extract the items from this bill and give only a JSON list of dictionaries with "name" and "price" keys.

Bill:
{best_text}

Format:
[
  {{ "name": "ItemName", "price": Price }}
]
"""
            

          

            # Make a request to generate content
            # response = model.generate_content(prompt)
            response = client.models.generate_content(model='gemini-2.5-flash',contents=prompt)

            response_text = response.text

            # Print the generated text

            # items = []

            cleaned = re.sub(r"```(?:json)?", "", response_text).strip("` \n")

            items = json.loads(cleaned)
            # print('Response From AI:',items)
            # lines = best_text.split('\n')

            # for line in lines:
            #     parsed_item = self.parse_line(line)
            #     if parsed_item:
            #         items.append(parsed_item)
            #     elif re.search(r'\d+\.\d{2}', line):  # Fallback
            #         parts = line.rsplit(' ', 1)
            #         if len(parts) == 2:
            #             name, price_str = parts
            #             try:
            #                 price = float(price_str)
            #                 items.append({'name': name.strip(), 'price': price})
            #             except ValueError:
            #                 pass

            return items

        except Exception as e:
            print(f"[Processing error] {e}", file=sys.stderr)
            return []

def main():
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(1)

    image_path = sys.argv[1]
    parser = ReceiptParser()

    try:
        items = parser.extract_items_and_prices(image_path)
        formatted_items = [{'name': item['name'], 'price': item['price']} for item in items]
        print(json.dumps(formatted_items))
    except Exception as e:
        print(f"[Main error] {e}", file=sys.stderr)
        print(json.dumps([]))
        sys.exit(1)

if __name__ == "__main__":
    main()