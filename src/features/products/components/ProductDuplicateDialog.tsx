import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { duplicateProduct, type ProductListItem } from '../repositories/catalog.repository'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductListItem | null
  onDuplicated: (productId: string) => void
  onError?: (message: string) => void
}

export function ProductDuplicateDialog({
  open,
  onOpenChange,
  product,
  onDuplicated,
  onError,
}: Props) {
  const [name, setName] = useState('')
  const [copyImages, setCopyImages] = useState(true)
  const [generateSkus, setGenerateSkus] = useState(true)
  const [generateBarcodes, setGenerateBarcodes] = useState(true)
  const [copyBranchPrices, setCopyBranchPrices] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error('No product selected')
      const result = await duplicateProduct({
        product_id: product.id,
        name: name.trim() || `${product.name} - Copy`,
        copy_images: copyImages,
        generate_skus: generateSkus,
        generate_barcodes: generateBarcodes,
        copy_branch_prices: copyBranchPrices,
      })
      return String(result.product_id)
    },
    onSuccess: (productId) => {
      onDuplicated(productId)
      onOpenChange(false)
    },
    onError: (e: Error) => onError?.(e.message),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o && product) setName(`${product.name} - Copy`)
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate product</DialogTitle>
        </DialogHeader>
        {product ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="dup-name">New product name</Label>
              <Input
                id="dup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${product.name} - Copy`}
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-slate-50/80 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={copyImages} onCheckedChange={(c) => setCopyImages(c === true)} />
                Copy images
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={generateSkus} onCheckedChange={(c) => setGenerateSkus(c === true)} />
                Generate new SKUs
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={generateBarcodes}
                  onCheckedChange={(c) => setGenerateBarcodes(c === true)}
                />
                Generate new barcodes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={copyBranchPrices}
                  onCheckedChange={(c) => setCopyBranchPrices(c === true)}
                />
                Copy branch prices
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Duplicate'}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
