import { describe, expect, it } from "vitest";
import { sendNowConfirmMessage } from "./audience";

describe("sendNowConfirmMessage", () => {
  it("내부 대상이면 내부 수신자 수를 알려준다", () => {
    expect(sendNowConfirmMessage("internal", 2)).toBe("지금 내부 수신자 2명에게 발송합니다. 계속할까요?");
  });

  it("구독자 대상이면 구독자 전원 발송임을 분명히 알린다", () => {
    expect(sendNowConfirmMessage("subscribers", 0)).toBe("지금 구독자 전원에게 실제 발송합니다. 되돌릴 수 없습니다. 계속할까요?");
  });

  it("알 수 없는 값은 안전하게 구독자 전원 문구로 처리한다", () => {
    expect(sendNowConfirmMessage("unknown", 3)).toContain("구독자 전원");
  });
});
