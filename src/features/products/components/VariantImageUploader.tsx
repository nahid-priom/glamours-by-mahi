import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Replace, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppImage } from '@/components/common/AppImage'
import { cn } from '@/lib/utils'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import {
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_MAX_BYTES,
  clearVariantImage,
  resolveStorageUrl,
  uploadProductImage,
  validateProductImageFile,
} from '../repositories/catalog.repository'

type Props = {
  orgId?: string
  productId?: string | null
  variantId?: string | null
  /** Existing storage path or resolved URL */
  currentPathOrUrl?: string | null
  /** Pending local file (create flow before product exists) */
  pendingFile?: File | null
  onPendingFileChange?: (file: File | null) => void
  onUploaded?: (url: string | null) => void
  onCleared?: () => void
  className?: string
  disabled?: boolean
  /** Compact row for variant tables */
  compact?: boolean
  label?: string
}

export function VariantImageUploader({
  orgId,
  productId,
  variantId,
  currentPathOrUrl,
  pendingFile,
  onPendingFileChange,
  onUploaded,
  onCleared,
  className,
  disabled,
  compact = false,
  label = 'Variant image',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const canUploadRemote = Boolean(orgId && productId && variantId)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function hydrate() {
      if (pendingFile) {
        objectUrl = URL.createObjectURL(pendingFile)
        if (!cancelled) setPreview(objectUrl)
        return
      }
      if (!currentPathOrUrl) {
        if (!cancelled) setPreview(null)
        return
      }
      if (
        currentPathOrUrl.startsWith('http') ||
        currentPathOrUrl.startsWith('blob:') ||
        currentPathOrUrl.startsWith('/')
      ) {
        if (!cancelled) setPreview(currentPathOrUrl)
        return
      }
      const url = await resolveStorageUrl(currentPathOrUrl)
      if (!cancelled) setPreview(url)
    }

    void hydrate()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [currentPathOrUrl, pendingFile])

  async function onFile(file: File | null) {
    if (!file || disabled) return
    setError(null)

    const validationError = validateProductImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    if (!canUploadRemote) {
      onPendingFileChange?.(file)
      return
    }

    setBusy(true)
    setProgress(15)
    const local = URL.createObjectURL(file)
    setPreview(local)
    const tick = window.setInterval(() => {
      setProgress((p) => (p >= 85 ? p : p + 10))
    }, 120)

    try {
      const row = await uploadProductImage(orgId!, productId!, file, {
        variantId: variantId!,
        isCover: false,
      })
      setProgress(100)
      setPreview(row.url)
      invalidateStorefrontCache()
      onUploaded?.(row.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setPreview(currentPathOrUrl ?? null)
    } finally {
      window.clearInterval(tick)
      setBusy(false)
      setProgress(0)
      URL.revokeObjectURL(local)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onClear() {
    if (disabled || busy) return
    setError(null)

    if (!canUploadRemote) {
      onPendingFileChange?.(null)
      setPreview(null)
      onCleared?.()
      return
    }

    setBusy(true)
    try {
      await clearVariantImage(variantId!)
      setPreview(null)
      invalidateStorefrontCache()
      onUploaded?.(null)
      onCleared?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const sizeClass = compact ? 'h-11 w-11' : 'h-20 w-20'

  if (compact) {
    return (
      <div className={cn('relative', className)}>
        <button
          type="button"
          disabled={disabled || busy}
          title={preview ? 'Replace image' : 'Upload image'}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-slate-50 transition hover:border-[#E11D48]/50',
            sizeClass,
          )}
        >
          {preview ? (
            <AppImage src={preview} alt={label} className="h-full w-full" aspectRatio="square" />
          ) : (
            <ImagePlus className="h-4 w-4 text-[#9CA3AF]" />
          )}
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E11D48]" />
            </div>
          ) : null}
        </button>
        {preview && !busy ? (
          <button
            type="button"
            disabled={disabled}
            title="Delete image"
            onClick={() => void onClear()}
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#E11D48] shadow ring-1 ring-border"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        ) : null}
        {error ? <p className="mt-0.5 text-[9px] text-[#E11D48]">{error}</p> : null}
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

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-[#6B7280]">{label}</p>
      <div className="flex flex-col items-start gap-2">
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-slate-50',
            sizeClass,
          )}
        >
          {preview ? (
            <AppImage src={preview} alt={label} className="h-full w-full" aspectRatio="square" />
          ) : (
            <ImagePlus className="h-6 w-6 text-[#9CA3AF]" />
          )}
          {busy ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75">
              <Loader2 className="h-4 w-4 animate-spin text-[#E11D48]" />
              {progress > 0 ? (
                <span className="mt-0.5 text-[9px] font-medium text-[#E11D48]">{progress}%</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? (
              <>
                <Replace className="mr-1 h-3.5 w-3.5" />
                Replace
              </>
            ) : (
              <>
                <ImagePlus className="mr-1 h-3.5 w-3.5" />
                Upload
              </>
            )}
          </Button>
          {preview ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-[#E11D48]"
              disabled={disabled || busy}
              onClick={() => void onClear()}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      {busy && progress > 0 ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FCE7F3]">
          <div
            className="h-full rounded-full bg-[#E11D48] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {error ? <p className="text-xs text-[#E11D48]">{error}</p> : null}
      {!canUploadRemote ? (
        <p className="text-[10px] text-[#6B7280]">
          Saved with the product (max {Math.round(PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024))} MB).
        </p>
      ) : null}
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
