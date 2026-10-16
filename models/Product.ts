import mongoose, { Schema, Model } from "mongoose";

export interface IProduct {
    name: string;
    sku: string;
    category?: string;
    categoryId?: mongoose.Types.ObjectId;
    serviceIntervalMonths?: number;
    warrantyMonths?: number;
    serialNumber?: string;
    sellerName?: string;
    price?: number;
    description?: string;
    status: "ACTIVE" | "INACTIVE";
    createdAt?: Date;
    updatedAt?: Date;
}

const productSchema = new Schema<IProduct>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        sku: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        category: {
            type: String,
            trim: true,
        },

        categoryId: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            index: true,
        },

        serviceIntervalMonths: {
            type: Number,
            default: 3,
            min: 0,
        },

        warrantyMonths: {
            type: Number,
            default: 12,
            min: 0,
        },

        serialNumber: {
            type: String,
            trim: true,
        },

        sellerName: {
            type: String,
            trim: true,
            default: "",
        },

        price: {
            type: Number,
            min: 0,
            default: 0,
        },

        description: {
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

// Indexes for faster search and filtering
productSchema.index({ name: "text", sku: "text" });

const Product: Model<IProduct> =
    mongoose.models.Product ||
    mongoose.model<IProduct>("Product", productSchema);

export default Product;
