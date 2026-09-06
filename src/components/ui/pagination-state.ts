export function paginationState(page: number, total: number, size: number) {
  const pages = Math.max(1, Math.ceil(total / size))
  const currentPage = Math.min(Math.max(1, page), pages)
  return {
    page: currentPage,
    pages,
    start: (currentPage - 1) * size,
    end: Math.min(currentPage * size, total),
  }
}
