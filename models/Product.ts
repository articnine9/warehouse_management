import mongoose, { Schema, Model } from "mongoose";

export interface IProduct {
    name: string;
    sku: string;
    category?: string;
    categoryId?: mongoose.Types.ObjectId;
    productType?: "REUSABLE" | "NON_REUSABLE";
    returnDays?: number;
    sellerName: string;
    price: number;
    description?: string;
    status: "ACTIVE" | "INACTIVE";
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

        productType: {
            type: String,
            enum: ["REUSABLE", "NON_REUSABLE"],
            default: "NON_REUSABLE",
        },

        returnDays: {
            type: Number,
            default: 0,
            min: 0,
        },

        sellerName: {
            type: String,
            required: true,
            trim: true,
        },

        price: {
            type: Number,
            required: true,
            min: 0,
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

const Product: Model<IProduct> =
    mongoose.models.Product ||
    mongoose.model<IProduct>("Product", productSchema);

export default Product;