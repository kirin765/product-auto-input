import type { MarketplaceAdapter, PostFillResult } from "./types";
import type { CanonicalProduct } from "../shared/product";
import { commonFields } from "./common";

const TAGS_SELECTOR = 'input[placeholder="해시태그를 입력하세요"]';

async function selectCondition(
  product: CanonicalProduct,
  root: Document,
  actions: string[],
  warnings: string[]
): Promise<void> {
  const labelText = product.condition === "used" ? "중고" : "신상품";
  const label = Array.from(root.querySelectorAll("label")).find(
    (candidate) => candidate.textContent?.trim() === labelText
  );
  const input = label?.querySelector<HTMLInputElement>('input[type="radio"]');
  if (!input) {
    warnings.push(`"상품 상태"에서 '${labelText}'를 직접 선택하세요.`);
    return;
  }
  if (!input.checked) input.click();
  actions.push(`상품 상태: ${labelText}`);
  if (product.condition === "refurbished") {
    warnings.push("에이블리는 리퍼비시 상태가 없어 '중고'로 선택했습니다.");
  }
}

async function fillTags(
  product: CanonicalProduct,
  root: Document,
  actions: string[],
  warnings: string[]
): Promise<void> {
  if (product.tags.length === 0) return;
  const input = root.querySelector<HTMLInputElement>(TAGS_SELECTOR);
  if (!input) {
    warnings.push(`"해시태그" 입력란을 찾지 못했습니다. 직접 입력하세요.`);
    return;
  }

  const tags = product.tags
    .map((tag) => tag.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 30);

  input.focus();
  for (const tag of tags) {
    const setter = Object.getOwnPropertyDescriptor(
      input.ownerDocument.defaultView?.HTMLInputElement.prototype ?? HTMLInputElement.prototype,
      "value"
    )?.set;
    if (setter) setter.call(input, tag);
    else input.value = tag;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      })
    );
  }

  if (tags.length > 0) actions.push(`해시태그 ${tags.length}개 입력`);
  if (product.tags.length > 30) {
    warnings.push("해시태그는 최대 30개까지만 입력됩니다.");
  }
}

async function postFill(
  product: CanonicalProduct,
  root: Document
): Promise<PostFillResult> {
  const actions: string[] = [];
  const warnings: string[] = [];
  await selectCondition(product, root, actions, warnings);
  await fillTags(product, root, actions, warnings);
  return { actions, warnings };
}

/**
 * 에이블리 셀러센터. 등록 화면 셸은 my.a-bly.com/goods/v2/register이며,
 * 실제 입력 폼은 seller-admin.a-bly.com iframe에서 렌더링된다.
 */
export const ably: MarketplaceAdapter = {
  id: "ably",
  name: "에이블리 셀러센터",
  shortName: "에이블리",
  sellerCenter: "https://my.a-bly.com/",
  createUrl: "https://my.a-bly.com/goods/v2/register",
  hosts: ["my.a-bly.com", "seller-admin.a-bly.com"],
  urlPatterns: [/.*/],
  verified: true,
  postFill,
  fields: commonFields({
    title: {
      key: "title",
      kind: "text",
      required: true,
      labels: ["상품명"],
      selectors: ["#name"]
    },
    brand: {
      kind: "manual",
      note: "'검색 및 등록'에서 브랜드를 직접 검색·선택하세요."
    },
    manufacturer: {
      kind: "manual",
      note: "상품정보제공고시에서 직접 입력하세요."
    },
    supplier: {
      kind: "manual",
      note: "상품정보제공고시에서 직접 입력하세요."
    },
    origin: {
      kind: "manual",
      note: "상품정보제공고시에서 직접 입력하세요."
    },
    price: {
      labels: ["판매가"],
      selectors: ["#prices_0_consumer"],
      note: "대표 옵션의 판매가로 입력됩니다."
    },
    originalPrice: {
      kind: "manual",
      note: "할인 설정에서 직접 입력하세요."
    },
    stock: {
      kind: "manual",
      note: "옵션 조합을 만든 뒤 옵션별 재고 수량을 입력하세요."
    },
    sku: {
      labels: ["판매자상품코드"],
      selectors: ["#custom_code"]
    },
    barcode: {
      kind: "manual",
      note: "상품정보제공고시에서 직접 입력하세요."
    },
    condition: {
      kind: "manual",
      note: "상품 상태(신상품/중고)는 '폼 채우기' 실행 시 자동 선택됩니다."
    },
    category: {
      kind: "manual",
      note: "카테고리 검색·선택은 직접 진행하세요."
    },
    tags: {
      kind: "manual",
      note: "해시태그는 '폼 채우기' 실행 시 자동 입력됩니다."
    },
    detail: {
      kind: "contenteditable",
      selectors: ['div.fr-element[contenteditable="true"]']
    },
    mainImages: {
      selectors: ['input[type="file"][accept*="gif"]'],
      note: "대표 이미지 1장(900x1080, 2MB, JPG/PNG/GIF)입니다."
    },
    detailImages: {
      selectors: ['input[type="file"][multiple]'],
      note: "커버 이미지 최대 4장(900x900, 2MB, JPG/PNG)입니다."
    },
    deliveryFee: {
      kind: "manual",
      note: "배송 정보에서 배송 정책을 직접 선택하세요."
    },
    deliveryMethod: {
      kind: "manual",
      note: "배송 정보에서 택배사를 직접 선택하세요."
    },
    deliveryDays: {
      kind: "manual",
      note: "예상 발송 소요일을 직접 선택하세요."
    },
    returnFee: {
      kind: "manual",
      note: "배송·교환/반품 정책에서 직접 설정하세요."
    },
    asInfo: {
      kind: "manual",
      note: "상품정보제공고시에서 직접 입력하세요."
    },
    adultOnly: {
      kind: "manual",
      note: "성인상품 여부는 직접 설정하세요."
    },
    optionNames: {
      kind: "manual",
      note: "옵션명·옵션값은 '옵션 설정'에서 직접 구성하세요."
    },
    optionValues: {
      kind: "manual",
      note: "옵션별 가격·재고는 직접 입력하세요."
    }
  }),
  requirements: [
    "에이블리 셀러센터 로그인",
    "브랜드·입점 승인",
    "카테고리 선택",
    "옵션 구성",
    "배송·교환/반품 정책 설정"
  ],
  notes: [
    "등록 폼은 seller-admin.a-bly.com iframe 안에 렌더링됩니다.",
    "카테고리·브랜드·옵션은 마켓 UI 특성상 직접 선택해야 합니다.",
    "상품 상태는 신상품/중고만 지원합니다(리퍼비시는 중고로 선택).",
    "패션 카테고리는 사이즈·색상 옵션 구조가 별도이므로 옵션은 직접 구성하세요.",
    "상품 검수 정책상 등록 후 승인까지 시간이 걸릴 수 있습니다."
  ]
};
