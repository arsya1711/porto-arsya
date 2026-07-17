export type Role = "admin" | "guru" | "siswa";
export type ExamStatus = "draft" | "terjadwal" | "berlangsung" | "selesai";

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

