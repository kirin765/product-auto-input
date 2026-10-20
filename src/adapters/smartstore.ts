import type { MarketplaceAdapter } from "./types";
import { commonFields } from "./common";

export const smartstore: MarketplaceAdapter = {
  id: "smartstore",
  name: "네이버 스마트스토어",
  shortName: "스마트스토어",
  sellerCenter: "https://sell.smartstore.naver.com/",
  createUrl: "https://sell.smartstore.naver.com/",
  hosts: ["sell.smartstore.naver.com"],
  urlPatterns: [/.*/],
  verified: false,
  fields: commonFields({
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
    "스마트에디터는 서식 있는 HTML 붙여넣기를 지원하지 않아 텍스트로 입력됩니다."
  ]
};
