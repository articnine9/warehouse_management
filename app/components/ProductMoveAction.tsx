"use client";

import { ComponentProps, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import MoveProductModal from "./MoveProductModal";

type MoveProps = ComponentProps<typeof MoveProductModal>;
type Props = {
  product: { id: string; name: string; sku: string; productType?: string };
  inventoryLocations: {
    id: string;
    warehouse?: { _id: string; name: string } | null;
    rack?: { _id: string; name: string; zoneId?: { name: string } | string } | null;
    quantity: number;
  }[];
  onSuccess: () => void;
};

export default function ProductMoveAction({ product, inventoryLocations, onSuccess }: Props) {
  const [destinations, setDestinations] = useState<Pick<MoveProps, "zones" | "racks"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const locations = inventoryLocations.flatMap((location) => {
    if (!location.warehouse?._id || !location.rack?._id) return [];
    return [{
      inventoryId: location.id,
      warehouseId: location.warehouse._id,
      warehouseName: location.warehouse.name,
      rackId: location.rack._id,
      rackName: location.rack.name,
      zoneName: typeof location.rack.zoneId === "object" ? location.rack.zoneId?.name : undefined,
      quantity: location.quantity,
    }];
  });

  async function openMove() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const [zones, racks] = await Promise.all(["/api/zones", "/api/racks"].map(async (url) => {
        const response = await fetch(url);
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error("Unable to load move destinations. Please try again.");
        }
        return result.data;
      }));
      setDestinations({ zones, racks });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load move destinations. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void openMove()}
        disabled={loading || locations.length === 0}
        title={locations.length === 0 ? "Assign this product to a rack in Inventory before moving it" : "Move product to another Zone or Rack"}
        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
        {loading ? "Loading..." : "Move"}
      </button>
      {error && <p role="alert" className="max-w-xs text-xs text-red-600">{error}</p>}
      {destinations && createPortal(
        <MoveProductModal
          product={{ _id: product.id, name: product.name, sku: product.sku, productType: product.productType, locations }}
          zones={destinations.zones}
          racks={destinations.racks}
          onClose={() => setDestinations(null)}
          onSuccess={() => { setDestinations(null); onSuccess(); }}
          zIndex="z-[100]"
        />,
        document.body
      )}
    </div>
  );
}
