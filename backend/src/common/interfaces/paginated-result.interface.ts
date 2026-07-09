/** Bọc kết quả danh sách theo đúng quy ước chung — Mục 0, docs/13-api-design.md. */
export interface PaginatedResult<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}
