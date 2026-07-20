import { useState } from "react";
import { Copy, Pencil, X } from "lucide-react";
import type { Question } from "../types";

type BankOption = { id: string; name: string; subject: string };
type BulkUpdate = {
  bankId?: string;
  difficulty?: Question["difficulty"];
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
  const [difficulty, setDifficulty] = useState<"keep" | Question["difficulty"]>("keep");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const usedCount = questions.filter((question) => question.used > 0).length;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const saved = mode === "copy"
      ? await copyQuestions(bankId)
      : await updateQuestions({
          bankId: bankId || undefined,
          difficulty: difficulty === "keep" ? undefined : difficulty,
          weight: weight ? Number(weight) : undefined,
        });
    if (!saved) setSaving(false);
  };

  const hasEdit = Boolean(bankId || difficulty !== "keep" || weight);
  const invalidWeight = Boolean(weight) && (!Number.isFinite(Number(weight)) || Number(weight) <= 0);

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
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
                <div className="form-grid">
                  <label className="form-field"><span>Kesulitan</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}><option value="keep">Tidak diubah</option><option>Mudah</option><option>Sedang</option><option>Sulit</option></select></label>
                  <label className="form-field"><span>Bobot</span><input type="number" min="0.01" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Tidak diubah" /></label>
                </div>
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
