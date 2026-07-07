import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'

interface QRCodeBoxProps {
  value: string
  size?: number
  className?: string
  label?: string
}

export function QRCodeBox({ value, size = 72, className, label = 'Scan to track order' }: QRCodeBoxProps) {
  if (!value) return null

  return (
    <div className={cn('flex flex-col items-center gap-1 print-safe', className)}>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
        includeMargin={false}
      />
      {label && (
        <p className="text-center text-[9px] font-medium leading-tight text-black">{label}</p>
      )}
    </div>
  )
}
