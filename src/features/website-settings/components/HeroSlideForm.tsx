import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { heroSlideFormSchema, type HeroSlideFormValues } from '../schemas/hero.schema'
import { HeroLinkBuilder } from './HeroLinkBuilder'
import { HeroImageUploader } from './HeroImageUploader'
import type { HeroSlideRow } from '../types/hero.types'

const DEFAULTS: HeroSlideFormValues = {
  internal_name: '',
  eyebrow: '',
  heading: '',
  highlight_text: '',
  description: '',
  offer_title: '',
  offer_subtitle: '',
  discount_text: '',
  coupon_code: '',
  primary_cta_label: 'Shop Now',
  primary_cta_type: 'all_products',
  primary_cta_config: {},
  primary_cta_new_tab: false,
  secondary_cta_enabled: true,
  secondary_cta_label: 'Explore New Arrivals',
  secondary_cta_type: 'new_arrivals',
  secondary_cta_config: {},
  secondary_cta_new_tab: false,
  desktop_image_path: '',
  mobile_image_path: '',
  image_alt: '',
  image_focal_x: 50,
  image_focal_y: 50,
  image_object_position: 'center',
  overlay_opacity: 0,
  layout_direction: 'content_left',
  text_alignment: 'left',
  theme_variant: 'soft_pink',
  show_trust_points: true,
  show_floating_badges: true,
  show_trending_products: false,
  trust_points: ['Authentic products', 'Cash on delivery', 'Nationwide shipping'],
  floating_badges: [],
  status: 'draft',
  sort_order: 0,
  starts_at: '',
  ends_at: '',
}

function rowToForm(slide: HeroSlideRow): HeroSlideFormValues {
  return {
    ...DEFAULTS,
    internal_name: slide.internal_name,
    eyebrow: slide.eyebrow ?? '',
    heading: slide.heading,
    highlight_text: slide.highlight_text ?? '',
    description: slide.description ?? '',
    offer_title: slide.offer_title ?? '',
    offer_subtitle: slide.offer_subtitle ?? '',
    discount_text: slide.discount_text ?? '',
    coupon_code: slide.coupon_code ?? '',
    primary_cta_label: slide.primary_cta_label,
    primary_cta_type: slide.primary_cta_type,
    primary_cta_config: slide.primary_cta_config ?? {},
    primary_cta_new_tab: slide.primary_cta_new_tab,
    secondary_cta_enabled: slide.secondary_cta_enabled,
    secondary_cta_label: slide.secondary_cta_label ?? '',
    secondary_cta_type: slide.secondary_cta_type,
    secondary_cta_config: slide.secondary_cta_config ?? {},
    secondary_cta_new_tab: slide.secondary_cta_new_tab,
    desktop_image_path: slide.desktop_image_path,
    mobile_image_path: slide.mobile_image_path,
    image_alt: slide.image_alt ?? '',
    image_focal_x: slide.image_focal_x,
    image_focal_y: slide.image_focal_y,
    image_object_position: slide.image_object_position as HeroSlideFormValues['image_object_position'],
    overlay_opacity: slide.overlay_opacity,
    layout_direction: slide.layout_direction,
    text_alignment: slide.text_alignment,
    theme_variant: slide.theme_variant,
    show_trust_points: slide.show_trust_points,
    show_floating_badges: slide.show_floating_badges,
    show_trending_products: slide.show_trending_products,
    trust_points: slide.trust_points.length ? slide.trust_points : DEFAULTS.trust_points,
    floating_badges: slide.floating_badges,
    status: slide.status,
    sort_order: slide.sort_order,
    starts_at: slide.starts_at ?? '',
    ends_at: slide.ends_at ?? '',
  }
}

interface HeroSlideFormProps {
  slide?: HeroSlideRow | null
  slideId?: string
  onSubmit: (values: HeroSlideFormValues) => Promise<void> | void
  submitting?: boolean
}

