import type { PostgrestError } from "@supabase/supabase-js";

type PageResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

export async function fetchAllPages<T>(
  requestPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 250,
  maxRows = 10_000,
): Promise<PageResult<T>> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    if (rows.length >= maxRows) {
      return {
        data: rows,
        error: {
          code: "PGRST301",
          details: "Maximum rows exceeded for paginated fetch.",
          hint: "Narrow the query or add filters before loading the full dataset.",
          message: "Dataset terlalu besar untuk dimuat sekaligus.",
        } as unknown as NonNullable<PageResult<T>["error"]>,
      };
    }

    const result = await requestPage(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize || rows.length >= maxRows) {
      return { data: rows, error: null };
    }
  }
}
