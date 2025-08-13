import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1e12) {
    return `${(tokens / 1e12).toFixed(1)}T`;
  } else if (tokens >= 1e9) {
    return `${(tokens / 1e9).toFixed(1)}B`;
  } else if (tokens >= 1e6) {
    return `${(tokens / 1e6).toFixed(1)}M`;
  } else if (tokens >= 1e3) {
    return `${(tokens / 1e3).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function formatPrice(price: number): string {
  return price < 1 ? `$${price.toFixed(3)}` : `$${price.toFixed(2)}`;
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

export function formatContext(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return tokens.toString();
}
