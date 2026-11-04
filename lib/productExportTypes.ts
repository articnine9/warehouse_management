export interface ProductExportLocation {
  inventoryId?: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  warehouseAddress?: string;
  warehouseStatus?: string;
  zoneId?: string;
  zoneName?: string;
  zoneCode?: string;
  zoneStatus?: string;
  rackId: string;
  rackName: string;
  rackCode: string;
  rackStatus?: string;
  quantity: number;
  status?: string;
  recordedStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductExportRecord {
  _id: string;
  name: string;
  sku: string;
  category?: string;
  categoryId?: string | { _id: string; name?: string; code?: string };
  productType?: "REUSABLE" | "NON_REUSABLE";
  status?: string;
  price?: number | null;
  sellerName?: string;
  serialNumber?: string;
  warrantyMonths?: number;
  serviceIntervalMonths?: number;
  returnDueDays?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  totalStock: number;
  stockStatus?: string;
  locations: ProductExportLocation[];
}

export interface ProductExportInfo {
  generatedAt: string;
  scope: "ALL_WAREHOUSES" | "ASSIGNED_WAREHOUSES";
}
