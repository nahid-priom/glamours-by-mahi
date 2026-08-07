import { useEffect } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AppDateTimeField } from '@/components/date-picker'
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
  primary_cta_label: '',
  primary_cta_type: 'all_products',
  primary_cta_config: {},
  primary_cta_new_tab: false,
  secondary_cta_enabled: false,
  secondary_cta_label: '',
  secondary_cta_type: null,
  secondary_cta_config: {},
  secondary_cta_new_tab: false,
  desktop_image_path: '',
  tablet_image_path: '',
  mobile_image_path: '',
  image_alt: '',
  image_focal_x: null,
  image_focal_y: null,
  image_object_position: 'center',
  overlay_opacity: 0,
  layout_direction: 'content_left',
  text_alignment: 'left',
  theme_variant: 'soft_pink',
  show_trust_points: false,
  show_floating_badges: false,
  show_trending_products: false,
  trust_points: [],
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
    heading: slide.heading,
    primary_cta_label: slide.primary_cta_label,
    primary_cta_type: slide.primary_cta_type,
    primary_cta_config: slide.primary_cta_config ?? {},
    primary_cta_new_tab: slide.primary_cta_new_tab,
    desktop_image_path: slide.desktop_image_path,
    tablet_image_path: slide.tablet_image_path,
    mobile_image_path: slide.mobile_image_path,
    image_alt: slide.image_alt ?? '',
    image_focal_x: slide.image_focal_x,
    image_focal_y: slide.image_focal_y,
    image_object_position:
      slide.image_object_position as HeroSlideFormValues['image_object_position'],
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
          <h2 className="font-serif text-xl text-[var(--sf-ink)]">Slide details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Internal name</Label>
              <Input
                className="mt-1"
                {...form.register('internal_name')}
                placeholder="Eid campaign cover"
              />
              {form.formState.errors.internal_name && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.internal_name.message}
                </p>
              )}
            </div>
            <div>
              <Label>Alt text</Label>
              <Input
                className="mt-1"
                {...form.register('image_alt')}
                placeholder="Describe the cover for accessibility"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--sf-border)] bg-white p-5">
          <h2 className="font-serif text-xl text-[var(--sf-ink)]">Cover images</h2>
          <p className="text-xs text-[var(--sf-muted)]">
            The cover image is the entire slide — include any headline, offer and CTA inside the
            artwork. JPEG/PNG/WebP/AVIF, max 5MB.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <HeroImageUploader
                label="Desktop banner (required)"
                hint="16:7 · recommended 1920×840"
                kind="desktop"
                slideId={slideId}
                path={values.desktop_image_path}
                onUploaded={(path) =>
                  form.setValue('desktop_image_path', path, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onCleared={() =>
                  form.setValue('desktop_image_path', '', { shouldDirty: true })
                }
              />
              {form.formState.errors.desktop_image_path && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.desktop_image_path.message}
                </p>
              )}
            </div>
            <HeroImageUploader
              label="Tablet cover (optional)"
              hint="16:9 · recommended 1600×900"
              kind="tablet"
              slideId={slideId}
              path={values.tablet_image_path}
              onUploaded={(path) =>
                form.setValue('tablet_image_path', path, { shouldDirty: true })
              }
              onCleared={() => form.setValue('tablet_image_path', '', { shouldDirty: true })}
            />
            <HeroImageUploader
              label="Mobile cover (optional, recommended)"
              hint="4:5 · recommended 900×1125"
              kind="mobile"
              slideId={slideId}
              path={values.mobile_image_path}
              onUploaded={(path) =>
                form.setValue('mobile_image_path', path, { shouldDirty: true })
              }
              onCleared={() => form.setValue('mobile_image_path', '', { shouldDirty: true })}
            />
            <div className="space-y-4">
              <div>
                <Label>Focal position</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--sf-border)] px-3 py-2 text-sm"
                  {...form.register('image_object_position')}
                >
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="custom">Custom focal point</option>
                </select>
                <p className="mt-1 text-xs text-[var(--sf-muted)]">
                  Keeps the important part of the banner visible when edges are cropped.
                </p>
              </div>
              {values.image_object_position === 'custom' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Focal X (%)</Label>
                    <Input type="number" className="mt-1" {...form.register('image_focal_x')} />
                  </div>
                  <div>
                    <Label>Focal Y (%)</Label>
                    <Input type="number" className="mt-1" {...form.register('image_focal_y')} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--sf-border)] bg-white p-5">
          <h2 className="font-serif text-xl text-[var(--sf-ink)]">Slide link</h2>
          <p className="text-xs text-[var(--sf-muted)]">
            Where the slide navigates when tapped. Choose “No Link” for a non-clickable cover.
          </p>
          <HeroLinkBuilder prefix="primary" />
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--sf-border)] bg-white p-5">
          <h2 className="font-serif text-xl text-[var(--sf-ink)]">Publishing</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <Controller
                control={form.control}
                name="starts_at"
                render={({ field }) => (
                  <AppDateTimeField
                    className="mt-1"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div>
              <Label>Ends at</Label>
              <Controller
                control={form.control}
                name="ends_at"
                render={({ field }) => (
                  <AppDateTimeField
                    className="mt-1"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
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
