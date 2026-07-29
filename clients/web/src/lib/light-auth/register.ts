// Local password signup is closed. Identity is provisioned through AMP/SSO.
// Kept as an export so any residual caller fails loudly instead of hitting
// a dead Connect procedure with an opaque transport error.

import { ApiError } from "@/lib/api/api-types";
import type { AuthLoginResponse } from "./persist";

export interface LightRegisterInput {
  email: string;
  username: string;
  password: string;
  name: string;
}

export async function lightRegister(
  _input: LightRegisterInput,
): Promise<AuthLoginResponse> {
  throw new ApiError(403, "local registration is disabled", {
    code: "REGISTRATION_DISABLED",
    error: "local registration is disabled",
  });
}
