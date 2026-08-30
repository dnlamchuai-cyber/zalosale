# TASK-004 — Kiểm thử toàn diện zaloSALE

> Trạng thái: 📋 PLANNED — chờ user duyệt | Ngày: 2026-08-30
> Người lập: AI | Phạm vi: bản sửa Community + các luồng bot quan trọng
> Liên kết: `docs/03_SPEC/SPEC-001.md`, `PLAN.md`, `docs/docs/PRODUCTION_DOD.md`

## 1. Mục tiêu và Definition of Done

Chứng minh bot quét, lọc, xem trước và forward đúng tin từ Zalo Community mà không lộ phiên đăng nhập, không gửi nhầm nhóm và không che giấu lỗi API.

DoD:

- Test tự động, build và type-check xanh.
- Quét Community thật tìm thấy tin trong khoảng có dữ liệu; API lỗi thì fallback local đúng.
- Các journey dashboard chính đạt desktop và mobile, có loading/error/keyboard evidence.
- Chỉ forward tối đa 1 bài vào nhóm test đã được user duyệt; text, ảnh, lọc nội dung và khu vực đúng.
- Không commit credential, QR, cache nhóm, log hay lịch sử tin nhắn.
- Review không còn finding blocking; rollback và kết quả được ghi lại.

## 2. Thứ tự kiểm thử

### KT-01 — Đóng băng baseline và bảo vệ dữ liệu

**Phụ thuộc:** không.

**Thực hiện:**

- Ghi commit SHA, Node/npm version, mode và danh sách file thay đổi.
- Xác nhận `.gitignore` loại `config/session/`, `config/config.json`, `config/groups-cache.json`, `data/`, `logs/`.
- Không in token, cookie, nội dung tin hoặc ID nhóm vào evidence công khai.

**Verify:** `git status --short`, `git check-ignore -v <runtime-files>`.

**AC:** có baseline tái lập được; không có runtime secret trong diff.

### KT-02 — Unit và regression test

**Phụ thuộc:** KT-01.

**Thực hiện:**

- Processor: normalize, xóa dòng, exclude, giá và phần trăm.
- Classifier: tiếng Việt có/không dấu, default area, nhiều khu vực.
- History: biên ngày, grouping, count limit, Community POST và fallback local.
- Forwarder: text, ảnh, retry, chống trùng và resolve nhóm đích.

**Verify:** `npm test`, `node --check src/community.js`, `node --check src/history.js`.

**AC:** 0 FAIL; regression Community chứng minh POST + body `params` + fallback với lỗi adapter bất kỳ.

### KT-03 — Integration API không gửi tin

**Phụ thuộc:** KT-02; bot đăng nhập hợp lệ.

**Thực hiện:**

- Kiểm tra `/api/status`, `/api/groups`, `/api/config`, `/api/logs`.
- Gọi `/api/community/check` với ngày hợp lệ, ngày sai, keyword có/không khớp và groupId sai.
- Ngắt adapter Community có kiểm soát để chứng minh fallback store; không sửa/xóa dữ liệu thật.

**Verify:** HTTP status + response schema + log nhánh dữ liệu; không chỉ dựa vào UI.

**AC:** success 200 đúng schema; input sai 400; bot chưa sẵn sàng 409; lỗi bất ngờ 500 có thông báo an toàn.

### KT-04 — Community thật, chỉ đọc

**Phụ thuộc:** KT-03; user chọn 1 Community test có tin trong 1–3 ngày gần nhất.

**Thực hiện:**

- Quét không keyword, sau đó quét với keyword biết chắc có trong tin.
- Đối chiếu tổng bài, timestamp, bài chỉ có ảnh và bài bị exclude.
- Xác nhận log ghi nguồn `Community history` hay `store fallback`, không ghi credential/nội dung nhạy cảm.

**Verify:** kết quả UI/API so với tin nhìn thấy trong Zalo.

**AC:** không còn `0` giả khi khoảng ngày thực sự có tin; keyword và exclude đúng.

