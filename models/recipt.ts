import { Document, Schema, model } from 'mongoose';

// Type alias for individual item on the receipt
export type Item = {
  name: string;
  price: number;
};

// Type alias for the Receipt document
export type Receipt = Document & {
  filename: string;
  items: Item[];
  uploadedAt: Date;
};

const ItemSchema = new Schema<Item>({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  }
});

const ReceiptSchema = new Schema<Receipt>({
  filename: {
    type: String,
    required: true
  },
  items: [ItemSchema],
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

export default model<Receipt>('Receipt', ReceiptSchema);