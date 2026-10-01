import { describe, expect, it } from "vitest";
import { moderateText } from "./moderation";

describe("moderação do chat", () => {
  it("mascara palavrões com e sem acento, sem mexer no resto", () => {
    expect(moderateText("Que MERDA, seu idiota!")).toBe("Que *****, seu ******!");
    expect(moderateText("Desgraça")).toBe("********");
    expect(moderateText("Tenho Davi repetido, troca?")).toBe("Tenho Davi repetido, troca?");
  });
});
