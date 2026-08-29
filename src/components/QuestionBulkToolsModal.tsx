import { useState } from "react";
import { Copy, Pencil, X } from "lucide-react";
import type { Question } from "../types";
import { useAccessibleDialog } from "../lib/use-accessible-dialog";

type BankOption = { id: string; name: string; subject: string };
type BulkUpdate = {
  bankId?: string;
  weight?: number;
};

export function QuestionBulkToolsModal({
  questions,
  banks,
  close,
  copyQuestions,
  updateQuestions,
}: {
  questions: Question[];
  banks: BankOption[];
  close: () => void;
  copyQuestions: (bankId: string) => Promise<boolean>;
  updateQuestions: (update: BulkUpdate) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"copy" | "edit">("copy");
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const usedCount = questions.filter((question) => question.used > 0).length;
  const onlyEssays = questions.every((question) => question.type === "Essay");

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const saved = mode === "copy"
      ? await copyQuestions(bankId)
      : await updateQuestions({
          bankId: bankId || undefined,
          weight: onlyEssays && weight ? Number(weight) : undefined,
        });
    if (!saved) setSaving(false);
  };

  const hasEdit = Boolean(bankId || (onlyEssays && weight));
  const invalidWeight = onlyEssays && Boolean(weight) && (!Number.isFinite(Number(weight)) || Number(weight) <= 0);
  const dialogRef = useAccessibleDialog(close, saving);

  return (
    <div className="modal-overlay">
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="simple-modal bulk-question-modal">
          <header>
            <div><p>AKSI MASSAL</p><h2>Kelola {questions.length} soal</h2></div>
            <button type="button" onClick={close} aria-label="Tutup aksi massal"><X /></button>
          </header>
          <div className="modal-content">
            <div className="bulk-mode-tabs">
              <button type="button" className={mode === "copy" ? "active" : ""} onClick={() => { setMode("copy"); setBankId(banks[0]?.id ?? ""); }}><Copy /> Salin ke bank</button>
              <button type="button" className={mode === "edit" ? "active" : ""} onClick={() => { setMode("edit"); setBankId(""); }}><Pencil /> Edit massal</button>
            </div>
            {mode === "copy" ? (
              <label className="form-field">
                <span>Bank tujuan</span>
                <select value={bankId} onChange={(event) => setBankId(event.target.value)}>
                  {banks.map((bank) => <option value={bank.id} key={bank.id}>{bank.name} — {bank.subject}</option>)}
                </select>
                <small>Soal asli tetap berada di bank sebelumnya.</small>
              </label>
            ) : (
              <>
                {usedCount > 0 && <p className="bulk-warning">{usedCount} soal sudah dipakai pada ujian. Server akan menolak perubahan soal yang sudah terjadwal atau dikerjakan.</p>}
                <label className="form-field"><span>Pindahkan ke bank</span><select value={bankId} onChange={(event) => setBankId(event.target.value)}><option value="">Tidak diubah</option>{banks.map((bank) => <option value={bank.id} key={bank.id}>{bank.name} — {bank.subject}</option>)}</select></label>
                {onlyEssays ? (
                  <label className="form-field"><span>Bobot essay</span><input type="number" min="0.01" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Tidak diubah" /></label>
                ) : (
                  <p className="bulk-warning">Bobot hanya dapat diubah jika semua soal yang dipilih berupa essay.</p>
                )}
              </>
            )}
          </div>
          <footer>
            <button type="button" onClick={close}>Batal</button>
            <button type="button" className="primary" disabled={saving || (mode === "copy" ? !bankId : !hasEdit || invalidWeight)} onClick={() => void submit()}>{saving ? "Memproses…" : mode === "copy" ? "Salin soal" : "Simpan perubahan"}</button>
          </footer>
        </div>
      </div>
    </div>
  );
}
