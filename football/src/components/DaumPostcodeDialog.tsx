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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>주소 검색</DialogTitle>
        </DialogHeader>
        <DaumPostcode
          autoClose={false}
          onComplete={(data) => {
            onComplete(data.zonecode, data.roadAddress)
            onOpenChange(false)
          }}
          style={{ height: 400 }}
        />
      </DialogContent>
    </Dialog>
  )
}
