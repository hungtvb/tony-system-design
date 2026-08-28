"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (res?.error) {
          setError("Email hoặc mật khẩu không đúng.");
          setLoading(false);
          return;
        }
        router.push("/");
        router.refresh();
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Đăng ký thất bại.");
          setLoading(false);
          return;
        }
        // auto-login after register
        const loginRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (loginRes?.error) {
          setError("Đăng ký OK nhưng đăng nhập thất bại, hãy thử login.");
          setLoading(false);
          return;
        }
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Có lỗi xảy ra, thử lại.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">
          Tony <span className="text-accent">System Design</span>
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {mode === "login" ? "Đăng nhập để tiếp tục" : "Tạo tài khoản mới"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-bg-panel p-6"
      >
        {mode === "register" && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-fg-muted">Tên hiển thị</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent-dim"
              placeholder="Tony"
            />
          </label>
        )}
        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-fg-muted">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent-dim"
            placeholder="you@example.com"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-fg-muted">Mật khẩu</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent-dim"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-fg-muted">
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            <button
              onClick={() => setMode("register")}
              className="text-accent hover:underline"
            >
              Đăng ký
            </button>
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            <button
              onClick={() => setMode("login")}
              className="text-accent hover:underline"
            >
              Đăng nhập
            </button>
          </>
        )}
      </p>
    </main>
  );
}
