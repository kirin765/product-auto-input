import type { MarketplaceAdapter, PrepareResult } from "./types";
import { commonFields } from "./common";
import { expandSections } from "../shared/dom";

/**
 * 스마트스토어는 상세설명·배송·A/S 등이 접힌 섹션으로 렌더링된다.
 * 값이 있는 섹션만 펼친 뒤 폼을 채운다. 저장/제출은 하지 않는다.
 */
export async function prepareSmartstore(root: Document): Promise<PrepareResult> {
  const actions = await expandSections(root, {
    selectors: ['.title-line[role="button"]'],
    include: /상품 주요정보|상세설명|검색설정|판매자\s*코드|상품정보제공고시|배송|A\/S/i
  });
  return { actions };
}

export const smartstore: MarketplaceAdapter = {
  id: "smartstore",
  name: "네이버 스마트스토어",
  shortName: "스마트스토어",
  sellerCenter: "https://sell.smartstore.naver.com/",
  createUrl: "https://sell.smartstore.naver.com/",
  hosts: ["sell.smartstore.naver.com"],
  urlPatterns: [/.*/],
  verified: false,
  prepare: prepareSmartstore,
  fields: commonFields({
    condition: { labels: ["상품상태", "신상품", "중고상품"] },
    detail: { kind: "contenteditable", note: "스마트에디터 본문에 텍스트만 입력됩니다." },
    category: { kind: "manual", note: "카테고리 선택은 직접 진행하세요(마켓 코드 매핑은 categoryCodes 사용)." }
  }),
  requirements: [
    "스마트스토어 판매자센터 로그인",
    "카테고리 선택 및 고시정보 입력",
    "배송정책(출고지·반품지) 사전 설정",
    "원산지 정보"
  ],
  notes: [
    "상품 등록 화면에서 확장 아이콘을 열고 실행하세요.",
    "상세설명·배송·A/S·검색설정 등 접힌 섹션은 실행 시 자동으로 펼칩니다.",
    "스마트에디터는 서식 있는 HTML 붙여넣기를 지원하지 않아 텍스트로 입력됩니다.",
    "원산지(Selectize)·카테고리·이미지·옵션은 직접 선택해야 합니다."
  ]
};
