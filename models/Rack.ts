import mongoose, { Schema, Model } from "mongoose";

export interface IRack {
    name: string;
    code: string;
    warehouseId: mongoose.Types.ObjectId;
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

const Rack: Model<IRack> =
    mongoose.models.Rack ||
    mongoose.model<IRack>("Rack", rackSchema);

export default Rack;