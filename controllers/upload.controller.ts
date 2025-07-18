import { Request, Response } from 'express';
import * as fs from 'fs/promises'; // Use fs/promises for async operations
import { extractReceiptDataFromBuffer } from '../service/extractReceiptDataFromBuffer'; // Adjust path
import Receipt from '../models/recipt'; // Adjust path to your model

export async function handleUpload(req: Request, res: Response): Promise<void> {
  console.log("Files received:", req.files);

  const file = (req.files as Express.Multer.File[])?.[0];

  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // Use file.buffer instead of reading from file.path
  if (!file.buffer) {
    res.status(500).json({ error: 'File buffer not found.' });
    return;
  }

  try {
    // Pass the buffer directly to your OCR function
    const parsed = await extractReceiptDataFromBuffer(file.buffer);
    console.log(parsed, "Parsed receipt data");

    const receipt = new Receipt({
      filename: file.originalname,
      billNo: parsed.billNo,
      billDate: parsed.billDate ? new Date(parsed.billDate) : null, // Convert string to Date object
      cashier: parsed.cashier,
      storeName: parsed.storeName,
      address: parsed.address,
      phone: parsed.phone,
      items: parsed.items,
      total: parsed.total,
      subtotal: parsed.subtotal,
      tax: parsed.tax,
      rawText: parsed.rawText,
      processingStatus: 'processed',
      // uploadedAt will default to Date.now() as per schema
    });
    await receipt.save();

    res.json({ success: true, receipt });
  } catch (err: any) {
    console.error('OCR processing failed:', err);
    res.status(500).json({ error: 'OCR processing failed', details: err.message });
  }
}