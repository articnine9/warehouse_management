import type { HoldingStatus } from "@/lib/serviceCycle";

export type Employee = {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  designation: string;
  warehouse: { id: string; name: string; code: string } | null;
  status: "ACTIVE" | "INACTIVE";
};

export type InventoryItem = {
  _id: string;
  productId: {
    _id: string;
    name: string;
    sku: string;
    category?: string;
    price?: number;
    sellerName?: string;
    productType?: "REUSABLE" | "NON_REUSABLE";
    returnDays?: number;
  };
  warehouseId: {
    _id: string;
    name: string;
    code: string;
  };
  rackId: {
    _id: string;
    name: string;
    code: string;
  };
  quantity: number;
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
};

export type ServiceHistoryRecord = {
  serviceNumber: number;
  completedAt: string;
  notes?: string;
  performedBy?: string;
};

export type RenewalHistoryRecord = {
  renewalNumber: number;
  renewedAt: string;
  extendedDays: number;
  newDueDate: string;
  notes?: string;
  performedBy?: string;
};

export type SelectedLineItem = {
  inventoryId: string;
  productName: string;
  sku: string;
  productType?: "REUSABLE" | "NON_REUSABLE";
  returnDueDays?: number;
  returnDueDate?: string;
  lastRenewedDate?: string;
  renewalCount?: number;
  renewalHistory?: RenewalHistoryRecord[];
  warehouseName: string;
  rackName: string;
  unitPrice: number;
  maxStock: number;
  quantity: number;
  totalValue: number;
  serialNumber?: string;
  warrantyMonths?: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  serviceIntervalMonths?: number;
  lastServiceDate?: string;
  serviceCount?: number;
  serviceHistory?: ServiceHistoryRecord[];
  holdingStatus?: HoldingStatus;
  returnedAt?: string;
  serviceNotes?: string;
};

export type EmployeeIssue = {
  _id: string;
  issueNumber: string;
  employeeId?: string;
  employeeName: string;
  employeeEmail: string;
  employeePhone?: string;
  employeeDepartment?: string;
  reason: "STAFF_USE" | "OFFICE_USE" | "UNIFORM" | "REPLACEMENT" | "OTHER";
  items: SelectedLineItem[];
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  issuedByName?: string;
  notes?: string;
  createdAt: string;
};

export const reasonLabels: Record<EmployeeIssue["reason"], string> = {
  STAFF_USE: "Staff Use",
  OFFICE_USE: "Office Use",
  UNIFORM: "Uniform",
  REPLACEMENT: "Replacement",
  OTHER: "Other",
};

export const holdingStatusLabels: Record<HoldingStatus, string> = {
  ACTIVE: "ACTIVE (In Active Use / Working)",
  INACTIVE: "INACTIVE (Not Working / Idle with Employee)",
  UNDER_SERVICE: "UNDER SERVICE (Maintenance in Progress)",
  RETURNED: "RETURNED (Returned to Warehouse - Stock Restores)",
  DAMAGED: "DAMAGED (Broken / Damaged)",
};
