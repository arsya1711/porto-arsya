export type Role = "admin" | "guru" | "siswa";
export type ExamStatus = "draft" | "terjadwal" | "berlangsung" | "selesai";

export type StudentExamCatalogRow = {
  exam_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number;
  status: ExamStatus;
  requires_access_code: boolean;
  fullscreen_mode: boolean;
  record_tab_switches: boolean;
  subject_name: string | null;
  subject_code: string | null;
  class_name: string | null;
  teacher_name: string | null;
  question_count: number;
};

export type Exam = {
  id: string;
  title: string;
  subject: string;
  className: string;
  date: string;
  time: string;
  duration: number;
  questions: number;
  status: ExamStatus;
  participants: number;
};

export type Question = {
  id: string;
  bank: string;
  subject: string;
  type: "Pilihan Ganda" | "Essay";
  text: string;
  difficulty: "Mudah" | "Sedang" | "Sulit";
  used: number;
  bankId?: string;
  subjectId?: string;
  options?: string[];
  correctOption?: number | null;
  answerKey?: string | null;
  weight?: number;
  createdAt?: string;
};
