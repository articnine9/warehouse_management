import ProductSearch from "@/app/components/ProductSearch";
import ProtectedPage from "@/app/components/ProtectedPage";

export default function SearchPage() {
  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-3 md:p-4 lg:p-5">
        <ProductSearch />
      </div>
    </ProtectedPage>
  );
}
