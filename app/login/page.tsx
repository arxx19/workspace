import Link from "next/link";
import { login } from "@/app/auth-actions";

const input =
  "rounded border border-gray-500 bg-white p-2 text-black placeholder-gray-500";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      {error && (
        <p className="mb-4 rounded border border-red-500 p-2 text-red-400">
          {error}
        </p>
      )}
      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className={input}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className={input}
        />
        <button className="rounded bg-blue-600 p-2 text-white">Log in</button>
      </form>
      <p className="mt-4 text-sm text-gray-400">
        No account yet?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
