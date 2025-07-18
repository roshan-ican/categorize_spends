import fs from 'fs/promises';
import visionClient from '../config/visionClient';

export interface ParsedItem {
  itemName: string;
  quantity: number;
  price: number;
  category: string | null;
}

export interface ParsedReceipt {
  items: ParsedItem[];
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  rawText: string;
}

export async function extractReceiptDataFromBuffer(imageBuffer: Buffer): Promise<ParsedReceipt> {
  try {
    // Use buffer with Vision API
    const [result] = await visionClient.textDetection({
      image: { content: imageBuffer },
    });

    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      throw new Error('No text found in image.');
    }

    const fullText = detections[0].description || '';
    const lines = fullText.split('\n').map(line => line.trim());

    const items: ParsedItem[] = [];
    let total: number | null = null;
    let subtotal: number | null = null;
    let tax: number | null = null;

    const itemLineRegex = /^(.+?)\s+([\d.]+)\s+([\d.]+)$/;
    const totalRegex = /(total|amount due)\s*[:\-]?\s*([\d.,]+)/i;
    const taxRegex = /tax\s*[:\-]?\s*([\d.,]+)/i;
    const subtotalRegex = /subtotal\s*[:\-]?\s*([\d.,]+)/i;

    for (const line of lines) {
      const itemMatch = line.match(itemLineRegex);
      const totalMatch = line.match(totalRegex);
      const taxMatch = line.match(taxRegex);
      const subMatch = line.match(subtotalRegex);

      if (itemMatch) {
        items.push({
          itemName: itemMatch[1],
          quantity: parseFloat(itemMatch[2]),
          price: parseFloat(itemMatch[3]),
          category: null
        });
      } else if (totalMatch) {
        total = parseFloat(totalMatch[2].replace(',', ''));
      } else if (taxMatch) {
        tax = parseFloat(taxMatch[1].replace(',', ''));
      } else if (subMatch) {
        subtotal = parseFloat(subMatch[1].replace(',', ''));
      }
    }

    return {
      items,
      total,
      subtotal,
      tax,
      rawText: fullText
    };
  } catch (err) {
    console.error('Vision OCR error:', err);
    throw err;
  }
}

export async function extractReceiptData(imagePath: string): Promise<ParsedReceipt> {
  const imageBuffer = await fs.readFile(imagePath);
  return await extractReceiptDataFromBuffer(imageBuffer);
}
