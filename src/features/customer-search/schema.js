// Ai viết: Codex
// Tại sao: validate input ở HTTP boundary, để service chỉ nhận dữ liệu đã có cấu trúc.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-008_MapSearchRequestFoundation.md + docs/04_PROMPTS/PROMPT-009_SearchZonesAndDistance.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

import { z } from "zod";

const CUSTOMER_NAME_MAX_LENGTH = 100; // WHY: đủ tên hiển thị, ngăn input quá dài.
const PHONE_INPUT_MAX_LENGTH = 30; // WHY: gồm khoảng trắng, dấu + và số Việt Nam.
const REQUEST_TITLE_MAX_LENGTH = 120; // WHY: tiêu đề ngắn, dễ hiển thị trong CRM.
const ZONE_LABEL_MAX_LENGTH = 160; // WHY: hiển thị được địa chỉ nhưng không biến thành nội dung tin dài.
export const MIN_RADIUS_METERS = 200; // WHY: vòng nhỏ hơn 200m không hữu ích cho lọc trọ.
export const MAX_RADIUS_METERS = 20_000; // WHY: giới hạn truy vấn địa phương trong một nhu cầu.

export const CustomerIdSchema = z.string().uuid("Mã khách không hợp lệ");
export const SearchRequestIdSchema = z.string().uuid("Mã nhu cầu không hợp lệ");
export const SearchZoneIdSchema = z.string().uuid("Mã vùng không hợp lệ");
export const RoomIdSchema = z.string().uuid("Mã phòng không hợp lệ");

export const CreateCustomerSchema = z.object({
  name: z.string().trim().min(1, "Cần nhập tên khách").max(CUSTOMER_NAME_MAX_LENGTH, "Tên khách tối đa 100 ký tự"),
  phone: z.string().trim().min(6, "Số điện thoại không hợp lệ").max(PHONE_INPUT_MAX_LENGTH, "Số điện thoại tối đa 30 ký tự"),
});

export const CreateSearchRequestSchema = z.object({
  title: z.string().trim().min(2, "Tên nhu cầu tối thiểu 2 ký tự").max(REQUEST_TITLE_MAX_LENGTH, "Tên nhu cầu tối đa 120 ký tự"),
});

export const UpdateSearchRequestSchema = z.object({
  active: z.boolean(),
});

const MapPointSchema = z.object({
  latitude: z.number().finite("Vĩ độ không hợp lệ").min(-90, "Vĩ độ không hợp lệ").max(90, "Vĩ độ không hợp lệ"),
  longitude: z.number().finite("Kinh độ không hợp lệ").min(-180, "Kinh độ không hợp lệ").max(180, "Kinh độ không hợp lệ"),
});

export const SearchZoneInputSchema = z.object({
  label: z.string().trim().min(2, "Nhãn vùng tối thiểu 2 ký tự").max(ZONE_LABEL_MAX_LENGTH, "Nhãn vùng tối đa 160 ký tự"),
  center: MapPointSchema,
  radiusMeters: z.number().int("Bán kính phải là số nguyên").min(MIN_RADIUS_METERS, "Bán kính tối thiểu 200m").max(MAX_RADIUS_METERS, "Bán kính tối đa 20km"),
  enabled: z.boolean().default(true),
});

export const MapRoomsInputSchema = z.object({
  zones: z.array(SearchZoneInputSchema).max(10, "Tối đa 10 vùng trên bản đồ"),
});

export const ResolveRoomLocationSchema = z.object({
  address: z.string().trim().min(2, "Địa chỉ tối thiểu 2 ký tự").max(300, "Địa chỉ tối đa 300 ký tự"),
  selectFirst: z.boolean().default(false),
});

export const MapGeocodeQuerySchema = z.object({
  query: z.string().trim().min(2, "Địa chỉ tìm tối thiểu 2 ký tự").max(160, "Địa chỉ tìm tối đa 160 ký tự"),
});
