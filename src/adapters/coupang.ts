import type { MarketplaceAdapter, PostFillResult, PrepareResult } from "./types";
import { commonFields } from "./common";
import { isVisible } from "../shared/dom";
import type { CanonicalProduct } from "../shared/product";

export interface PrepareOptions {
  wait?: (ms: number) => Promise<void>;
}

const defaultWait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * 쿠팡 등록 진입 화면 처리.
 * - '검색' 모드의 '신규 상품 등록하기'로 직접 입력 폼 진입
 * - 최초 1회 안전 가이드 모달(다운로드 → 동의 → 계속) 처리
 * 제출 버튼(상품등록/저장)은 절대 누르지 않는다.
 */
export async function prepareCoupang(
  root: Document = document,
  options: PrepareOptions = {}
): Promise<PrepareResult> {
  const wait = options.wait ?? defaultWait;
  const actions: string[] = [];
  const formReady = () =>
    Boolean(
      root.querySelector(
        'button.new-listing-category-field__manual, input[placeholder="상품명을 입력해주세요."]'
      )
    );
  const visibleButton = (text: string): HTMLButtonElement | undefined =>
    Array.from(root.querySelectorAll("button")).find(
      (item): item is HTMLButtonElement =>
        isVisible(item) && textOf(item) === text
    );

  if (formReady()) return { actions };

  const continueButton = visibleButton("상품등록 계속하기");
  if (continueButton) {
    const download = Array.from(root.querySelectorAll("button")).find(
      (item) =>
        isVisible(item) &&
        String(item.className).includes("download") &&
        textOf(item).includes("원산지")
    );
    if (download) {
      (download as HTMLButtonElement).click();
      actions.push("원산지 안내 다운로드 확인");
      await wait(300);
    }

    const checkbox = Array.from(
      root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    ).find((item) =>
      Array.from(item.labels ?? []).some((label) => textOf(label).includes("모든 내용을 확인"))
    );
    if (checkbox && !checkbox.checked) {
      const label = Array.from(checkbox.labels ?? [])[0];
      (label ?? checkbox).click();
      if (!checkbox.checked) checkbox.click();
      actions.push("안전 가이드 동의");
      await wait(200);
    }

    if (!continueButton.disabled) {
      continueButton.click();
      actions.push("상품등록 화면으로 이동");
      await wait(500);
    }
  }

  if (!formReady()) {
    const directMode = Array.from(
      root.querySelectorAll<HTMLButtonElement>("button.new-listing-home__mode")
    ).find((item) => isVisible(item) && textOf(item) === "직접 입력");
    if (directMode) {
      directMode.click();
      actions.push("직접 입력 등록 방식 선택");
      await wait(300);
      const submit = root.querySelector<HTMLButtonElement>(
        "button.new-listing-home__submit"
      );
      if (submit && isVisible(submit)) {
        submit.click();
        actions.push("상품 등록 폼으로 이동");
        await wait(1200);
      }
    }
  }

  if (!formReady()) {
    const entry = visibleButton("신규 상품 등록하기");
    if (entry) {
      entry.click();
      actions.push("신규 상품 등록으로 이동");
      await wait(800);
    }
  }

  for (let attempt = 0; attempt < 6 && !formReady(); attempt++) {
    await wait(300);
  }

  return { actions };
}

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
    title: {
      key: "title",
      kind: "text",
      required: true,
      labels: ["노출상품명", "상품명"],
      selectors: ['input[placeholder="상품명을 입력해주세요."]']
    },
    brand: {
      kind: "manual",
      note: "브랜드 목록에서 선택하거나 '브랜드 없음(혹은 자체제작)'을 체크하세요."
    },
    manufacturer: {
      kind: "textarea",
      labels: ["제조자"],
      note: "상품정보 및 제공 고시의 '제조자(수입자)' 항목에 입력됩니다."
    },
    origin: {
      kind: "textarea",
      labels: ["제조국"],
      note: "상품정보 및 제공 고시의 '제조국' 항목에 입력됩니다."
    },
    detail: {
      kind: "contenteditable",
      note: "상세 페이지 탭에서 HTML 작성 또는 에디터를 선택한 뒤 입력하세요."
    }
  }),
  prepare: prepareCoupang,
  postFill: fillCoupangRows,
  steps: [
    "1. 등록 방식에서 '직접 입력' 선택",
    "2. 상품명·브랜드·카테고리 선택",
    "3. 옵션 추가 (옵션별 등록)",
    "4. 가격 탭에서 판매가·재고 입력",
    "5. 상세 페이지에서 상세설명·이미지 입력",
    "6. 상품정보 및 제공 고시 입력",
    "7. 판매·배송 정책 확인"
  ],
  requirements: [
    "쿠팡 Wing 로그인 및 판매자 승인",
    "카테고리(추천 카테고리 또는 코드) 선택",
    "배송·반품 정책 설정",
    "일부 카테고리 인증서류"
  ],
  notes: [
    "새 등록 홈에서 '직접 입력' 모드를 자동으로 선택해 등록 폼으로 들어갑니다.",
    "카테고리를 선택해야 가격·옵션·상세·고시 섹션이 렌더링됩니다.",
    "쿠팡은 등록 단계가 여러 화면으로 나뉩니다. 단계마다 '폼 채우기'를 다시 실행하세요.",
    "옵션 빌더는 색상·용량·수량 세 축에 값이 있어야 아이템이 생성됩니다. 옵션 생성은 수동으로 하고, 생성된 행의 재고·판매자코드·가격은 자동 입력됩니다.",
    "옵션을 추가해야 가격 탭에 판매가 행이 생성됩니다.",
    "노출상품명을 입력하면 등록상품명(판매자관리용)도 같은 값으로 반영됩니다.",
    "브랜드는 목록 선택이 필요해 자동 입력 대상에서 제외했습니다."
  ]
};