### KT-05 — Browser journey desktop và mobile

**Phụ thuộc:** KT-03.

**Journey:** đăng nhập/QR → tải nhóm → chọn Community → chọn ngày/keyword → quét → xem kết quả; sau đó kiểm tra lưu config và scan-review.

**Kiểm tra:**

- Desktop và mobile; loading, empty, error, reconnect SSE.
- Tab/Enter, label form, focus hiện rõ, không tràn nội dung.
- Network 400/409/500 hiển thông báo, không biến thành `0 bài`.
- Reload trang và xác nhận config đã lưu.

**Verify:** screenshot + network status + kết quả persisted.

**AC:** journey hoàn tất bằng chuột và bàn phím ở hai viewport; lỗi backend hiển đúng.

### KT-06 — Forward thật có kiểm soát

**Phụ thuộc:** KT-04, KT-05; user duyệt nhóm nguồn, nhóm đích test và 1 bài cụ thể.

**Thực hiện:**

- Giữ mode `manual`; scan, chọn đúng 1 bài, xem preview rồi forward.
- Đối chiếu nhóm đích, text sau clean, số ảnh, thứ tự và timestamp.
- Thử nhấn lại cùng bài để xác nhận chống trùng; không thử hàng loạt.

**Verify:** quan sát nhóm Zalo test + log enqueue/send/deduplicate.

**AC:** đúng 1 bài, đúng 1 nhóm, text/ảnh đúng; lần hai không tạo bản sao.

### KT-07 — Resilience, security và hiệu năng

**Phụ thuộc:** KT-03.

**Thực hiện:**

- Phiên hết hạn, Zalo timeout/DNS, Community 404/500, store không tồn tại/hỏng 1 dòng.
- Request body quá lớn, groupId/keyword/ngày sai; kiểm tra không lộ stack/credential.
- Quét 500 và 1500 tin; ghi thời gian, memory và cảnh báo chạm giới hạn.
- Kiểm tra dependency audit và secret scan trên diff.

**Verify:** kịch bản fault injection có phục hồi; `npm audit`; secret scan; metric thời gian/memory.

**AC:** không crash process, không mất session/store, không lộ secret; giới hạn 1500 được cảnh báo.

### KT-08 — Review, evidence và ship

**Phụ thuộc:** KT-01…KT-07.

**Thực hiện:**

- Chạy lại test/build/type-check một lần sau thay đổi cuối.
- Review correctness, regression, security, maintainability, test quality và scope.
- Ghi evidence pass/fail, residual risks và rollback về commit trước.
- Chỉ commit/push khi user duyệt và không còn finding blocking.

**Verify:** clean diff, commit SHA, remote SHA và checklist ký duyệt.

**AC:** trạng thái `REVIEWED`; `DONE` chỉ sau quyết định ship của user.

## 3. Rủi ro và khoảng trống hiện tại

- Zalo dùng API không chính thức; live test có thể thay đổi theo phiên/account/endpoint.
- Repo chưa có test script frontend, E2E runner, lint script và security-audit script khả dụng ở root; cần tạo task riêng nếu muốn tự động hóa hoàn toàn.
- Test hiện in một số error log mong đợi của mock forwarder; PASS nhưng evidence dễ gây nhầm lẫn.
- Store chỉ có dữ liệu sau khi bot đã treo và nhận tin; chọn sai khoảng ngày thì `0 bài` là kết quả đúng.

## 4. Ngoài phạm vi

- Load test phát sinh tin hàng loạt trên Zalo thật.
- Forward tới nhóm production hoặc bật auto khi chưa có smoke test manual.
- Thay framework, database, zca-js hoặc schema cấu hình.
- Xóa/rotate dữ liệu local thật để thử recovery.

## 5. Quyết định cần user duyệt

1. Duyệt phạm vi KT-01 → KT-08.
2. Cung cấp/chọn 1 Community có tin gần đây cho KT-04.
3. Xác nhận 1 nhóm đích test và cho phép gửi đúng 1 bài ở KT-06.

