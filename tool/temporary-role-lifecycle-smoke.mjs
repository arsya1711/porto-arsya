import assert from "node:assert/strict";

assert.equal(
  process.env.ALLOW_TEMP_PRODUCTION_DATA,
  "true",
  "Set ALLOW_TEMP_PRODUCTION_DATA=true untuk mengizinkan akun uji sementara.",
);

const baseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appOrigin = process.env.APP_ORIGIN ?? "https://porto-arsya.pages.dev";
assert.ok(baseUrl && anonKey && serviceRoleKey, "Konfigurasi smoke test belum lengkap.");

const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const password = `Smoke-${crypto.randomUUID()}-Aa1!`;
const createdUserIds = [];
const academicIds = {
  classId: null,
  subjectId: null,
  bankId: null,
  questionIds: [],
  examId: null,
  attemptId: null,
};

const adminHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};
const publicHeaders = {
  apikey: anonKey,
  "Content-Type": "application/json",
};

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = text; }
  }
  return { response, body };
}

async function createUser(role, label) {
  const email = `awexam-smoke-${label}-${runId}@example.invalid`;
  const result = await request("/auth/v1/admin/users", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `AWExam Smoke ${label}`, role },
    }),
  });
  assert.equal(result.response.status, 200, `Create ${label}: ${JSON.stringify(result.body)}`);
  assert.ok(result.body?.id, `ID ${label} tidak tersedia`);
  createdUserIds.push(result.body.id);
  const profileResult = await request(`/rest/v1/profiles?id=eq.${result.body.id}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      full_name: `AWExam Smoke ${label}`,
      email,
      role,
      active: true,
    }),
  });
  assert.equal(profileResult.response.status, 204, `Setup profil ${label} gagal`);
  return { id: result.body.id, email };
}

async function deleteUser(userId) {
  // Admin smoke dapat menjadi actor audit saat menguji admin-users. Hapus hanya
  // audit yang dibuat actor sementara ini agar FK audit tidak menghalangi
  // cleanup akun uji; audit sekolah lain tidak disentuh.
  const auditCleanup = await request(`/rest/v1/audit_logs?actor_id=eq.${userId}`, {
    method: "DELETE",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
  });
  assert.ok([200, 204].includes(auditCleanup.response.status));
  const result = await request(`/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  assert.ok([200, 404].includes(result.response.status), `Cleanup ${userId} gagal`);
}

async function passwordLogin(email, loginPassword) {
  const result = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: publicHeaders,
    body: JSON.stringify({ email, password: loginPassword }),
  });
  assert.equal(result.response.status, 200, `Login ${email} gagal`);
  assert.ok(result.body?.access_token, `Token ${email} tidak tersedia`);
  return result.body.access_token;
}

async function verifyOwnProfile(accessToken, expectedRole) {
  const payload = JSON.parse(
    Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"),
  );
  const result = await request(
    `/rest/v1/profiles?select=id,role,active&id=eq.${payload.sub}`,
    { headers: { ...publicHeaders, Authorization: `Bearer ${accessToken}` } },
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.body?.length, 1);
  assert.equal(result.body[0].role, expectedRole);
  assert.equal(result.body[0].active, true);
}

async function callAdminUsers(token, body, expectedStatus) {
  const result = await request("/functions/v1/admin-users", {
    method: "POST",
    headers: {
      ...publicHeaders,
      Authorization: `Bearer ${token}`,
      Origin: appOrigin,
    },
    body: JSON.stringify(body),
  });
  assert.equal(
    result.response.status,
    expectedStatus,
    `admin-users HTTP ${result.response.status}: ${JSON.stringify(result.body)}`,
  );
  return result.body;
}

