import mongoose, { Schema, Model } from "mongoose";
import type { SavedConditionQuantities } from "@/lib/productCondition";

export interface IProduct {
    name: string;
    sku: string;
    category: string;
    categoryId?: mongoose.Types.ObjectId;
    productType?: "REUSABLE" | "NON_REUSABLE";
    returnDueDays?: number;
    serviceIntervalMonths?: number;
    warrantyMonths?: number;
    serialNumber?: string;
    sellerName?: string;
    price?: number;
    description?: string;
    status: "ACTIVE" | "INACTIVE";
    conditionStatus: "NEW" | "USED" | "GOOD_CONDITION" | "DAMAGED" | "SCRAP";
    conditionQuantities?: SavedConditionQuantities;
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
            required: true,
            trim: true,
        },

        categoryId: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            index: true,
        },

        productType: {
            type: String,
            enum: ["REUSABLE", "NON_REUSABLE"],
            required: false,
        },

        returnDueDays: {
            type: Number,
            required: false,
            min: 0,
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

        conditionStatus: {
            type: String,
            enum: ["NEW", "USED", "GOOD_CONDITION", "DAMAGED", "SCRAP"],
            default: "NEW",
        },
        conditionQuantities: {
            type: new Schema({
                new: { type: Number, min: 0, validate: Number.isSafeInteger },
                used: { type: Number, min: 0, validate: Number.isSafeInteger },
                good: { type: Number, min: 0, validate: Number.isSafeInteger },
                damaged: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
                scrap: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
            }, { _id: false }),
            default: undefined,
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
