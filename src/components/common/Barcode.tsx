import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { cn } from '@/lib/utils'

interface BarcodeProps {
  value: string
  height?: number
  showText?: boolean
  className?: string
}

export function Barcode({ value, height = 48, showText = true, className }: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 1.4,
        height,
        displayValue: showText,
        fontSize: 11,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      // Invalid barcode value — leave empty
    }
  }, [value, height, showText])

  if (!value) return null

  return (
    <div className={cn('w-full print-safe', className)}>
      <svg ref={svgRef} className="h-auto w-full max-w-full" role="img" aria-label={`Barcode ${value}`} />
    </div>
  )
}
