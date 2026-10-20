import type { MarketplaceAdapter } from "./types";
import { commonFields } from "./common";

export const zigzag: MarketplaceAdapter = {
  id: "zigzag",
  name: "지그재그 파트너센터",
  shortName: "지그재그",
  sellerCenter: "https://partner.zigzag.kr/",
  createUrl: "https://partner.zigzag.kr/",
  hosts: ["partner.zigzag.kr"],
  urlPatterns: [/.*/],
  verified: false,
  fields: commonFields({
    title: { key: "title", kind: "text", required: true, labels: ["상품명", "상품 이름"] },
    detail: { kind: "contenteditable" }
  }),
  requirements: [
    "지그재그 파트너센터 로그인",
    "브랜드 승인",
    "카테고리 선택",
    "배송·교환/반품 정책 설정"
  ],
  notes: [
    "패션 카테고리는 사이즈·색상 옵션 구조가 별도이므로 옵션은 직접 구성하세요.",
    "이미지 규격(정방형 등)이 다를 수 있어 업로드 후 미리보기를 확인하세요."
  ]
};