export function HeroSlideForm({ slide, slideId, onSubmit, submitting }: HeroSlideFormProps) {
  const form = useForm<HeroSlideFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(heroSlideFormSchema) as any,
    defaultValues: slide ? rowToForm(slide) : DEFAULTS,
  })

  useEffect(() => {
    if (slide) form.reset(rowToForm(slide))
  }, [slide, form])

  const values = form.watch()

  return (
    <FormProvider {...form}>
      <form
        className="space-y-8"
        onSubmit={form.handleSubmit(async (data) => {
          await onSubmit(data)
        })}
      >
        <section className="space-y-4 rounded-2xl border border-[var(--sf-border)] bg-white p-5">
          <h2 className="font-serif text-xl text-[var(--sf-ink)]">Content</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Internal name</Label>
              <Input className="mt-1" {...form.register('internal_name')} />
              {form.formState.errors.internal_name && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.internal_name.message}</p>
              )}
            </div>
            <div>
              <Label>Eyebrow</Label>
              <Input className="mt-1" {...form.register('eyebrow')} />
            </div>
            <div>
              <Label>Highlight text</Label>
              <Input className="mt-1" {...form.register('highlight_text')} />
            </div>
            <div className="sm:col-span-2">
              <Label>Heading</Label>
              <Input className="mt-1" {...form.register('heading')} />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <textarea
                className="mt-1 min-h-[88px] w-full rounded-xl border border-[var(--sf-border)] px-3 py-2 text-sm"
                {...form.register('description')}
              />
            </div>
            <div>
              <Label>Offer title</Label>
              <Input className="mt-1" {...form.register('offer_title')} />
            </div>
            <div>
              <Label>Offer subtitle</Label>
              <Input className="mt-1" {...form.register('offer_subtitle')} />
            </div>
            <div>
              <Label>Discount text</Label>
              <Input className="mt-1" {...form.register('discount_text')} placeholder="Up to 30% Off" />
            </div>
            <div>
              <Label>Coupon code</Label>
              <Input className="mt-1" {...form.register('coupon_code')} />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--sf-border)] bg-white p-5">
          <h2 className="font-serif text-xl text-[var(--sf-ink)]">Buttons</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold">Primary CTA</p>
              <HeroLinkBuilder prefix="primary" />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" {...form.register('secondary_cta_enabled')} />
                Secondary CTA
              </label>
              {values.secondary_cta_enabled ? <HeroLinkBuilder prefix="secondary" /> : null}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--sf-border)] bg-white p-5">
          <h2 className="font-serif text-xl text-[var(--sf-ink)]">Images</h2>
          <p className="text-xs text-[var(--sf-muted)]">
            Desktop recommended 1600×1000 (16:10). Mobile recommended 900×1200 (3:4). JPEG/PNG/WebP/AVIF, max 5MB.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <HeroImageUploader
              label="Desktop cover"
              hint="16:10"
              kind="desktop"
              slideId={slideId}
              path={values.desktop_image_path}
              onUploaded={(path) => form.setValue('desktop_image_path', path, { shouldDirty: true })}
              onCleared={() => form.setValue('desktop_image_path', '', { shouldDirty: true })}
            />
            <HeroImageUploader
              label="Mobile cover"
              hint="3:4"
              kind="mobile"
              slideId={slideId}
              path={values.mobile_image_path}
              onUploaded={(path) => form.setValue('mobile_image_path', path, { shouldDirty: true })}
              onCleared={() => form.setValue('mobile_image_path', '', { shouldDirty: true })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Alt text</Label>
              <Input className="mt-1" {...form.register('image_alt')} />
            </div>
            <div>
              <Label>Object position</Label>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--sf-border)] px-3 py-2 text-sm"
                {...form.register('image_object_position')}
              >
                <option value="center">Center</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="custom">Custom focal</option>
              </select>
            </div>
            {values.image_object_position === 'custom' ? (
              <>
                <div>
                  <Label>Focal X (%)</Label>
                  <Input type="number" className="mt-1" {...form.register('image_focal_x')} />
                </div>
                <div>
                  <Label>Focal Y (%)</Label>
                  <Input type="number" className="mt-1" {...form.register('image_focal_y')} />
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--sf-border)] bg-white p-5">
          <h2 className="font-serif text-xl text-[var(--sf-ink)]">Layout & publishing</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Layout</Label>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--sf-border)] px-3 py-2 text-sm"
                {...form.register('layout_direction')}
              >
                <option value="content_left">Content left / Image right</option>
                <option value="content_right">Image left / Content right</option>
              </select>
            </div>
            <div>
              <Label>Theme</Label>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--sf-border)] px-3 py-2 text-sm"
                {...form.register('theme_variant')}
              >
                <option value="soft_pink">Soft pink</option>
                <option value="deep_pink">Deep pink</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--sf-border)] px-3 py-2 text-sm"
                {...form.register('status')}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" className="mt-1" {...form.register('sort_order')} />
            </div>
            <div>
              <Label>Starts at</Label>
              <Input type="datetime-local" className="mt-1" {...form.register('starts_at')} />
            </div>
            <div>
              <Label>Ends at</Label>
              <Input type="datetime-local" className="mt-1" {...form.register('ends_at')} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...form.register('show_trust_points')} /> Trust points
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...form.register('show_floating_badges')} /> Floating badges
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...form.register('show_trending_products')} /> Trending products
            </label>
          </div>

          <div>
            <Label>Trust points (max 3, one per line)</Label>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-xl border border-[var(--sf-border)] px-3 py-2 text-sm"
              value={(values.trust_points ?? []).join('\n')}
              onChange={(e) =>
                form.setValue(
                  'trust_points',
                  e.target.value
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .slice(0, 3),
                  { shouldDirty: true },
                )
              }
            />
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={submitting} className="rounded-full px-6">
            {submitting ? 'Saving…' : 'Save slide'}
          </Button>
          {form.formState.isDirty ? (
            <p className="self-center text-xs text-amber-600">Unsaved changes</p>
          ) : null}
        </div>
      </form>
    </FormProvider>
  )
}
