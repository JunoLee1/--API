import { useTranslation } from 'react-i18next'
import DaumPostcode from 'react-daum-postcode'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DaumPostcodeDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: (postalCode: string, address: string) => void
}

export function DaumPostcodeDialog({ open, onOpenChange, onComplete }: DaumPostcodeDialogProps) {
  const { t } = useTranslation('sponsorship')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('form.addressSearch')}</DialogTitle>
        </DialogHeader>
        <div className="overflow-hidden">
          <DaumPostcode
            autoClose={false}
            onComplete={(data) => {
              onComplete(data.zonecode, data.roadAddress)
              onOpenChange(false)
            }}
            style={{ height: 400 }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