function setInputValue(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * 쿠팡의 옵션 표(재고·판매자코드)와 가격 표(판매가·정상가)를 채운다.
 * 옵션 자체는 판매자가 먼저 추가해야 하며, 여기서는 생성된 행만 채운다.
 */
export async function fillCoupangRows(
  product: CanonicalProduct,
  root: Document = document
): Promise<PostFillResult> {
  const actions: string[] = [];
  const warnings: string[] = [];
  const optionValues = product.optionGroups[0]?.values ?? [];
  const optionRows = Array.from(
    root.querySelectorAll("table.easy-add-table tbody tr")
  ).filter((row) => isVisible(row));

  if (optionRows.length > 0) {
    optionRows.forEach((row, index) => {
      const name = row.querySelector(".option-name__text")?.textContent ?? "";
      const value =
        optionValues.find((item) => name.includes(item.name)) ??
        optionValues[index] ??
        optionValues[0];
      const stockInput = row.querySelector<HTMLInputElement>(
        "input.unit-input__field"
      );
      const skuInput = row.querySelector<HTMLInputElement>("input.cell-input");
      if (stockInput) {
        setInputValue(stockInput, String(value?.stock ?? product.stock));
      }
      if (skuInput && (value?.sku ?? product.sku)) {
        setInputValue(skuInput, value?.sku ?? product.sku ?? "");
      }
    });
    actions.push("옵션 재고·판매자코드 입력");
  } else {
    warnings.push("쿠팡 옵션을 먼저 추가한 뒤 다시 실행하세요.");
  }

  const priceTables = Array.from(
    root.querySelectorAll("table.easy-price-table")
  ).filter((table) => table.querySelector("tbody tr"));
  const priceTable = priceTables[priceTables.length - 1];
  const priceRows = priceTable
    ? Array.from(priceTable.querySelectorAll("tbody tr"))
    : [];

  if (priceRows.length > 0) {
    for (const row of priceRows) {
      const inputs = Array.from(
        row.querySelectorAll<HTMLInputElement>("input.unit-input__field")
      ).filter((input) => input.type === "text");
      if (inputs[0]) setInputValue(inputs[0], String(product.price));
      if (inputs[1] && product.originalPrice !== undefined) {
        setInputValue(inputs[1], String(product.originalPrice));
      }
    }
    actions.push("판매가·정상가 입력");
  } else {
    warnings.push("가격 탭에 옵션 행이 없습니다. 옵션을 먼저 추가하세요.");
  }

  return { actions, warnings };
}
