import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { StorefrontProduct } from '../storefront.types'
import { getDisplayDescription, getDisplayName } from '../utils/product-display'

interface ProductDetailsAccordionProps {
  product: StorefrontProduct
}

export function ProductDetailsAccordion({ product }: ProductDetailsAccordionProps) {
  const name = getDisplayName(product)
  const description = getDisplayDescription(product)

  return (
    <Accordion type="single" defaultValue={['details']}>
      <AccordionItem value="details">
        <AccordionTrigger value="details">Product Details</AccordionTrigger>
        <AccordionContent value="details">
          <p>{description}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>SKU: {product.sku}</li>
            <li>Style: {product.style}</li>
            <li>Premium fabrics with refined tailoring</li>
          </ul>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="size-guide">
        <AccordionTrigger value="size-guide">Size Guide</AccordionTrigger>
        <AccordionContent value="size-guide">
          <p>
            {name} follows standard boutique sizing. For a relaxed fit, choose one size up. Refer to bust,
            waist, and hip measurements before ordering.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="shipping">
        <AccordionTrigger value="shipping">Shipping &amp; Delivery</AccordionTrigger>
        <AccordionContent value="shipping">
          <p>
            Orders ship within 24 hours on business days. Nationwide delivery typically arrives in 2–5
            business days. Cash on delivery is available across Bangladesh.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="returns">
        <AccordionTrigger value="returns">Return Policy</AccordionTrigger>
        <AccordionContent value="returns">
          <p>
            Unused items with original tags may be exchanged within 3 days of delivery. Contact support with
            your order number to initiate a return or exchange.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="care">
        <AccordionTrigger value="care">Care Instructions</AccordionTrigger>
        <AccordionContent value="care">
          <p>
            Dry clean or hand wash in cold water. Do not bleach. Iron on low heat. Store folded or on a padded
            hanger to preserve shape and fabric quality.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
