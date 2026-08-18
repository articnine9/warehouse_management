import mongoose, { Schema, Model } from "mongoose";

export interface IProductHistory {
  productId: mongoose.Types.ObjectId;
  action: "CREATED" | "UPDATED" | "DELETED";
  changedBy?: mongoose.Types.ObjectId;
  changedFields?: string[];
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

const productHistorySchema = new Schema<IProductHistory>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: ["CREATED", "UPDATED", "DELETED"],
      required: true,
    },

    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    changedFields: {
      type: [String],
      default: [],
    },

    oldValues: {
      type: Schema.Types.Mixed,
    },

    newValues: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

const ProductHistory: Model<IProductHistory> =
  mongoose.models.ProductHistory ||
  mongoose.model<IProductHistory>("ProductHistory", productHistorySchema);

export default ProductHistory;
