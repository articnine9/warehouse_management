import mongoose, { Model, Schema } from "mongoose";

export interface IInventory {
  productId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  rackId: mongoose.Types.ObjectId;
  quantity: number;
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
  createdAt?: Date;
  updatedAt?: Date;
}

const inventorySchema = new Schema<IInventory>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    rackId: {
      type: Schema.Types.ObjectId,
      ref: "Rack",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "AVAILABLE",
        "LOW_STOCK",
        "OUT_OF_STOCK",
      ],
      default: "AVAILABLE",
    },
  },
  {
    timestamps: true,
  }
);

const Inventory: Model<IInventory> =
  mongoose.models.Inventory ||
  mongoose.model<IInventory>(
    "Inventory",
    inventorySchema
  );

export default Inventory;