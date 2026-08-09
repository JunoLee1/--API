import { describe, test, expect } from "@jest/globals";
import { maskEmail, maskUsername } from "../../src/lib/maskPii";

describe("maskEmail", () => {
  test("local part가 4자 이상이면 앞 2자만 남기고 ***@domain", () => {
    expect(maskEmail("hong@kfa.kr")).toBe("ho***@kfa.kr");
  });

  test("local part가 3자면 앞 1자만 남기고 ***@domain", () => {
    expect(maskEmail("abc@test.com")).toBe("a***@test.com");
  });

  test("local part가 2자 이하면 전체 ***@domain", () => {
    expect(maskEmail("ab@test.com")).toBe("***@test.com");
    expect(maskEmail("a@test.com")).toBe("***@test.com");
  });

  test("@ 없는 비정상 입력은 ***로 처리", () => {
    expect(maskEmail("notanemail")).toBe("***");
  });
});

describe("maskUsername", () => {
  test("4자 이상이면 앞 3자 + ***", () => {
    expect(maskUsername("hong_gildong")).toBe("hon***");
    expect(maskUsername("juno")).toBe("jun***");
  });

  test("3자 이하면 전체 ***", () => {
    expect(maskUsername("ab")).toBe("***");
    expect(maskUsername("a")).toBe("***");
    expect(maskUsername("abc")).toBe("***");
  });
});
