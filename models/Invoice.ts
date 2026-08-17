import mongoose, { Schema, Model } from "mongoose";

export interface IInvoiceItem {
  inventoryId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  warehouseId: mongoose.Types.ObjectId;
  warehouseName: string;
  rackId: mongoose.Types.ObjectId;
  rackName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface IInvoice {
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: IInvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: "CASH" | "UPI" | "CARD" | "CREDIT";
  notes?: string;
  issuedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    inventoryId: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    warehouseName: {
      type: String,
      required: true,
      trim: true,
    },
    rackId: {
      type: Schema.Types.ObjectId,
      ref: "Rack",
      required: true,
    },
    rackName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerAddress: {
      type: String,
      trim: true,
    },
    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: [
        (val: IInvoiceItem[]) => val.length > 0,
        "At least one item is required in the invoice",
      ],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "CREDIT"],
      default: "CASH",
    },
    notes: {
      type: String,
      trim: true,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice ||
  mongoose.model<IInvoice>("Invoice", invoiceSchema);

export default Invoice;
