"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
import WelcomeScreen from "@/components/onboarding/welcome-screen";
import PlacementTest from "@/components/onboarding/placement-test";
import PlacementResultScreen from "@/components/onboarding/placement-result";
import { useAuth } from "@/context/auth-context";
import {
  getPlacementStatusService,
  skipPlacementService,
  startPlacementService,
  type PlacementResult,
  type PlacementStart,
} from "@/services/placement.service";

export default function OnboardingPage() {
  const router = useRouter();
  const { isBootstrapping } = useAuth();

  const [checked, setChecked] = useState(false);
  const [test, setTest] = useState<PlacementStart | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Users who are already placed (or have history) never see onboarding.
  useEffect(() => {
    if (isBootstrapping) return;
    getPlacementStatusService()
      .then((status) => {
        if (!status.canTake && status.status !== "active") {
          router.replace("/levels");
        } else {
          setChecked(true);
        }
      })
      // fail-open: on any error, never trap the user here
      .catch(() => router.replace("/levels"));
  }, [isBootstrapping, router]);

  const skip = () => {
    setBusy(true);
    skipPlacementService()
      .then(() => router.replace("/levels"))
      .catch(() => router.replace("/levels"));
  };

  const startTest = () => {
    setBusy(true);
    startPlacementService()
      .then(setTest)
      .catch(() => router.replace("/levels"))
      .finally(() => setBusy(false));
  };

  if (isBootstrapping || !checked) {
    return (
      <main className="flex justify-center py-24">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex flex-col gap-4 p-4">
      {result ? (
        <PlacementResultScreen
          result={result}
          onContinue={() => router.replace("/levels")}
        />
      ) : test ? (
        <PlacementTest test={test} onFinished={setResult} />
      ) : (
        <WelcomeScreen onSkip={skip} onStartTest={startTest} busy={busy} />
      )}
    </main>
  );
}
