import mongoose, { Model, Schema } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: "ADMIN" | "STAFF";
  warehouseIds?: mongoose.Types.ObjectId[];
  warehouseId?: mongoose.Types.ObjectId;
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["ADMIN", "STAFF"],
      required: true,
    },
    warehouseIds: {
      type: [Schema.Types.ObjectId],
      ref: "Warehouse",
      default: [],
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

(userSchema as any).set("strictPopulate", false);

// Reset cached model in development so schema updates take effect
if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export default User;
