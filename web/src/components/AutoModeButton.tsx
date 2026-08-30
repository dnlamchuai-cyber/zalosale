// Ai viết: Codex — UI review slice
// Tại sao: cô lập thao tác AUTO có rủi ro gửi tin để test và xác nhận rõ ràng
// Link: docs/05_TASKS/TASK-004_KIEM-THU-TOAN-DIEN.md

interface AutoModeButtonProps {
  mode: "auto" | "manual";
  hasDestinations: boolean;
  onChange: (mode: "auto" | "manual") => Promise<void> | void;
}

const AUTO_CONFIRMATION = "Bật chế độ AUTO? Bot sẽ tự chuyển tiếp tin mới tới các nhóm đích đã cấu hình.";

export function AutoModeButton({ mode, hasDestinations, onChange }: AutoModeButtonProps) {
  const isAuto = mode === "auto";
  const cannotEnable = !isAuto && !hasDestinations;
  const title = cannotEnable
    ? "Cần cấu hình ít nhất một nhóm đích trước khi bật AUTO."
    : "Bật = bot tự chuyển tiếp tin mới. Tắt = chỉ gửi tin bạn tự chọn.";

  function handleClick() {
    if (isAuto) return onChange("manual");
    if (!hasDestinations || !window.confirm(AUTO_CONFIRMATION)) return;
    return onChange("auto");
  }

  return (
    <button
      className={isAuto ? "primary" : ""}
      style={{ minWidth: 150 }}
      onClick={handleClick}
      disabled={cannotEnable}
      title={title}
    >
      {isAuto ? "⏺ Treo máy: AUTO" : cannotEnable ? "⚠ AUTO: cần nhóm đích" : "▶ Tự động: tắt (manual)"}
    </button>
  );
}
