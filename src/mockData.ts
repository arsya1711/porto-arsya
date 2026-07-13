export type Role = 'admin' | 'guru' | 'siswa'
export type ExamStatus = 'draft' | 'terjadwal' | 'berlangsung' | 'selesai'

export type Exam = {
  id: string; title: string; subject: string; className: string; date: string;
  time: string; duration: number; questions: number; status: ExamStatus; participants: number
}

export type Question = {
  id: string; bank: string; subject: string; type: 'Pilihan Ganda' | 'Essay';
  text: string; difficulty: 'Mudah' | 'Sedang' | 'Sulit'; used: number;
  bankId?: string; subjectId?: string; options?: string[]; correctOption?: number | null;
  answerKey?: string | null; weight?: number; createdAt?: string
}

export const exams: Exam[] = [
  { id:'1', title:'Penilaian Akhir Semester', subject:'Matematika', className:'IX A', date:'10 Jul 2026', time:'09.00', duration:90, questions:40, status:'berlangsung', participants:32 },
  { id:'2', title:'Ulangan Bab Ekosistem', subject:'IPA', className:'VIII B', date:'10 Jul 2026', time:'11.00', duration:60, questions:25, status:'terjadwal', participants:30 },
  { id:'3', title:'Asesmen Teks Eksplanasi', subject:'Bahasa Indonesia', className:'IX B', date:'11 Jul 2026', time:'08.00', duration:75, questions:30, status:'terjadwal', participants:31 },
  { id:'4', title:'Kuis Sejarah Indonesia', subject:'IPS', className:'VIII A', date:'8 Jul 2026', time:'10.00', duration:45, questions:20, status:'selesai', participants:29 },
]

export const questions: Question[] = [
  { id:'Q-1042', bank:'Aljabar Kelas IX', subject:'Matematika', type:'Pilihan Ganda', text:'Jika 2x + 5 = 17, maka nilai x adalah …', difficulty:'Mudah', used:4 },
  { id:'Q-1041', bank:'Aljabar Kelas IX', subject:'Matematika', type:'Essay', text:'Jelaskan langkah penyelesaian sistem persamaan linear dua variabel.', difficulty:'Sedang', used:2 },
  { id:'Q-982', bank:'Ekosistem', subject:'IPA', type:'Pilihan Ganda', text:'Organisme yang berperan sebagai produsen dalam ekosistem adalah …', difficulty:'Mudah', used:6 },
  { id:'Q-911', bank:'Teks Eksplanasi', subject:'Bahasa Indonesia', type:'Pilihan Ganda', text:'Struktur teks eksplanasi yang tepat adalah …', difficulty:'Sedang', used:3 },
  { id:'Q-887', bank:'Sejarah Kemerdekaan', subject:'IPS', type:'Essay', text:'Uraikan faktor pendorong terjadinya Proklamasi Kemerdekaan.', difficulty:'Sulit', used:1 },
]

export const students = [
  ['24001','Alya Putri','IX A','Aktif'],['24002','Bima Saputra','IX A','Aktif'],['24003','Citra Lestari','IX A','Aktif'],
  ['24004','Daffa Ramadhan','IX B','Aktif'],['24005','Fajar Maulana','VIII A','Aktif'],['24006','Gita Ananda','VIII B','Nonaktif'],
]

export const examQuestions = [
  { id:'1', text:'Hasil dari 3(2x − 4) + 5 jika x = 3 adalah …', options:['5','7','9','11'], answer:2 },
  { id:'2', text:'Bentuk sederhana dari 4a + 3b − 2a + 5b adalah …', options:['2a + 2b','2a + 8b','6a + 2b','6a + 8b'], answer:1 },
  { id:'3', text:'Jika keliling persegi adalah 48 cm, luas persegi tersebut adalah …', options:['64 cm²','100 cm²','121 cm²','144 cm²'], answer:3 },
  { id:'4', text:'Nilai dari √144 + √81 adalah …', options:['19','20','21','22'], answer:2 },
  { id:'5', text:'Sebuah kelas memiliki 18 siswa laki-laki dan 12 siswa perempuan. Rasio siswa perempuan terhadap seluruh siswa adalah …', options:['2 : 3','2 : 5','3 : 5','3 : 2'], answer:1 },
]
