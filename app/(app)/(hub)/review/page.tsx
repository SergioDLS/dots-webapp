"use client";

import { useEffect, useState } from "react";

import Doty from "@/components/ui/doty/doty";
import ReviewQuiz from "@/components/review/review-quiz";
import {
  getReviewSessionService,
  type ReviewQuestion,
} from "@/services/review.service";

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewQuestion[] | null>(null);

  useEffect(() => {
    let mounted = true;
    getReviewSessionService()
      .then((s) => mounted && setItems(s.items))
      .catch(() => mounted && setItems([]));
    return () => {
      mounted = false;
    };
  }, []);

  if (items === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--border) border-t-(--accent)" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Doty pose="17" size="small" animation="cheer" say="¡Todo al día!" />
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Nada que repasar hoy
        </h1>
        <p className="max-w-sm text-sm font-semibold text-(--muted)">
          Vuelve después de fallar algunas preguntas — te las traigo de vuelta
          en el momento justo para que no se te olviden.
        </p>
      </div>
    );
  }

  return <ReviewQuiz items={items} />;
}
