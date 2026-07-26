import i18n from '@/i18n'
import { authApi } from '@/services/auth.service'
import { useState } from 'react'

export function useLanguage(initialLanguage: 'ko' | 'en') {
  const [language, setLanguage] = useState<'ko' | 'en'>(initialLanguage)

  const changeLanguage = async (lang: 'ko' | 'en') => {
    const prev = language
    setLanguage(lang)
    await i18n.changeLanguage(lang)
    try {
      await authApi.updateLanguage(lang)
    } catch {
      setLanguage(prev)
      await i18n.changeLanguage(prev)
    }
  }

  return { language, changeLanguage }
}
