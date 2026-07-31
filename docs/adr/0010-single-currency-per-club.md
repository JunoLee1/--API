# ADR-0010: 클럽 단위 단일 통화 (Single Currency Per Club)

**Status:** Accepted  
**Date:** 2026-07-29

## Context

영국 하위 리그 셀링을 고려하면서 통화 지원 범위를 결정해야 했다.  
현실에서 외국인 선수 계약을 EUR 등 제3통화로 맺는 경우가 존재하지만,  
`Contract.salary`, `Transfer.fee`, `BuyoutClause.amount`, `PerformanceBonus`, `MealExpense.amount`, 임금 상한값 등 모든 금액 필드에 영향을 준다.

## Decision

통화는 **클럽 단위 단일 통화**로 관리한다.  
`ClubSettings.currency`(ISO 4217)를 ADMIN이 설정하고, 시스템 내 모든 금액은 그 통화 기준으로 저장한다.  
환율 변환 없음. 다중 통화 계약은 이 ERP 범위 밖으로 명시적으로 제외한다.

## Alternatives Considered

- **필드별 통화:** 각 금액 필드에 `currency` 컬럼 추가. 구현 복잡도가 크고 환율 변환 로직이 필요해 범위를 벗어남.

## Consequences

- 한국 구단은 KRW, 영국 구단은 GBP로 ClubSettings를 설정하여 동일 코드베이스로 지원 가능.
- 외국인 선수와 제3통화로 계약하는 경우, 클럽 통화 기준으로 환산 후 입력해야 한다.
