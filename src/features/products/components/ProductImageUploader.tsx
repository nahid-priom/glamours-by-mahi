import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppImage } from '@/components/common/AppImage'
import { cn } from '@/lib/utils'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import {
  PRODUCT_IMAGE_ACCEPT,
  clearProductCover,
  uploadProductImage,
  validateProductImageFile,
} from '../repositories/catalog.repository'

type Props = {
  orgId: string
  productId: string
  currentUrl?: string | null
  onUploaded?: (url: string | null) => void
  className?: string
  disabled?: boolean
}

export function ProductImageUploader({
  orgId,
  productId,
  currentUrl,
  onUploaded,
  className,
  disabled,
}: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPreview(currentUrl ?? null)
  }, [currentUrl])

  async function onFile(file: File | null) {
    if (!file || disabled) return
    setError(null)

    const validationError = validateProductImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    const local = URL.createObjectURL(file)
    setPreview(local)
    try {
      const row = await uploadProductImage(orgId, productId, file, { isCover: true })
      setPreview(row.url)
      invalidateStorefrontCache()
      await qc.invalidateQueries({ queryKey: ['products'] })
      onUploaded?.(row.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setPreview(currentUrl ?? null)
    } finally {
      setBusy(false)
      URL.revokeObjectURL(local)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-slate-50">
        {preview ? (
          <AppImage src={preview} alt="Product cover" className="h-full w-full" aspectRatio="square" />
        ) : (
          <ImagePlus className="h-8 w-8 text-[#9CA3AF]" />
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-[#E11D48]" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy || !productId}
          onClick={() => inputRef.current?.click()}
        >
          Upload cover
        </Button>
        {preview ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || busy || !productId}
            onClick={() => {
              void (async () => {
                setBusy(true)
                setError(null)
                try {
                  await clearProductCover(productId)
                  setPreview(null)
                  invalidateStorefrontCache()
                  await qc.invalidateQueries({ queryKey: ['products'] })
                  onUploaded?.(null)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Could not clear cover')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-[#E11D48]">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={PRODUCT_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
