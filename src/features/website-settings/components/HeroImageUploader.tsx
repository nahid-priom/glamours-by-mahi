import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { heroService } from '../services/hero.service'
import { cn } from '@/lib/utils'

interface HeroImageUploaderProps {
  label: string
  hint: string
  path: string | null | undefined
  slideId?: string
  kind: 'desktop' | 'tablet' | 'mobile'
  onUploaded: (path: string) => void
  onCleared?: () => void
}

export function HeroImageUploader({
  label,
  hint,
  path,
  slideId,
  kind,
  onUploaded,
  onCleared,
}: HeroImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = path ? heroService.mediaUrl(path) : null

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)

    if (!slideId) {
      setError('Save the slide as draft first, then upload images.')
      return
    }

    setUploading(true)
    try {
      const nextPath = await heroService.uploadImage(slideId, file, kind)
      if (path) {
        try {
          await heroService.removeImage(path)
        } catch {
          /* best-effort cleanup */
        }
      }
      onUploaded(nextPath)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--sf-ink)]">{label}</p>
        <p className="text-[11px] text-[var(--sf-muted)]">{hint}</p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-primary-soft)]/40 transition hover:border-[var(--sf-primary)]',
          kind === 'desktop' && 'aspect-[16/7]',
          kind === 'tablet' && 'aspect-video max-w-[320px]',
          kind === 'mobile' && 'aspect-[4/5] max-w-[220px]',
        )}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-sm text-[var(--sf-muted)]">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? 'Uploading…' : 'Upload image'}
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {preview && onCleared ? (
        <button
          type="button"
          className="text-xs font-medium text-[var(--sf-muted)] hover:text-[var(--sf-primary)]"
          onClick={onCleared}
        >
          Remove image
        </button>
      ) : null}

      {error ? <p className="text-xs text-[var(--sf-danger,#D92D20)]">{error}</p> : null}
    </div>
  )
}
