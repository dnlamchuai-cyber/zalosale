// AI: Codex | WHY: Contact details are local-only and must belong to an existing source group.
// SPEC: approved source-group contact fields on 2026-09-06
import assert from "node:assert/strict";
import test from "node:test";
import { parseConfig } from "./config.js";

test("keeps contact details only for configured source groups", () => {
  const config = parseConfig({
    sourceGroups: ["source-1"],
    sourceGroupContacts: {
      "source-1": { admins: " Mai — 0901", deputies: "", supportGroup: "Nhóm hỗ trợ — https://zalo.me/g/help", note: "Ưu tiên gọi giờ hành chính" },
      removed: { admins: "Không được lưu", deputies: "", supportGroup: "", note: "" },
    },
  });

  assert.deepEqual(config.sourceGroupContacts, {
    "source-1": { admins: "Mai — 0901", deputies: "", supportGroup: "Nhóm hỗ trợ — https://zalo.me/g/help", note: "Ưu tiên gọi giờ hành chính" },
  });
});

test("rejects contact details that exceed the local storage limit", () => {
  assert.throws(
    () => parseConfig({ sourceGroups: ["source-1"], sourceGroupContacts: { "source-1": { admins: "a".repeat(2001) } } }),
    /sourceGroupContacts.*2000/,
  );
});
