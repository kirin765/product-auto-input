import type { MarketplaceAdapter } from "./types";
import { commonFields } from "./common";

export const coupang: MarketplaceAdapter = {
  id: "coupang",
  name: "쿠팡 Wing",
  shortName: "쿠팡",
  sellerCenter: "https://wing.coupang.com/",
  createUrl: "https://wing.coupang.com/",
  hosts: ["wing.coupang.com"],
  urlPatterns: [/.*/],
  verified: false,
  fields: commonFields({
    title: { key: "title", kind: "text", required: true, labels: ["노출상품명", "상품명"] },
    detail: { kind: "contenteditable", note: "쿠팡 상세페이지 에디터에 텍스트로 입력됩니다." }
  }),
  requirements: [
    "쿠팡 Wing 로그인 및 판매자 승인",
    "카테고리(추천 카테고리 또는 코드) 선택",
    "배송·반품 정책 설정",
    "일부 카테고리 인증서류"
  ],
  notes: [
    "쿠팡은 등록 단계가 여러 화면으로 나뉩니다. 단계마다 '폼 채우기'를 다시 실행하세요.",
    "아이템 확장(옵션)은 별도 화면에서 직접 구성해야 합니다."
  ]
};
