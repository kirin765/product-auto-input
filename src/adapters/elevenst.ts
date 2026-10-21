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
  formInIframe: true,
  fields: commonFields({
    title: { key: "title", kind: "text", required: true, labels: ["상품명", "상품명(노출)"] },
    detail: { kind: "contenteditable" },
    asInfo: { kind: "textarea" },
    deliveryFee: {
      kind: "manual",
      note: "배송비 설정(무료/고정배송비)을 먼저 선택한 뒤 금액을 직접 입력하세요."
    }
  }),
  requirements: [
    "11번가 셀러오피스 로그인",
    "카테고리 선택",
    "배송·반품 정책 설정",
    "개인셀러는 최초 1회 정산 정보(주민등록번호·계좌) 인증 필요"
  ],
  notes: [
    "상품 등록 폼은 /pages/product-reg/index.html iframe 안에 렌더링됩니다.",
    "등록 화면이 단계별로 나뉘면 각 단계에서 다시 실행하세요."
  ]
};

/** 구버전(/view/8005 → ProductReg.tmall) 등록 화면은 필드 구조가 달라 지원하지 않는다. */
export function isLegacyElevenstForm(url: string): boolean {
  return /\/product\/ProductReg\.tmall/i.test(url);
}
