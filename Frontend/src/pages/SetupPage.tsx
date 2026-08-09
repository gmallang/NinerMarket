import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccountSetup } from "@/features/setup/AccountSetup";
import { useMarketStore } from "@/lib/store";
import s from "@/features/setup/setup.module.css";

export function SetupPage() {
  const navigate = useNavigate();
  const user = useMarketStore((s) => s.user);
  const updateProfile = useMarketStore((s) => s.updateProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (year: string, payments: string[]) => {
    setSaving(true);
    setError("");
    try {
      await updateProfile(year, payments);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your profile. Please try again."
      );
      setSaving(false);
    }
  };

  return (
    <div className={s.setupPage}>
      <AccountSetup
        name={user?.display_name ?? ""}
        onSave={handleSave}
        onSkip={() => navigate("/", { replace: true })}
        saving={saving}
        error={error}
      />
    </div>
  );
}
