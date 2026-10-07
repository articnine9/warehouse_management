import { redirect } from "next/navigation";

export default function EmployeesPageRedirect() {
  redirect("/users");
}
