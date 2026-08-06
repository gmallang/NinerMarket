import { useNavigate } from "react-router-dom";
import { AccountSetup } from "@/features/setup/AccountSetup";
import { useMarketStore } from "@/lib/store";
import s from "@/features/setup/setup.module.css";

export function SetupPage() {
  const navigate = useNavigate();
  const user = useMarketStore((s) => s.user);
  const updateProfile = useMarketStore((s) => s.updateProfile);

  const handleSave = (year: string, payments: string[]) => {
    updateProfile(year, payments);
    navigate("/", { replace: true });
  };

  return (
    <div className={s.setupPage}>
      <AccountSetup
        name={user?.display_name ?? ""}
        onSave={handleSave}
        onSkip={() => navigate("/", { replace: true })}
      />
    </div>
  );
}
