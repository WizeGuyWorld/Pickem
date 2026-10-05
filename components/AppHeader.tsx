"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Participant = {
  name: string;
  is_admin: boolean;
};

export default function AppHeader() {
  const router = useRouter();
  const [participant, setParticipant] = useState<Participant | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setParticipant(null);
      return;
    }

    const { data } = await supabase
      .from("participants")
      .select("name, is_admin")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    setParticipant((data as Participant) ?? null);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mb-5 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Signed in as
        </p>

        <p className="font-bold">
          {participant?.name ?? "Participant"}
        </p>

        {participant?.is_admin && (
          <p className="text-xs font-semibold text-emerald-400">
            Commissioner
          </p>
        )}
      </div>

      <button
        onClick={logout}
        className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-700"
      >
        Log Out
      </button>
    </div>
  );
}