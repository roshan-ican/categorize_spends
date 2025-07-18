import { Document, Schema, model } from 'mongoose';

// Define the structure for an individual item on the receipt.
export interface Item {
  itemName: string;
  quantity: number;
  unitPrice: number; // Corrected from 'price' to 'unitPrice' for clarity as per parsing logic
  totalPrice: number; // Added for the 'Value' column
  hsnCode?: string | null; // Optional HSN code
  category?: string | null; // Optional category field, explicitly null
}

// Define the Receipt document structure for Mongoose.
export interface Receipt extends Document {
  filename: string;
  // --- New top-level fields for receipt metadata ---
  billNo?: string | null;
  billDate?: Date | null; // Store as Date type
  cashier?: string | null;
  storeName?: string | null;
  address?: string | null;
  phone?: string | null;
  // --------------------------------------------------
  items: Item[];
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  rawText: string;
  processingStatus: 'pending' | 'processed' | 'error';
  uploadedAt: Date;
}

// Mongoose Schema for individual items
const ItemSchema = new Schema<Item>({
  itemName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  unitPrice: { // Matches the new name from parsing
    type: Number,
    required: true
  },
  totalPrice: { // New field for the 'Value' column
    type: Number,
    required: true
  },
  hsnCode: { // New field for HSN
    type: String,
    default: null
  },
  category: {
    type: String,
    default: null
  }
}, { _id: false }); // Setting _id: false for subdocuments is often good practice

// Mongoose Schema for the main Receipt document
const ReceiptSchema = new Schema<Receipt>({
  filename: {
    type: String,
    required: true
  },
  // --- New fields added to the main schema ---
  billNo: {
    type: String,
    default: null
  },
  billDate: {
    type: Date, // Store as Date object
    default: null
  },
  cashier: {
    type: String,
    default: null
  },
  storeName: {
    type: String,
    default: null
  },
  address: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  // ------------------------------------------
  items: [ItemSchema],
  total: {
    type: Number,
    default: null
  },
  subtotal: {
    type: Number,
    default: null
  },
  tax: {
    type: Number,
    default: null
  },
  rawText: {
    type: String,
    required: true
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processed', 'error'],
    default: 'pending',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Export the Mongoose model
export default model<Receipt>('Receipt', ReceiptSchema);