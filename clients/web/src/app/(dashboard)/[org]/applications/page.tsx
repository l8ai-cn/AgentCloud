import { redirect } from "next/navigation";

export default async function ApplicationsRoute({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  redirect(`/${org}/experts`);
}
