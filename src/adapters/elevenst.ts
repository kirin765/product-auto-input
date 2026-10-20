import type { MarketplaceAdapter } from "./types";
import { commonFields } from "./common";

export const elevenst: MarketplaceAdapter = {
  id: "elevenst",
  name: "11번가 셀러오피스",
  shortName: "11번가",
  sellerCenter: "https://soffice.11st.co.kr/",
  createUrl: "https://soffice.11st.co.kr/",
  hosts: ["soffice.11st.co.kr"],
  urlPatterns: [/.*/],
  verified: false,
  fields: commonFields({
    title: { key: "title", kind: "text", required: true, labels: ["상품명", "상품명(노출)"] },
    detail: { kind: "contenteditable" }
  }),
  requirements: [
    "11번가 셀러오피스 로그인",
    "카테고리 선택",
    "배송·반품 정책 설정"
  ],
  notes: ["등록 화면이 단계별로 나뉘면 각 단계에서 다시 실행하세요."]
};
