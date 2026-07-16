import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'

export type BarcodePrintItem = {
  name: string
  sku: string
  barcode: string
  price: number
  variant?: string
  batch?: string
  expiry?: string
}

type LabelSize = '38x25' | '50x25' | '50x30'

const LABEL_SIZES: Record<LabelSize, { width: string; height: string; page: string }> = {
  '38x25': { width: '38mm', height: '25mm', page: 'barcode-38x25' },
  '50x25': { width: '50mm', height: '25mm', page: 'barcode-50x25' },
  '50x30': { width: '50mm', height: '30mm', page: 'barcode-50x30' },
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: BarcodePrintItem[]
}

function BarcodeSvg({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 1.2,
        height: 36,
        displayValue: true,
        fontSize: 10,
        margin: 2,
      })
    } catch {
      /* invalid barcode value */
    }
  }, [value])

  return <svg ref={svgRef} className="max-w-full" />
}

export function BarcodePrintDialog({ open, onOpenChange, items }: Props) {
  const [labelSize, setLabelSize] = useState<LabelSize>('50x25')
  const size = LABEL_SIZES[labelSize]

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <style>{`
        @page barcode-38x25 { size: 38mm 25mm; margin: 1mm; }
        @page barcode-50x25 { size: 50mm 25mm; margin: 1mm; }
        @page barcode-50x30 { size: 50mm 30mm; margin: 1mm; }

        .barcode-print-root { background: #f8fafc; }
        .barcode-label {
          box-sizing: border-box;
          background: white;
          border: 1px dashed #e5e7eb;
          padding: 2mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .barcode-label-name {
          font-size: 8px;
          font-weight: 700;
          line-height: 1.2;
          max-height: 2.4em;
          overflow: hidden;
        }
        .barcode-label-meta {
          font-size: 7px;
          color: #64748b;
          margin-top: 1mm;
        }
        .barcode-label-price {
          font-size: 9px;
          font-weight: 800;
          margin-top: 1mm;
        }

        @media print {
          body * { visibility: hidden !important; }
          .barcode-print-root,
          .barcode-print-root * { visibility: visible !important; }
          .barcode-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }
          .no-print { display: none !important; }
          aside, nav, header, [data-sidebar] { display: none !important; }
          .barcode-label {
            border: none;
            box-shadow: none;
            page: ${size.page};
            width: ${size.width};
            height: ${size.height};
            margin: 0 auto;
            break-after: page;
          }
        }
      `}</style>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Print barcodes</DialogTitle>
          </DialogHeader>

          <div className="no-print space-y-4">
            <div className="space-y-1.5">
              <Label>Label size</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LABEL_SIZES) as LabelSize[]).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={labelSize === key ? 'default' : 'outline'}
                    onClick={() => setLabelSize(key)}
                  >
                    {key.replace('x', '×')} mm
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4" />
                Print {items.length} label{items.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>

          <div className="barcode-print-root max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item, i) => (
                <div
                  key={`${item.sku}-${i}`}
                  className={cn('barcode-label rounded-lg')}
                  style={{ width: size.width, minHeight: size.height }}
                >
                  <p className="barcode-label-name">{item.name}</p>
                  {item.variant ? <p className="barcode-label-meta">{item.variant}</p> : null}
                  {item.barcode ? <BarcodeSvg value={item.barcode} /> : (
                    <p className="text-[10px] text-[#E11D48]">No barcode</p>
                  )}
                  <p className="barcode-label-meta">{item.sku}</p>
                  <p className="barcode-label-price">{formatBDT(item.price)}</p>
                  {item.batch ? <p className="barcode-label-meta">Batch: {item.batch}</p> : null}
                  {item.expiry ? <p className="barcode-label-meta">Exp: {item.expiry}</p> : null}
                </div>
              ))}
            </div>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#6B7280]">No items to print.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
