"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-border px-3 py-2 text-sm text-fg-muted transition hover:border-danger hover:text-danger"
    >
      Đăng xuất
    </button>
  );
}
