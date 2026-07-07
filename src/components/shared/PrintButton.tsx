import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PrintButtonProps {
  onClick?: () => void
  label?: string
  size?: 'default' | 'sm'
}

export function PrintButton({ onClick, label = 'Print', size = 'sm' }: PrintButtonProps) {
  return (
    <Button variant="purple" size={size} onClick={onClick}>
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
