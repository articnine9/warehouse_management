import mongoose, { Model, Schema } from "mongoose";

export interface IServiceRecord {
  serviceNumber: number;
  completedAt: Date;
  notes?: string;
  performedBy?: string;
}

export interface IEmployeeIssueItem {
  inventoryId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  warehouseId: mongoose.Types.ObjectId;
  warehouseName: string;
  rackId: mongoose.Types.ObjectId;
  rackName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  serialNumber?: string;
  warrantyMonths?: number;
  warrantyStartDate?: Date;
  warrantyEndDate?: Date;
  serviceIntervalMonths?: number; // e.g. 3, 6, 12 months
  lastServiceDate?: Date;
  serviceCount?: number;
  serviceHistory?: IServiceRecord[];
  holdingStatus?: "ACTIVE" | "INACTIVE" | "UNDER_SERVICE" | "RETURNED" | "DAMAGED";
  returnedAt?: Date;
  serviceNotes?: string;
}

export interface IEmployeeIssue {
  issueNumber: string;
  employeeId: mongoose.Types.ObjectId;
  employeeName: string;
  employeeEmail: string;
  employeePhone?: string;
  employeeDepartment?: string;
  reason: "STAFF_USE" | "OFFICE_USE" | "UNIFORM" | "REPLACEMENT" | "OTHER";
  items: IEmployeeIssueItem[];
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  notes?: string;
  issuedBy?: mongoose.Types.ObjectId;
  issuedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const serviceRecordSchema = new Schema<IServiceRecord>(
  {
    serviceNumber: { type: Number, required: true },
    completedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
    performedBy: { type: String, trim: true },
  },
  { _id: false }
);

const employeeIssueItemSchema = new Schema<IEmployeeIssueItem>(
  {
    inventoryId: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    warehouseName: {
      type: String,
      required: true,
      trim: true,
    },
    rackId: {
      type: Schema.Types.ObjectId,
      ref: "Rack",
      required: true,
    },
    rackName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalValue: {
      type: Number,
      required: true,
      min: 0,
    },
    serialNumber: {
      type: String,
      trim: true,
    },
    warrantyMonths: {
      type: Number,
      default: 0,
    },
    warrantyStartDate: {
      type: Date,
    },
    warrantyEndDate: {
      type: Date,
    },
    serviceIntervalMonths: {
      type: Number,
      default: 0, // 0 = no periodic service, 3 = every 3 months, 6 = every 6 months, 12 = every 12 months
    },
    lastServiceDate: {
      type: Date,
    },
    serviceCount: {
      type: Number,
      default: 0,
    },
    serviceHistory: {
      type: [serviceRecordSchema],
      default: [],
    },
    holdingStatus: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "UNDER_SERVICE", "RETURNED", "DAMAGED"],
      default: "ACTIVE",
    },
    returnedAt: {
      type: Date,
    },
    serviceNotes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const employeeIssueSchema = new Schema<IEmployeeIssue>(
  {
    issueNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    employeeEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    employeePhone: {
      type: String,
      trim: true,
    },
    employeeDepartment: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      enum: ["STAFF_USE", "OFFICE_USE", "UNIFORM", "REPLACEMENT", "OTHER"],
      default: "STAFF_USE",
    },
    items: {
      type: [employeeIssueItemSchema],
      required: true,
      validate: [
        (val: IEmployeeIssueItem[]) => val.length > 0,
        "At least one item is required in the employee issue",
      ],
    },
    totalItems: {
      type: Number,
      required: true,
      min: 1,
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    totalValue: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    issuedByName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const EmployeeIssue: Model<IEmployeeIssue> =
  mongoose.models.EmployeeIssue ||
  mongoose.model<IEmployeeIssue>("EmployeeIssue", employeeIssueSchema);

export default EmployeeIssue;
