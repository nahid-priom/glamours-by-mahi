import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { normalizeBdPhone } from '@/lib/phone-utils'
import {
  quickCustomerSchema,
  type QuickCustomerForm,
  type QuickCustomerValues,
} from '../schemas/quick-customer.schema'
import {
  quickCreateCustomer,
  type QuickCreateCustomerResult,
} from '../repositories/pos.repository'

export type PosQuickAddCustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  branchId?: string | null
  createdBy?: string | null
  initialMobile?: string
  onResolved: (result: QuickCreateCustomerResult) => void
}

export function PosQuickAddCustomerDialog({
  open,
  onOpenChange,
  organizationId,
  branchId,
  createdBy,
  initialMobile = '',
  onResolved,
}: PosQuickAddCustomerDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<QuickCustomerForm, undefined, QuickCustomerValues>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: { mobile: initialMobile, name: '' },
  })

  useEffect(() => {
    if (open) {
      reset({ mobile: initialMobile, name: '' })
      setServerError(null)
    }
  }, [open, initialMobile, reset])

  const mobileValue = watch('mobile')
  const normalizedPreview = normalizeBdPhone(mobileValue ?? '')

  const onSubmit = async (values: QuickCustomerValues) => {
    setServerError(null)
    try {
      const result = await quickCreateCustomer({
        mobile: values.mobile,
        name: values.name,
        organizationId,
        branchId,
        createdBy,
      })
      onResolved(result)
      onOpenChange(false)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Could not create customer')
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col gap-4 border border-border bg-white shadow-xl',
            'inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6',
            'sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                Add Customer
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-text-muted">
                Only the mobile number is required. Add more details later from the
                Customers module.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="rounded-lg p-1 text-text-muted opacity-70 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                className="text-xs font-semibold text-text-muted"
                htmlFor="pos-quick-mobile"
              >
                Mobile Number <span className="text-danger">*</span>
              </label>
              <Input
                id="pos-quick-mobile"
                autoFocus
                inputMode="tel"
                autoComplete="off"
                placeholder="01XXXXXXXXX"
                aria-invalid={Boolean(errors.mobile)}
                className="mt-1"
                {...register('mobile')}
              />
              {errors.mobile ? (
                <p className="mt-1 text-xs text-danger">{errors.mobile.message}</p>
              ) : normalizedPreview && normalizedPreview !== mobileValue ? (
                <p className="mt-1 text-[11px] text-text-muted">
                  Will save as {normalizedPreview}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="text-xs font-semibold text-text-muted"
                htmlFor="pos-quick-name"
              >
                Customer Name <span className="font-normal">(optional)</span>
              </label>
              <Input
                id="pos-quick-name"
                autoComplete="off"
                placeholder="Optional"
                aria-invalid={Boolean(errors.name)}
                className="mt-1"
                {...register('name')}
              />
              {errors.name ? (
                <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
              ) : null}
            </div>

            {serverError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {serverError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create &amp; Select
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
