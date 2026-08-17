import ProductSearch from "@/app/components/ProductSearch";
import ProtectedPage from "@/app/components/ProtectedPage";

export default function SearchPage() {
  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
        <ProductSearch />
      </div>
    </ProtectedPage>
  );
}
