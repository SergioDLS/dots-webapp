"use client";

import React from "react";
import Link from "next/link";
import Doty from "@/components/ui/doty/doty";

const cards = [
  {
    title: "Levels & Sentences",
    desc: "Enable levels, edit sentences, add new practice content.",
    href: "/admin/levels",
    pose: "07",
    accent: "var(--accent)",
    edge: "var(--accent-edge)",
  },
  {
    title: "Words",
    desc: "Review the vocabulary attached to each level.",
    href: "/admin/levels",
    pose: "12",
    accent: "var(--purple)",
    edge: "var(--purple-edge)",
  },
];

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-8">
      <div className="pop-in flex items-center gap-4">
        <Doty pose="02" size="tiny" animation="wave" />
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
            Content dashboard
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            Manage everything learners practice with.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="group relative overflow-hidden rounded-3xl border-2 border-(--border) bg-(--surface) p-6 transition-transform duration-200 hover:-translate-y-1"
            style={{ boxShadow: "0 4px 0 var(--border)" }}
          >
            <span
              aria-hidden
              className="absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-10"
              style={{ background: c.accent }}
            />
            <div className="flex flex-col gap-3">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                style={{ background: c.accent, boxShadow: `0 4px 0 ${c.edge}` }}
              >
                <Doty pose={c.pose} size="micro" />
              </span>
              <h2 className="font-display text-xl font-extrabold text-foreground">
                {c.title}
              </h2>
              <p className="text-sm font-semibold text-(--muted)">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
