import { redirect } from "next/navigation";

// Local password signup is closed. Identity is provisioned through AMP/SSO.
export default function RegisterPage() {
  redirect("/login");
}
