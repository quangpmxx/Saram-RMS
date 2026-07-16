"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { AppRealtimeEvent, LeadRealtimeEvent } from "./types";

/**
 * FIX (2026-07-16, phản hồi trực tiếp người dùng — test đa máy: máy B luôn
 * báo net::ERR_CONNECTION_REFUSED tới "localhost:3001"): LẦN SỬA TRƯỚC dùng
 * URL tuyệt đối "http://localhost:3001" — chỉ đúng khi trình duyệt và
 * backend chạy CÙNG 1 máy. Máy khác (B) mở trang qua LAN/tunnel thì
 * "localhost:3001" trên máy B trỏ vào CHÍNH MÁY B (không có gì ở đó) → socket
 * không bao giờ kết nối được, nên máy đó không nhận sự kiện nào (nhưng hành
 * động của máy đó vẫn ghi được vào DB qua REST — REST dùng đường dẫn tương
 * đối "/api" nên không bị ảnh hưởng, dẫn tới hiện tượng LỆCH 1 CHIỀU: máy A
 * (chạy dev) thấy hành động của B, còn B không thấy hành động của A).
 *
 * Sửa đúng: cho Socket.IO kết nối qua CÙNG origin với trang web đang mở
 * (không truyền URL — mặc định dùng location hiện tại của trình duyệt, dù
 * đó là "localhost:3000", 1 IP LAN, hay 1 URL tunnel), với `path` trỏ vào
 * "/api/socket.io" — khớp đúng rewrite proxy có sẵn trong next.config.ts
 * ("/api/:path*" -> backend "/:path*"), nên request polling/websocket được
 * Next.js tự chuyển tiếp sang backend thật (server-to-server, luôn đúng địa
 * chỉ dù trình duyệt đang ở máy/mạng nào). Cùng cơ chế proxy REST đã dùng
 * cho clientApi() — không cần biến môi trường riêng nữa.
 */
const SOCKET_PATH = "/api/socket.io";

const LEAD_EVENT_NAME = "leads:update";
/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — "Mở rộng cơ chế đồng bộ
 * realtime sang Đưa đón/Báo cáo/Check phạt/Thông báo/Dashboard": kênh RIÊNG
 * cho 4 module này, khớp đúng APP_EVENT_NAME ở backend
 * (realtime.gateway.ts) — dùng CHUNG connection/socket singleton bên dưới
 * với leads:update (Mục 5: "tái sử dụng connection/service hiện có, không
 * tạo hệ thống WebSocket riêng"), chỉ khác tên sự kiện.
 */
const APP_EVENT_NAME = "app:event";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — "Sửa chức năng cập nhật dữ
 * liệu realtime trong module Data lao động": 1 kết nối Socket.IO DUY NHẤT
 * dùng chung cho toàn bộ ứng dụng (module-level singleton, không tạo lại
 * mỗi lần component mount) — "Không tạo nhiều connection hoặc nhiều
 * listener trùng khi chuyển trang" (Mục 6). `withCredentials: true` để
 * trình duyệt đính kèm cookie `access_token` trong bắt tay WebSocket, khớp
 * đúng cách clientApi() đã làm cho REST (`credentials: "include"`) — cùng
 * 1 cơ chế xác thực cookie httpOnly, không cần thêm token thủ công.
 * Socket.IO tự động reconnect (mặc định `reconnection: true`) — không cần
 * tự viết lại logic thử kết nối lại.
 */
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: SOCKET_PATH,
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
}

/**
 * Đăng ký/hủy đăng ký lắng nghe sự kiện `leads:update` — dùng trong
 * useEffect, LUÔN dọn dẹp bằng hàm trả về khi unmount để không cộng dồn
 * listener trùng qua các lần điều hướng trang (Mục 6, Mục 8 — "kiểm tra
 * không bị listener trùng hoặc cập nhật lặp").
 */
export function useLeadRealtime(onEvent: (event: LeadRealtimeEvent) => void) {
  // Giữ callback mới nhất trong ref — tránh phải re-subscribe (gỡ rồi gắn
  // lại listener) mỗi khi component cha re-render tạo ra 1 hàm onEvent mới,
  // chỉ subscribe đúng 1 lần lúc mount. Gán ref trong effect riêng (KHÔNG
  // gán thẳng lúc render) — quy tắc react-hooks/refs mới không cho phép
  // ghi ref.current trong thân render.
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const client = getSocket();
    const listener = (event: LeadRealtimeEvent) => handlerRef.current(event);
    client.on(LEAD_EVENT_NAME, listener);
    return () => {
      client.off(LEAD_EVENT_NAME, listener);
    };
  }, []);
}

/**
 * Đăng ký/hủy đăng ký lắng nghe sự kiện `app:event` (Đưa đón/Báo cáo/Check
 * phạt/Thông báo/Dashboard) — cùng khuôn mẫu ref-trong-effect với
 * useLeadRealtime() ở trên, dùng CHUNG socket singleton (getSocket()),
 * không mở kết nối thứ 2.
 */
export function useAppRealtime(onEvent: (event: AppRealtimeEvent) => void) {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const client = getSocket();
    const listener = (event: AppRealtimeEvent) => handlerRef.current(event);
    client.on(APP_EVENT_NAME, listener);
    return () => {
      client.off(APP_EVENT_NAME, listener);
    };
  }, []);
}

/**
 * Mục 6, yêu cầu người dùng: "Sau khi reconnect, refetch dữ liệu trang
 * hiện tại một lần để tránh bỏ sót event." Sự kiện `connect` của Socket.IO
 * bắn cả lúc kết nối lần đầu LẪN mỗi lần tự động kết nối lại sau khi mất
 * mạng — gọi refetch ở cả 2 trường hợp là an toàn (lần đầu refetch trùng
 * với dữ liệu SSR ban đầu, chỉ tốn 1 lượt gọi API dư, không gây hại).
 */
export function useRealtimeReconnect(onReconnect: () => void) {
  const handlerRef = useRef(onReconnect);
  useEffect(() => {
    handlerRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    const client = getSocket();
    const listener = () => handlerRef.current();
    client.on("connect", listener);
    return () => {
      client.off("connect", listener);
    };
  }, []);
}
