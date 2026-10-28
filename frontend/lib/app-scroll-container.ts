/**
 * id của cột nội dung cuộn được trong layout dashboard — để
 * lib/navigation-history.ts ghi nhớ/khôi phục vị trí cuộn khi quay lại.
 * Tách riêng khỏi navigation-history.ts ("use client") để layout (server
 * component) import được giá trị thật.
 */
export const APP_SCROLL_CONTAINER_ID = "app-scroll-container";
