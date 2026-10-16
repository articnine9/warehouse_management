import mongoose, { Schema, Model } from "mongoose";

export interface IZone {
    name: string;
    code?: string;
    warehouseId: mongoose.Types.ObjectId;
    status: "ACTIVE" | "INACTIVE";
}

const zoneSchema = new Schema<IZone>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            trim: true,
            uppercase: true,
            default: "",
        },

        warehouseId: {
            type: Schema.Types.ObjectId,
            ref: "Warehouse",
            required: true,
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

// Reset cached model in development so schema updates take effect
if (mongoose.models.Zone) {
    delete mongoose.models.Zone;
}

const Zone: Model<IZone> =
    mongoose.models.Zone ||
    mongoose.model<IZone>("Zone", zoneSchema);

export default Zone;
