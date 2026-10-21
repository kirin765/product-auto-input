import type { MarketplaceAdapter } from "./types";
import { matchesUrl } from "./types";
import type { MarketId } from "../shared/product";
import { smartstore } from "./smartstore";
import { coupang } from "./coupang";
import { elevenst } from "./elevenst";
import { esmplus } from "./esmplus";
import { zigzag } from "./zigzag";
import { ably } from "./ably";

export const MARKETPLACES: MarketplaceAdapter[] = [
  smartstore,
  coupang,
  esmplus,
  elevenst,
  zigzag,
  ably
];

export function getAdapter(id: MarketId): MarketplaceAdapter | undefined {
  return MARKETPLACES.find((adapter) => adapter.id === id);
}

export function detectMarketplace(url: string): MarketplaceAdapter | undefined {
  return MARKETPLACES.find((adapter) => matchesUrl(adapter, url));
}
