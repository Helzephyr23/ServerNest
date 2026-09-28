import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const API_HOST = process.env.API_HOST || "127.0.0.1";
const API_PORT = process.env.API_PORT || "3001";

export default async function Home() {
  let firstRun = false;
  try {
    const res = await fetch(`http://${API_HOST}:${API_PORT}/api/auth/status`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      firstRun = !!data.firstRun;
    }
  } catch {
    // Fallback to setup if status cannot be determined
    firstRun = true;
  }

  if (firstRun) {
    redirect("/setup");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("servernest_token")?.value;
  if (token) {
    redirect("/dashboard");
  }

  redirect("/login");
}
