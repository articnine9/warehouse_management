import mongoose, { Schema, Model } from "mongoose";

export type MovementType = "INWARD" | "OUTWARD";

export type MovementReason =
  | "INITIAL_STOCK"
  | "RESTOCK"
  | "EMPLOYEE_RETURN"
  | "EMPLOYEE_ISSUE"
  | "INVOICE_SALE"
  | "ADJUSTMENT";

export interface IStockMovement {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  category?: string;
  warehouseId?: mongoose.Types.ObjectId;
  warehouseName?: string;
  rackId?: mongoose.Types.ObjectId;
  rackName?: string;
  movementType: MovementType;
  reason: MovementReason;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  serialNumber?: string;
  referenceId?: string;
  referenceNumber?: string;
  entityName?: string;
  entityId?: string;
  notes?: string;
  performedBy?: mongoose.Types.ObjectId;
  performedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
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
    category: {
      type: String,
      trim: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      index: true,
    },
    warehouseName: {
      type: String,
      trim: true,
    },
    rackId: {
      type: Schema.Types.ObjectId,
      ref: "Rack",
    },
    rackName: {
      type: String,
      trim: true,
    },
    movementType: {
      type: String,
      enum: ["INWARD", "OUTWARD"],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: [
        "INITIAL_STOCK",
        "RESTOCK",
        "EMPLOYEE_RETURN",
        "EMPLOYEE_ISSUE",
        "INVOICE_SALE",
        "ADJUSTMENT",
      ],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    serialNumber: {
      type: String,
      trim: true,
    },
    referenceId: {
      type: String,
      trim: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    entityName: {
      type: String,
      trim: true,
    },
    entityId: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    performedByName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ movementType: 1, createdAt: -1 });

const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", stockMovementSchema);

export default StockMovement;
