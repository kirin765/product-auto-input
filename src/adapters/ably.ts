import type { MarketplaceAdapter } from "./types";
import { commonFields } from "./common";

export const ably: MarketplaceAdapter = {
  id: "ably",
  name: "에이블리 셀러센터",
  shortName: "에이블리",
  sellerCenter: "https://seller.a-bly.com/",
  createUrl: "https://seller.a-bly.com/",
  hosts: ["seller.a-bly.com"],
  urlPatterns: [/.*/],
  verified: false,
  fields: commonFields({
    title: { key: "title", kind: "text", required: true, labels: ["상품명", "상품 이름"] },
    detail: { kind: "contenteditable" }
  }),
  requirements: [
    "에이블리 셀러센터 로그인",
    "브랜드·입점 승인",
    "카테고리 선택",
    "배송·교환/반품 정책 설정"
  ],
  notes: [
    "패션 카테고리는 사이즈·색상 옵션 구조가 별도이므로 옵션은 직접 구성하세요.",
    "상품 검수 정책상 등록 후 승인까지 시간이 걸릴 수 있습니다."
  ]
};
