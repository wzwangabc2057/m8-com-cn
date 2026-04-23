import { ProductCard } from './product-card';
import { getVariantDisplayPrice, type UiProduct } from '@/lib/storefront-product';

interface ProductGridProps {
  products: UiProduct[];
}

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
      {products.map((product) => {
        const price = getVariantDisplayPrice(product.variants?.[0]);
        return (
          <ProductCard
            key={product.id}
            handle={product.handle}
            title={product.title}
            thumbnail={product.thumbnail}
            price={price}
          />
        );
      })}
    </div>
  );
}
