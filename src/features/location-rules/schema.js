// Ai viết: Muse Spark | Tại sao: zod ở boundary để rule bẩn không lọt vào kho local
// Link SPEC: yêu cầu "Kho địa danh Hà Nội & định tuyến nhiều nhóm" ngày 2026-09-11
import { z } from "zod";

export const RULE_TYPES = ["duong", "ngo", "phuong", "dia-danh"];
export const RULE_SOURCES = ["osm", "manual", "alias"];

// WHY: routingKey ổn định, không phụ thuộc tên/ID Zalo có thể đổi
export const RoutingKeySchema = z.string()
  .min(2, "routingKey tối thiểu 2 ký tự")
  .max(40, "routingKey tối đa 40 ký tự")
  .regex(/^[a-z0-9-]+$/, "routingKey chỉ gồm chữ thường, số và gạch ngang");

export const LocationRuleSchema = z.object({
  name: z.string().min(2, "Tên địa danh tối thiểu 2 ký tự").max(120, "Tên tối đa 120 ký tự"),
  type: z.enum(RULE_TYPES),
  routingKeys: z.array(RoutingKeySchema).min(1, "Cần ít nhất 1 nhóm đích").max(5, "Tối đa 5 nhóm đích"),
  enabled: z.boolean().default(true),
  source: z.enum(RULE_SOURCES).default("manual"),
  note: z.string().max(300, "Ghi chú tối đa 300 ký tự").default(""),
});

export const UpdateLocationRuleSchema = LocationRuleSchema.partial().extend({
  id: z.string().min(1, "Thiếu id rule"),
});

export const OsmImportPreviewSchema = z.object({
  routingKeys: z.array(RoutingKeySchema).min(1).max(13),
});
