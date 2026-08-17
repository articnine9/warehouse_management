import mongoose, { Schema, Model } from "mongoose";

export interface IWarehouse {
  name: string;
  code: string;
  address?: string;
  status: "ACTIVE" | "INACTIVE";
}

const warehouseSchema = new Schema<IWarehouse>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    address: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

const Warehouse: Model<IWarehouse> =
  mongoose.models.Warehouse ||
  mongoose.model<IWarehouse>("Warehouse", warehouseSchema);

export default Warehouse;