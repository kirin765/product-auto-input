import type { MarketplaceAdapter } from "./types";
import { commonFields } from "./common";

export const gmarket: MarketplaceAdapter = {
  id: "gmarket",
  name: "G마켓 ESM Trade",
  shortName: "G마켓",
  sellerCenter: "https://etrade.gmarket.co.kr/",
  createUrl: "https://etrade.gmarket.co.kr/",
  hosts: ["etrade.gmarket.co.kr"],
  urlPatterns: [/.*/],
  verified: false,
  fields: commonFields({ detail: { kind: "contenteditable" } }),
  requirements: [
    "ESM Trade(G마켓) 로그인",
    "카테고리 코드 선택",
    "배송비·반품 정책 설정"
  ],
  notes: [
    "G마켓과 옥션은 ESM Trade 계열이지만 화면이 다를 수 있어 각각 확인이 필요합니다.",
    "ESM PLUS로 이전한 계정은 해당 판매자센터 주소를 추가해야 합니다."
  ]
};

export const auction: MarketplaceAdapter = {
  ...gmarket,
  id: "auction",
  name: "옥션 ESM Trade",
  shortName: "옥션",
  sellerCenter: "https://etrade.auction.co.kr/",
  createUrl: "https://etrade.auction.co.kr/",
  hosts: ["etrade.auction.co.kr"],
  requirements: [
    "ESM Trade(옥션) 로그인",
    "카테고리 코드 선택",
    "배송비·반품 정책 설정"
  ]
};