async function insertRow(table, body, headers = adminHeaders) {
  const result = await request(`/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  assert.equal(
    result.response.status,
    201,
    `Insert ${table} gagal: ${JSON.stringify(result.body)}`,
  );
  assert.equal(result.body?.length, 1, `Insert ${table} tidak mengembalikan row`);
  return result.body[0];
}

async function callRpc(name, token, body, expectedStatus = 200) {
  const result = await request(`/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      ...publicHeaders,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  assert.equal(
    result.response.status,
    expectedStatus,
    `${name} HTTP ${result.response.status}: ${JSON.stringify(result.body)}`,
  );
  return result.body;
}

async function deleteRows(table, column, value) {
  if (!value) return;
  const result = await request(`/rest/v1/${table}?${column}=eq.${value}`, {
    method: "DELETE",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
  });
  assert.ok([200, 204].includes(result.response.status), `Cleanup ${table} gagal`);
}

try {
  const activeAdmins = await request(
    "/rest/v1/profiles?select=id&role=eq.admin&active=eq.true",
    { headers: adminHeaders },
  );
  assert.equal(activeAdmins.response.status, 200);
  assert.ok(activeAdmins.body.length >= 1, "Admin sekolah aktif tidak ditemukan; test dibatalkan.");

  const temporaryAdmin = await createUser("admin", "admin");
  const temporaryTeacher = await createUser("guru", "guru");
  const temporaryStudent = await createUser("siswa", "siswa");
  const studentNumber = `SMK${Date.now()}`;
  const studentProfile = await request(`/rest/v1/profiles?id=eq.${temporaryStudent.id}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ student_number: studentNumber, active: true }),
  });
  assert.equal(studentProfile.response.status, 204);

  const adminToken = await passwordLogin(temporaryAdmin.email, password);
  const teacherToken = await passwordLogin(temporaryTeacher.email, password);
  await verifyOwnProfile(adminToken, "admin");
  await verifyOwnProfile(teacherToken, "guru");

  const studentLogin = await request("/functions/v1/student-login", {
    method: "POST",
    headers: {
      ...publicHeaders,
      Authorization: `Bearer ${anonKey}`,
      Origin: appOrigin,
    },
    body: JSON.stringify({ student_number: studentNumber, password }),
  });
  assert.equal(
    studentLogin.response.status,
    200,
    `Login siswa gagal: ${JSON.stringify(studentLogin.body)}`,
  );
  const studentToken = studentLogin.body?.session?.access_token;
  assert.ok(studentToken, "Token siswa tidak tersedia");
  await verifyOwnProfile(studentToken, "siswa");
  console.log("✓ Login admin, guru, dan siswa production");

  const studentAttempts = await request("/rest/v1/attempts?select=id&limit=1", {
    headers: { ...publicHeaders, Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentAttempts.response.status, 200);
  assert.deepEqual(studentAttempts.body, []);
  console.log("✓ RLS siswa hanya mengembalikan attempt miliknya");

  const activeYear = await request(
    "/rest/v1/academic_years?select=id&active=eq.true&limit=1",
    { headers: adminHeaders },
  );
  assert.equal(activeYear.response.status, 200);
  assert.equal(activeYear.body?.length, 1, "Tahun ajaran aktif tidak tersedia");
  const subject = await insertRow("subjects", {
    name: `AWExam Smoke Subject ${runId}`,
    code: `SM${String(Date.now()).slice(-8)}`,
  });
  academicIds.subjectId = subject.id;
  const schoolClass = await insertRow("classes", {
    name: `AWExam Smoke Class ${runId}`,
    academic_year_id: activeYear.body[0].id,
    homeroom_teacher_id: temporaryTeacher.id,
  });
  academicIds.classId = schoolClass.id;
  await insertRow("teacher_subjects", {
    teacher_id: temporaryTeacher.id,
    subject_id: subject.id,
    class_id: schoolClass.id,
  });
  await insertRow("class_students", {
    class_id: schoolClass.id,
    student_id: temporaryStudent.id,
  });

  const teacherHeaders = {
    ...publicHeaders,
    Authorization: `Bearer ${teacherToken}`,
  };
  const bank = await insertRow("question_banks", {
    name: `AWExam Smoke Bank ${runId}`,
    subject_id: subject.id,
    owner_id: temporaryTeacher.id,
    grade_level: "IX",
  }, teacherHeaders);
  academicIds.bankId = bank.id;
  const objectiveQuestion = await insertRow("questions", {
    bank_id: bank.id,
    body: "AWExam smoke: pilih jawaban Benar.",
    type: "multiple_choice",
    options: ["Salah", "Benar"],
    correct_option: 1,
    difficulty: "mudah",
    weight: 1,
    created_by: temporaryTeacher.id,
  }, teacherHeaders);
  const essayQuestion = await insertRow("questions", {
    bank_id: bank.id,
    body: "AWExam smoke: tulis jawaban singkat.",
    type: "essay",
    options: [],
    answer_key: null,
    difficulty: "mudah",
    weight: 1,
    created_by: temporaryTeacher.id,
  }, teacherHeaders);
  academicIds.questionIds.push(objectiveQuestion.id, essayQuestion.id);

  const futureStart = new Date(Date.now() + 5 * 60_000).toISOString();
  const examId = await callRpc("save_managed_exam", teacherToken, {
    target_exam_id: null,
    exam_title: `AWExam Smoke Exam ${runId}`,
    exam_description: "Data sementara untuk smoke test production.",
    target_subject_id: subject.id,
    target_class_id: schoolClass.id,
    start_time: futureStart,
    duration_in_minutes: 20,
    target_status: "terjadwal",
    question_ids: [objectiveQuestion.id, essayQuestion.id],
    access_code_value: "SMK123",
    should_shuffle_questions: false,
    should_shuffle_options: false,
    should_use_fullscreen: false,
    should_record_tab_switches: true,
  });
  assert.equal(typeof examId, "string");
  academicIds.examId = examId;
  const activateExam = await request(`/rest/v1/exams?id=eq.${examId}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "berlangsung",
      starts_at: new Date(Date.now() - 60_000).toISOString(),
      ends_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    }),
  });
  assert.equal(activateExam.response.status, 204);

  const catalog = await callRpc("get_student_exam_catalog", studentToken, {});
  assert.ok(catalog.some((row) => row.exam_id === examId));
  const wrongCode = await callRpc("start_exam_attempt", studentToken, {
    requested_exam_id: examId,
    provided_access_code: "SALAH",
  });
  assert.deepEqual(wrongCode, []);
  const start = await callRpc("start_exam_attempt", studentToken, {
    requested_exam_id: examId,
    provided_access_code: "SMK123",
  });
  assert.equal(start?.length, 1);
  academicIds.attemptId = start[0].attempt_id;
  const examQuestions = await callRpc("get_exam_questions", studentToken, {
    requested_exam_id: examId,
  });
  assert.equal(examQuestions.length, 2);

  const invalidOption = await request("/rest/v1/rpc/save_exam_answer", {
    method: "POST",
    headers: { ...publicHeaders, Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      target_attempt_id: academicIds.attemptId,
      target_question_id: objectiveQuestion.id,
      target_selected_option: 99,
      target_essay_text: null,
    }),
  });
  assert.equal(invalidOption.response.status, 400);
  assert.match(invalidOption.body?.message ?? "", /Pilihan jawaban tidak valid/i);
  await callRpc("save_exam_answer", studentToken, {
    target_attempt_id: academicIds.attemptId,
    target_question_id: objectiveQuestion.id,
    target_selected_option: 1,
    target_essay_text: null,
  }, 204);
  await callRpc("save_exam_answer", studentToken, {
    target_attempt_id: academicIds.attemptId,
    target_question_id: essayQuestion.id,
    target_selected_option: null,
    target_essay_text: "Jawaban smoke test",
  }, 204);
  const integrityInsert = await request("/rest/v1/integrity_events", {
    method: "POST",
    headers: {
      ...publicHeaders,
      Authorization: `Bearer ${studentToken}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      attempt_id: academicIds.attemptId,
      student_id: temporaryStudent.id,
      event_type: "app_backgrounded",
      metadata: { exam_id: examId, source: "smoke" },
    }),
  });
  assert.equal(
    integrityInsert.response.status,
    201,
    `Integrity event ditolak: ${JSON.stringify(integrityInsert.body)}`,
  );
  await callRpc("submit_exam_attempt", studentToken, {
    target_attempt_id: academicIds.attemptId,
  }, 204);

  const afterSubmitSave = await request("/rest/v1/rpc/save_exam_answer", {
    method: "POST",
    headers: { ...publicHeaders, Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      target_attempt_id: academicIds.attemptId,
      target_question_id: objectiveQuestion.id,
      target_selected_option: 0,
      target_essay_text: null,
    }),
  });
  assert.equal(afterSubmitSave.response.status, 400);
  const teacherAnswers = await request(
    `/rest/v1/answers?select=id,question_id,score&attempt_id=eq.${academicIds.attemptId}`,
    { headers: teacherHeaders },
  );
  assert.equal(teacherAnswers.response.status, 200);
  const essayAnswer = teacherAnswers.body.find(
    (answer) => answer.question_id === essayQuestion.id,
  );
  assert.ok(essayAnswer?.id);
  await callRpc("grade_essay_answer", teacherToken, {
    target_answer_id: essayAnswer.id,
    awarded_score: 1,
    feedback: "Lulus smoke test",
  }, 204);
  const finalAttempt = await request(
    `/rest/v1/attempts?select=status,final_score&id=eq.${academicIds.attemptId}`,
    { headers: teacherHeaders },
  );
  assert.equal(finalAttempt.response.status, 200);
  assert.equal(finalAttempt.body?.[0]?.status, "final");
  assert.equal(Number(finalAttempt.body?.[0]?.final_score), 100);
  console.log("✓ Siklus ujian production: katalog, kode, jawaban, submit, integritas, nilai final");

  const forbiddenCreate = {
    action: "create",
    full_name: "Tidak Boleh Dibuat",
    email: `forbidden-${runId}@example.invalid`,
    password,
    role: "guru",
  };
  await callAdminUsers(teacherToken, forbiddenCreate, 403);
  await callAdminUsers(studentToken, forbiddenCreate, 403);
  console.log("✓ Guru dan siswa ditolak saat mencoba mengelola akun");

  const managedEmail = `awexam-smoke-managed-${runId}@example.invalid`;
  const managed = await callAdminUsers(adminToken, {
    action: "create",
    full_name: "AWExam Smoke Managed",
    email: managedEmail,
    password,
    role: "guru",
  }, 201);
  assert.ok(managed.user_id);
  createdUserIds.push(managed.user_id);

  await callAdminUsers(adminToken, {
    action: "update",
    user_id: managed.user_id,
    full_name: "AWExam Smoke Managed Updated",
    email: managedEmail,
    role: "guru",
  }, 200);
  await callAdminUsers(adminToken, {
    action: "set_active",
    user_id: managed.user_id,
    active: false,
  }, 200);
  await callAdminUsers(adminToken, {
    action: "set_active",
    user_id: managed.user_id,
    active: true,
  }, 200);
  await callAdminUsers(adminToken, {
    action: "reset_password",
    user_id: managed.user_id,
    password: `${password}2`,
  }, 200);
  await callAdminUsers(adminToken, {
    action: "set_active",
    user_id: temporaryAdmin.id,
    active: false,
  }, 400);
  await callAdminUsers(adminToken, {
    action: "delete",
    user_id: temporaryAdmin.id,
  }, 400);
  await callAdminUsers(adminToken, {
    action: "delete",
    user_id: managed.user_id,
  }, 200);
  createdUserIds.splice(createdUserIds.indexOf(managed.user_id), 1);
  console.log("✓ Siklus create/update/nonaktif/aktif/reset/delete akun production");

  const importAuthorization = await request("/functions/v1/import-questions", {
    method: "POST",
    headers: {
      ...publicHeaders,
      Authorization: `Bearer ${teacherToken}`,
      Origin: appOrigin,
    },
    body: JSON.stringify({ text: "" }),
  });
  assert.equal(importAuthorization.response.status, 400);
  assert.match(importAuthorization.body?.error ?? "", /Teks soal kosong/i);
  console.log("✓ Guru diizinkan mencapai validasi impor soal tanpa menjalankan AI");
} finally {
  const cleanupErrors = [];
  const academicCleanup = [
    ["integrity_events", "attempt_id", academicIds.attemptId],
    ["attempts", "id", academicIds.attemptId],
    ["exams", "id", academicIds.examId],
    ...academicIds.questionIds.map((id) => ["questions", "id", id]),
    ["question_banks", "id", academicIds.bankId],
    ["teacher_subjects", "class_id", academicIds.classId],
    ["class_students", "class_id", academicIds.classId],
    ["classes", "id", academicIds.classId],
    ["subjects", "id", academicIds.subjectId],
  ];
  for (const [table, column, value] of academicCleanup) {
    try { await deleteRows(table, column, value); }
    catch (error) { cleanupErrors.push(new Error(`Cleanup ${table} gagal`, { cause: error })); }
  }
  for (const userId of [...createdUserIds].reverse()) {
    try { await deleteUser(userId); }
    catch (error) { cleanupErrors.push(new Error(`Cleanup ${userId} gagal`, { cause: error })); }
  }
  const leftovers = await request(
    "/rest/v1/profiles?select=id,full_name&full_name=ilike.AWExam%20Smoke%25",
    { headers: adminHeaders },
  );
  assert.equal(leftovers.response.status, 200);
  assert.deepEqual(leftovers.body, [], "Akun AWExam Smoke masih tersisa");
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Cleanup akun uji gagal");
  console.log("✓ Cleanup akun uji sementara selesai");
}
