import type { MarketplaceAdapter, PrepareResult } from "./types";
import { commonFields } from "./common";
import { expandSections } from "../shared/dom";

/**
 * ESM Plus는 등록 폼의 대부분이 접힌 패널(.box__panel.is-fold)로 렌더링된다.
 * 값이 있는 섹션만 펼친 뒤 폼을 채운다.
 */
export async function prepareEsmplus(root: Document): Promise<PrepareResult> {
  const actions = await expandSections(root, {
    selectors: [".box__panel.is-fold button.button--open"],
    include: /상품 주요정보|상품 상세설명|판매방식|상품정보 제공고시|배송|반품\/교환|상품 추가 정보/i
  });
  return { actions };
}

/**
 * ESM Plus 셀러센터(구 ESM Trade). 등록 폼은 www.esmplus.com 안의
 * item.esmplus.com/goods/new iframe에서 렌더링된다.
 */
export const esmplus: MarketplaceAdapter = {
  id: "esmplus",
  name: "ESM Plus (G마켓·옥션)",
  shortName: "ESM Plus",
  sellerCenter: "https://www.esmplus.com/",
  createUrl: "https://www.esmplus.com/Home/v2/goods-register",
  hosts: ["www.esmplus.com", "item.esmplus.com"],
  urlPatterns: [/.*/],
  verified: false,
  prepare: prepareEsmplus,
  fields: commonFields({
    title: { key: "title", kind: "text", required: true, labels: ["상품명"] },
    condition: { labels: ["상품상태", "신상품", "중고상품"] },
    price: { labels: ["판매가"] },
    stock: { labels: ["재고수량"] },
    sku: { labels: ["판매자 관리코드"] },
    detail: { kind: "contenteditable" },
    mainImages: { labels: ["상품이미지"] },
    deliveryFee: {
      kind: "manual",
      note: "배송비 유형(무료/유료)과 금액은 배송 정책에서 직접 설정하세요."
    }
  }),
  requirements: [
    "ESM Plus 셀러센터 로그인",
    "카테고리 선택",
    "출고지·반품지·배송비 정책 설정",
    "G마켓/옥션 판매 사이트 선택"
  ],
  notes: [
    "등록 폼은 item.esmplus.com iframe 안에 렌더링됩니다.",
    "상품 주요정보·판매방식·상품 추가 정보 등 접힌 패널은 실행 시 자동으로 펼칩니다.",
    "브랜드와 제조사는 같은 검색 input을 공유해 한쪽만 입력됩니다.",
    "원산지·상품상태·배송방법은 커스텀 버튼형이라 직접 선택해야 합니다.",
    "가격·재고는 G마켓/옥션 사이트별로 입력란이 나뉘며, 같은 라벨의 입력란을 모두 채웁니다.",
    "상품명·판매가·재고수량·판매자 관리코드만 실제 계정으로 확인했습니다."
  ]
};
