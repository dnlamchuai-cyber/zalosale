// Ai viết: Codex
// Tại sao: dùng SQLite thật để chứng minh migration và ràng buộc khách/nhiều nhu cầu hoạt động cùng nhau.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-008_MapSearchRequestFoundation.md

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCustomerSearchService } from "./service.js";

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-customer-search-"));
const databasePath = path.join(tempDirectory, "test.sqlite");
let service;

try {
  service = createCustomerSearchService({ databasePath });
  const customer = service.createCustomer({ name: "Lan", phone: "0901 234 567" });

  assert.equal(customer.name, "Lan");
  assert.equal(customer.phoneDisplay, "0901 234 567");
  assert.equal(customer.phoneNormalized, "0901234567");

  assert.throws(
    () => service.createCustomer({ name: "Lan khác", phone: "+84 901234567" }),
    (error) => error.code === "DUPLICATE_PHONE",
  );

  const firstRequest = service.createSearchRequest({
    customerId: customer.id,
    title: "Quanh Ga Hà Đông",
  });
  const secondRequest = service.createSearchRequest({
    customerId: customer.id,
    title: "Quanh Mỹ Đình",
  });

  assert.equal(firstRequest.active, true);
  assert.equal(secondRequest.customerId, customer.id);
  assert.deepEqual(
    service.listSearchRequests(customer.id).map((request) => request.title),
    ["Quanh Mỹ Đình", "Quanh Ga Hà Đông"],
  );
  assert.equal(
    service.setSearchRequestActive({ customerId: customer.id, requestId: firstRequest.id, active: false }).active,
    false,
  );
  assert.throws(
    () => service.createSearchRequest({ customerId: "missing", title: "Không có khách" }),
    (error) => error.code === "CUSTOMER_NOT_FOUND",
  );
} finally {
  service?.close();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
