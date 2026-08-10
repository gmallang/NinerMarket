import { useState } from "react";
import { CheckCircle2, Flag, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import shared from "@/components/shared/shared.module.css";
import s from "./report.module.css";

const REPORT_REASONS = [
  "Prohibited item",
  "Scam or fraud",
  "Misleading description",
  "Inappropriate content",
  "Item already sold or unavailable",
  "Other",
];

export function ReportModal({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  error,
  done,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string, details: string) => void;
  submitting: boolean;
  error: string | null;
  done: boolean;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");

  return (
    <Modal open={open} onOpenChange={onOpenChange} ariaLabel="Report listing" foreground>
      {done ? (
        <div className={s.reportDone}>
          <CheckCircle2 size={32} className={s.reportDoneIcon} />
          <h2 className={s.reportTitle}>Report submitted</h2>
          <p className={s.reportDoneText}>
            Thanks for letting us know. The listing is now under review.
          </p>
          <button
            className={`${shared.btnPrimary} ${s.reportSubmit}`}
            onClick={() => onOpenChange(false)}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <div className={s.reportHead}>
            <div>
              <h2 className={s.reportTitle}>Report listing</h2>
              <p className={s.reportSub}>Why are you reporting this listing?</p>
            </div>
            <button className={shared.modalClose} onClick={() => onOpenChange(false)} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className={s.reportReasons}>
            {REPORT_REASONS.map((r) => (
              <label key={r} className={s.reportOption}>
                <input
                  type="radio"
                  name="report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                <span>{r}</span>
              </label>
            ))}
          </div>

          <textarea
            className={s.reportDetails}
            placeholder="Add details (optional)"
            value={details}
            maxLength={500}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
          />

          {error && <p className={shared.formError}>{error}</p>}

          <div className={s.reportActions}>
            <button
              className={shared.btnGhost}
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className={`${shared.btnPrimary} ${s.reportSubmit}`}
              onClick={() => onSubmit(reason, details.trim())}
              disabled={submitting}
            >
              <Flag size={15} />
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
