import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  label: string
  value: number | string
  unit?: string
  highlight?: boolean
}

export function StatCard({ label, value, unit, highlight }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${highlight ? 'text-destructive' : ''}`}>
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  )
}
