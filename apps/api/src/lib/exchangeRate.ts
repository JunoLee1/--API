type ForeignCurrency = "USD" | "EUR" | "GBP";

interface ErApiResponse {
  result: string;
  rates: Record<string, number>;
}

// Fetches KRW exchange rate for a foreign currency from open.er-api.com (free, no key).
// Returns null on network failure or unexpected response — caller must handle fallback.
export async function fetchKrwRate(from: ForeignCurrency): Promise<number | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!res.ok) return null;
    const data = (await res.json()) as ErApiResponse;
    if (data.result !== "success") return null;
    return data.rates["KRW"] ?? null;
  } catch {
    return null;
  }
}
