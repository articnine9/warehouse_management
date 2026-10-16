import mongoose, { Schema, Model } from "mongoose";

export interface IRack {
    name: string;
    code: string;
    warehouseId: mongoose.Types.ObjectId;
    zoneId: mongoose.Types.ObjectId;
    status: "ACTIVE" | "INACTIVE";
}

const rackSchema = new Schema<IRack>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },

        warehouseId: {
            type: Schema.Types.ObjectId,
            ref: "Warehouse",
            required: true,
        },

        zoneId: {
            type: Schema.Types.ObjectId,
            ref: "Zone",
            required: [true, "Zone is required for rack"],
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
if (mongoose.models.Rack) {
    delete mongoose.models.Rack;
}

const Rack: Model<IRack> =
    mongoose.models.Rack ||
    mongoose.model<IRack>("Rack", rackSchema);

export default Rack;