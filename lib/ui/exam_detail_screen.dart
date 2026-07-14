import 'package:flutter/material.dart';

import '../models/models.dart';
import '../state/app_controller.dart';
import '../theme/app_theme.dart';
import 'common.dart';
import 'exam_room_screen.dart';

class ExamDetailScreen extends StatefulWidget {
  const ExamDetailScreen({
    super.key,
    required this.controller,
    required this.exam,
  });
  final AppController controller;
  final Exam exam;

  @override
  State<ExamDetailScreen> createState() => _ExamDetailScreenState();
}

class _ExamDetailScreenState extends State<ExamDetailScreen> {
  final code = TextEditingController();
  bool agreed = false;
  String? codeError;

  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final exam = widget.exam;
    final available =
        exam.state == ExamState.available || exam.state == ExamState.inProgress;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detail ujian'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 130),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.navy, Color(0xFF1D356C)],
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x24101B35),
                  blurRadius: 24,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .1),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(
                        exam.subjectCode,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    const Spacer(),
                    StatusPill(
                      label: available ? 'Tersedia' : 'Akan datang',
                      color: available
                          ? const Color(0xFF71DFBB)
                          : const Color(0xFF8FA8FF),
                    ),
                  ],
                ),
                const SizedBox(height: 22),
                Text(
                  exam.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -.6,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  '${exam.subject} • ${exam.teacher}',
                  style: const TextStyle(
                    color: Color(0xFFAAB5CA),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _ExamMetric(
                  icon: Icons.calendar_month_outlined,
                  value: '${exam.schedule.day} Jul',
                  label: 'Tanggal',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ExamMetric(
                  icon: Icons.schedule_rounded,
                  value:
                      '${exam.schedule.hour.toString().padLeft(2, '0')}.${exam.schedule.minute.toString().padLeft(2, '0')}',
                  label: 'Mulai',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ExamMetric(
                  icon: Icons.timer_outlined,
                  value: '${exam.durationMinutes} mnt',
                  label: 'Durasi',
                ),
              ),
            ],
          ),
          const SizedBox(height: 26),
          Row(
            children: [
              Text(
                'Petunjuk pengerjaan',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.blueSoft,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${exam.questionCount} soal',
                  style: const TextStyle(
                    color: AppColors.blue,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: exam.instructions
                    .asMap()
                    .entries
                    .map(
                      (item) => Padding(
                        padding: EdgeInsets.only(
                          bottom: item.key == exam.instructions.length - 1
                              ? 0
                              : 13,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 28,
                              height: 28,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: AppColors.blueSoft,
                                borderRadius: BorderRadius.circular(9),
                              ),
                              child: Text(
                                '${item.key + 1}',
                                style: const TextStyle(
                                  color: AppColors.blue,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                item.value,
                                style: const TextStyle(
                                  fontSize: 12,
                                  height: 1.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7E7),
              border: Border.all(color: const Color(0xFFF5DEAE)),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.shield_outlined,
                  color: AppColors.amber,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    exam.lockdown
                        ? 'Mode aman aktif. Aktivitas keluar aplikasi akan dicatat untuk pengawas.'
                        : 'Mode aman tidak diwajibkan untuk ujian ini.',
                    style: const TextStyle(
                      fontSize: 12,
                      height: 1.45,
                      color: Color(0xFF7A5A21),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (exam.requiresCode && available) ...[
            const SizedBox(height: 22),
            const Text(
              'Kode akses ujian',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: code,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                hintText: 'Masukkan kode dari pengawas',
                errorText: codeError,
                prefixIcon: const Icon(Icons.key_outlined),
              ),
            ),
          ],
          if (available) ...[
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(
                color: agreed ? AppColors.blueSoft : Colors.white,
                borderRadius: BorderRadius.circular(15),
                border: Border.all(
                  color: agreed ? const Color(0xFFC9D2FF) : AppColors.border,
                ),
              ),
              child: Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(15),
                child: CheckboxListTile(
                  value: agreed,
                  onChanged: (value) => setState(() => agreed = value ?? false),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                  controlAffinity: ListTileControlAffinity.leading,
                  title: const Text(
                    'Saya sudah membaca petunjuk dan siap memulai.',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: ElevatedButton(
            onPressed: available && agreed ? _start : null,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  available ? Icons.play_arrow_rounded : Icons.schedule_rounded,
                ),
                const SizedBox(width: 8),
                Text(available ? 'Mulai ujian' : 'Belum tersedia'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _start() {
    if (widget.exam.requiresCode && code.text.trim().toUpperCase() != 'UJIAN') {
      setState(() => codeError = 'Gunakan kode demo: UJIAN');
      return;
    }
    widget.controller.startExam(widget.exam);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => ExamRoomScreen(controller: widget.controller),
      ),
    );
  }
}

class _ExamMetric extends StatelessWidget {
  const _ExamMetric({
    required this.icon,
    required this.value,
    required this.label,
  });
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(17),
      border: Border.all(color: AppColors.border),
      boxShadow: const [
        BoxShadow(
          color: Color(0x08101B35),
          blurRadius: 12,
          offset: Offset(0, 5),
        ),
      ],
    ),
    child: Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppColors.blueSoft,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 17, color: AppColors.blue),
        ),
        const SizedBox(height: 9),
        Text(
          value,
          maxLines: 1,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: AppColors.navy,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 9, color: AppColors.muted),
        ),
      ],
    ),
  );
}
