import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { STOREFRONT_CATEGORIES } from '@/lib/constants'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HERO_CTA_TYPE_LABELS, HERO_CTA_TYPES, type HeroCtaType } from '../types/hero.types'
import { buildHeroCtaUrl } from '../services/hero-link-builder.service'
import type { HeroSlideFormValues } from '../schemas/hero.schema'

interface HeroLinkBuilderProps {
  prefix: 'primary' | 'secondary'
}

export function HeroLinkBuilder({ prefix }: HeroLinkBuilderProps) {
  const { control, setValue } = useFormContext<HeroSlideFormValues>()
  const typeKey = prefix === 'primary' ? 'primary_cta_type' : 'secondary_cta_type'
  const configKey = prefix === 'primary' ? 'primary_cta_config' : 'secondary_cta_config'

  const ctaType = useWatch({ control, name: typeKey }) as HeroCtaType | null | undefined
  const config = useWatch({ control, name: configKey }) ?? {}
  const previewUrl =
    ctaType != null ? buildHeroCtaUrl(ctaType, config) : '/shop'

  return (
    <div className="space-y-3 rounded-xl border border-[var(--sf-border)] bg-white p-4">
      <div>
        <Label>Link type</Label>
        <Controller
          control={control}
          name={typeKey}
          render={({ field }) => (
            <select
              className="mt-1 w-full rounded-lg border border-[var(--sf-border)] bg-white px-3 py-2 text-sm"
              value={field.value ?? 'all_products'}
              onChange={(e) => field.onChange(e.target.value as HeroCtaType)}
            >
              {HERO_CTA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {HERO_CTA_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {(ctaType === 'category' || ctaType === 'custom_filter' || ctaType === 'subcategory') && (
        <div>
          <Label>Category</Label>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--sf-border)] bg-white px-3 py-2 text-sm"
            value={config.category ?? ''}
            onChange={(e) =>
              setValue(configKey, { ...config, category: e.target.value }, { shouldDirty: true })
            }
          >
            <option value="">Select category</option>
            {STOREFRONT_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {(ctaType === 'brand' || ctaType === 'custom_filter') && (
        <div>
          <Label>Brand slug / name</Label>
          <Input
            className="mt-1"
            value={config.brand ?? ''}
            onChange={(e) =>
              setValue(configKey, { ...config, brand: e.target.value }, { shouldDirty: true })
            }
            placeholder="maybelline"
          />
        </div>
      )}

      {ctaType === 'product' && (
        <div>
          <Label>Product slug</Label>
          <Input
            className="mt-1"
            value={config.productSlug ?? ''}
            onChange={(e) =>
              setValue(configKey, { ...config, productSlug: e.target.value }, { shouldDirty: true })
            }
            placeholder="floral-maxi-dress"
          />
        </div>
      )}

      {ctaType === 'custom_url' && (
        <div>
          <Label>Custom URL</Label>
          <Input
            className="mt-1"
            value={config.customUrl ?? ''}
            onChange={(e) =>
              setValue(configKey, { ...config, customUrl: e.target.value }, { shouldDirty: true })
            }
            placeholder="/shop or https://..."
          />
        </div>
      )}

      {ctaType === 'custom_filter' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Min price</Label>
            <Input
              type="number"
              className="mt-1"
              value={config.minPrice ?? ''}
              onChange={(e) =>
                setValue(
                  configKey,
                  { ...config, minPrice: e.target.value ? Number(e.target.value) : undefined },
                  { shouldDirty: true },
                )
              }
            />
          </div>
          <div>
            <Label>Max price</Label>
            <Input
              type="number"
              className="mt-1"
              value={config.maxPrice ?? ''}
              onChange={(e) =>
                setValue(
                  configKey,
                  { ...config, maxPrice: e.target.value ? Number(e.target.value) : undefined },
                  { shouldDirty: true },
                )
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(config.onSale)}
              onChange={(e) =>
                setValue(configKey, { ...config, onSale: e.target.checked }, { shouldDirty: true })
              }
            />
            On sale only
          </label>
        </div>
      )}

      <p className="rounded-lg bg-[var(--sf-primary-soft)] px-3 py-2 text-xs text-[var(--sf-primary-hover)]">
        Destination:{' '}
        <span className="font-semibold">{previewUrl || 'No link (non-clickable slide)'}</span>
      </p>
    </div>
  )
}
