import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/api-types";
import { lightRegister } from "./register";

describe("lightRegister", () => {
  it("rejects because local registration is disabled", async () => {
    await expect(
      lightRegister({
        email: "new@example.com",
        username: "newuser",
        password: "password123",
        name: "New User",
      }),
    ).rejects.toBeInstanceOf(ApiError);

    try {
      await lightRegister({
        email: "new@example.com",
        username: "newuser",
        password: "password123",
        name: "New User",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("REGISTRATION_DISABLED");
    }
  });
});
