/** Standard shape of every list response. */
export interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}
