import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { academyFeeApi } from '@/services/academyFee.service'

export default function TossCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = Number(searchParams.get('amount'))

    if (!paymentKey || !orderId || isNaN(amount)) {
      setStatus('error')
      setErrorMessage('잘못된 결제 정보입니다.')
      return
    }

    // orderId format: fee-{feeId}-{timestamp}
    const parts = orderId.split('-')
    const feeId = Number(parts[1])
    if (isNaN(feeId)) {
      setStatus('error')
      setErrorMessage('결제 정보를 확인할 수 없습니다.')
      return
    }

    academyFeeApi.tossConfirm(feeId, paymentKey, orderId, amount)
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/youth/guardian', { replace: true }), 2000)
      })
      .catch((e: unknown) => {
        const err = e as { message?: string }
        setStatus('error')
        setErrorMessage(err?.message ?? '결제 확인 중 오류가 발생했습니다.')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground">결제를 확인하고 있습니다...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive font-semibold">결제 실패</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <button
          className="text-primary underline text-sm"
          onClick={() => navigate('/youth/guardian', { replace: true })}
        >
          돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="text-4xl">✓</div>
      <p className="font-semibold">결제가 완료됐습니다!</p>
      <p className="text-sm text-muted-foreground">잠시 후 이동합니다...</p>
    </div>
  )
}
