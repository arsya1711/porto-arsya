import type { PostgrestError } from "@supabase/supabase-js";

type PageResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

export async function fetchAllPages<T>(
  requestPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 500,
): Promise<PageResult<T>> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const result = await requestPage(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
