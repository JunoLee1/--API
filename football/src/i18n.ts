import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import koCommon from './locales/ko/common.json';
import koMatch from './locales/ko/match.json';
import koPlayer from './locales/ko/player.json';
import koTraining from './locales/ko/training.json';
import koSquad from './locales/ko/squad.json';
import koMedical from './locales/ko/medical.json';
import koContract from './locales/ko/contract.json';
import koYouth from './locales/ko/youth.json';
import koReport from './locales/ko/report.json';
import koAdmin from './locales/ko/admin.json';
import koFacility from './locales/ko/facility.json';
import koSponsorship from './locales/ko/sponsorship.json';
import koFinance from './locales/ko/finance.json';

import enCommon from './locales/en/common.json';
import enMatch from './locales/en/match.json';
import enPlayer from './locales/en/player.json';
import enTraining from './locales/en/training.json';
import enSquad from './locales/en/squad.json';
import enMedical from './locales/en/medical.json';
import enContract from './locales/en/contract.json';
import enYouth from './locales/en/youth.json';
import enReport from './locales/en/report.json';
import enAdmin from './locales/en/admin.json';
import enFacility from './locales/en/facility.json';
import enSponsorship from './locales/en/sponsorship.json';
import enFinance from './locales/en/finance.json';

const storedLang = localStorage.getItem('app_lang')
const initLang: 'ko' | 'en' = storedLang === 'en' ? 'en' : 'ko'

i18n.use(initReactI18next).init({
  resources: {
    ko: {
      common: koCommon,
      match: koMatch,
      player: koPlayer,
      training: koTraining,
      squad: koSquad,
      medical: koMedical,
      contract: koContract,
      youth: koYouth,
      report: koReport,
      admin: koAdmin,
      facility: koFacility,
      sponsorship: koSponsorship,
      finance: koFinance,
    },
    en: {
      common: enCommon,
      match: enMatch,
      player: enPlayer,
      training: enTraining,
      squad: enSquad,
      medical: enMedical,
      contract: enContract,
      youth: enYouth,
      report: enReport,
      admin: enAdmin,
      facility: enFacility,
      sponsorship: enSponsorship,
      finance: enFinance,
    },
  },
  lng: initLang,
  fallbackLng: 'ko',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
