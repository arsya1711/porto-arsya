import 'package:flutter/material.dart';

import '../models/models.dart';
import '../state/app_controller.dart';
import '../theme/app_theme.dart';
import 'common.dart';

class ExamRoomScreen extends StatefulWidget {
  const ExamRoomScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<ExamRoomScreen> createState() => _ExamRoomScreenState();
}

class _ExamRoomScreenState extends State<ExamRoomScreen>
    with WidgetsBindingObserver {
  final essayController = TextEditingController();
  bool wasBackgrounded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    essayController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      wasBackgrounded = true;
    }
    if (state == AppLifecycleState.resumed && wasBackgrounded) {
      wasBackgrounded = false;
      widget.controller.recordIntegrityEvent();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Aktivitas keluar aplikasi telah dicatat.'),
            backgroundColor: AppColors.amber,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          final question = controller.questions[controller.currentQuestion];
          if (question.type == QuestionType.essay &&
              essayController.text != (controller.answers[question.id] ?? '')) {
            essayController.text = controller.answers[question.id] ?? '';
          }
          return Scaffold(
            backgroundColor: Colors.white,
            appBar: AppBar(
              automaticallyImplyLeading: false,
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              toolbarHeight: 68,
              flexibleSpace: const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.navy, Color(0xFF1C3162)],
                  ),
                ),
              ),
              titleSpacing: 18,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    controller.activeExam?.subject ?? 'Ujian',
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFFAAB5CA),
                    ),
                  ),
                  Text(
                    controller.activeExam?.title ?? '',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'SISA WAKTU',
                        style: TextStyle(
                          fontSize: 8,
                          letterSpacing: .8,
                          color: Color(0xFFAAB5CA),
                        ),
                      ),
                      Text(
                        controller.formattedTime,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            body: Column(
              children: [
                _ExamStatusBar(controller: controller),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 30),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            StatusPill(
                              label:
                                  question.type == QuestionType.multipleChoice
                                  ? 'Pilihan ganda'
                                  : 'Essay',
                              color: AppColors.blue,
                            ),
                            const Spacer(),
                            Text(
                              'Soal ${controller.currentQuestion + 1} dari ${controller.questions.length}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.muted,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 22),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Text(
                            question.body,
                            style: const TextStyle(
                              fontSize: 17,
                              height: 1.55,
                              fontWeight: FontWeight.w700,
                              color: AppColors.navy,
                            ),
                          ),
                        ),
                        const SizedBox(height: 26),
                        if (question.type == QuestionType.multipleChoice)
                          ...question.options.asMap().entries.map(
                            (entry) => _AnswerOption(
                              index: entry.key,
                              text: entry.value,
                              selected:
                                  controller.answers[question.id] ==
                                  entry.key.toString(),
                              onTap: () => controller.answer(
                                question.id,
                                entry.key.toString(),
                              ),
                            ),
                          )
                        else
                          TextField(
                            controller: essayController,
                            minLines: 7,
                            maxLines: 12,
                            onChanged: (value) =>
                                controller.answer(question.id, value),
                            decoration: const InputDecoration(
                              hintText: 'Tulis jawabanmu di sini…',
                              alignLabelWithHint: true,
                            ),
                          ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                controller.isOnline
                                    ? 'Tersimpan & tersinkron'
                                    : 'Tersimpan di perangkat',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: controller.isOnline
                                      ? AppColors.green
                                      : AppColors.amber,
                                ),
                              ),
                            ),
                            TextButton.icon(
                              onPressed: () =>
                                  controller.toggleFlag(question.id),
                              icon: Icon(
                                controller.flagged.contains(question.id)
                                    ? Icons.flag_rounded
                                    : Icons.outlined_flag_rounded,
                                size: 19,
                              ),
                              label: Text(
                                controller.flagged.contains(question.id)
                                    ? 'Ditandai'
                                    : 'Tandai ragu',
                              ),
                              style: TextButton.styleFrom(
                                foregroundColor:
                                    controller.flagged.contains(question.id)
                                    ? AppColors.amber
                                    : AppColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            bottomNavigationBar: SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    IconButton.filledTonal(
                      onPressed: _openNavigator,
                      icon: const Icon(Icons.grid_view_rounded),
                      tooltip: 'Lihat semua nomor soal',
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: controller.currentQuestion == 0
                          ? null
                          : () => controller.goToQuestion(
                              controller.currentQuestion - 1,
                            ),
                      child: const Icon(Icons.arrow_back_rounded),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed:
                            controller.currentQuestion ==
                                controller.questions.length - 1
                            ? _review
                            : () => controller.goToQuestion(
                                controller.currentQuestion + 1,
                              ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              controller.currentQuestion ==
                                      controller.questions.length - 1
                                  ? 'Periksa jawaban'
                                  : 'Soal berikutnya',
                            ),
                            const SizedBox(width: 7),
                            Icon(
                              controller.currentQuestion ==
                                      controller.questions.length - 1
                                  ? Icons.fact_check_outlined
                                  : Icons.arrow_forward_rounded,
                              size: 18,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _openNavigator() => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => QuestionNavigator(controller: widget.controller),
  );
  void _review() => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    builder: (_) =>
        ReviewSheet(controller: widget.controller, onSubmit: _submit),
  );

  void _submit() {
    Navigator.of(context).pop();
    widget.controller.submitExam();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => SubmissionSummaryScreen(controller: widget.controller),
      ),
    );
  }
}

class _ExamStatusBar extends StatelessWidget {
  const _ExamStatusBar({required this.controller});
  final AppController controller;
  @override
  Widget build(BuildContext context) {
    final progress =
        (controller.currentQuestion + 1) / controller.questions.length;
    return Container(
      color: AppColors.background,
      padding: const EdgeInsets.fromLTRB(18, 11, 18, 10),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color:
                      (controller.isOnline ? AppColors.green : AppColors.amber)
                          .withValues(alpha: .09),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(
                      controller.isOnline
                          ? Icons.cloud_done_outlined
                          : Icons.cloud_off_outlined,
                      size: 14,
                      color: controller.isOnline
                          ? AppColors.green
                          : AppColors.amber,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      controller.isOnline ? 'Tersinkron' : 'Tersimpan lokal',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: controller.isOnline
                            ? AppColors.green
                            : AppColors.amber,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                '${controller.answeredCount}/${controller.questions.length} terjawab',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.muted,
                ),
              ),
              if (controller.integrityEvents > 0) ...[
                const SizedBox(width: 10),
                const Icon(
                  Icons.shield_outlined,
                  color: AppColors.amber,
                  size: 15,
                ),
                Text(
                  ' ${controller.integrityEvents}',
                  style: const TextStyle(fontSize: 10, color: AppColors.amber),
                ),
              ],
            ],
          ),
          const SizedBox(height: 9),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 5,
              backgroundColor: AppColors.border,
              valueColor: const AlwaysStoppedAnimation(AppColors.blue),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnswerOption extends StatelessWidget {
  const _AnswerOption({
    required this.index,
    required this.text,
    required this.selected,
    required this.onTap,
  });
  final int index;
  final String text;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const letters = ['A', 'B', 'C', 'D', 'E'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: Material(
        color: selected ? const Color(0xFFF0F3FF) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(
            color: selected ? AppColors.blue : AppColors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected ? AppColors.blue : const Color(0xFFF3F5F8),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Text(
                    letters[index],
                    style: TextStyle(
                      color: selected ? Colors.white : AppColors.muted,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Text(
                    text,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
                Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: selected ? AppColors.blue : Colors.grey.shade400,
                  size: 21,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class QuestionNavigator extends StatelessWidget {
  const QuestionNavigator({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Navigator soal',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 5),
              Text(
                '${controller.answeredCount} terjawab • ${controller.questions.length - controller.answeredCount} belum • ${controller.flagged.length} ditandai',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 20),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 5,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                ),
                itemCount: controller.questions.length,
                itemBuilder: (context, index) {
                  final question = controller.questions[index];
                  final answered =
                      controller.answers[question.id]?.trim().isNotEmpty ??
                      false;
                  final flagged = controller.flagged.contains(question.id);
                  final current = index == controller.currentQuestion;
                  return InkWell(
                    onTap: () {
                      controller.goToQuestion(index);
                      Navigator.pop(context);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: current
                            ? AppColors.blue
                            : answered
                            ? const Color(0xFFEAF8F3)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: current
                              ? AppColors.blue
                              : answered
                              ? AppColors.green
                              : AppColors.border,
                        ),
                      ),
                      child: Stack(
                        children: [
                          Center(
                            child: Text(
                              '${index + 1}',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: current
                                    ? Colors.white
                                    : answered
                                    ? AppColors.green
                                    : AppColors.muted,
                              ),
                            ),
                          ),
                          if (flagged)
                            const Positioned(
                              right: 4,
                              top: 4,
                              child: Icon(
                                Icons.flag_rounded,
                                size: 11,
                                color: AppColors.amber,
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 20),
              Row(
                children: const [
                  _Legend(color: AppColors.green, label: 'Terjawab'),
                  SizedBox(width: 16),
                  _Legend(color: AppColors.border, label: 'Belum'),
                  SizedBox(width: 16),
                  _Legend(color: AppColors.amber, label: 'Ragu'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});
  final Color color;
  final String label;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        width: 9,
        height: 9,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 5),
      Text(label, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
    ],
  );
}

class ReviewSheet extends StatelessWidget {
  const ReviewSheet({
    super.key,
    required this.controller,
    required this.onSubmit,
  });
  final AppController controller;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final unanswered = <int>[];
    for (var i = 0; i < controller.questions.length; i++) {
      if (!(controller.answers[controller.questions[i].id]?.trim().isNotEmpty ??
          false)) {
        unanswered.add(i + 1);
      }
    }
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Periksa jawaban',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 7),
            const Text(
              'Pastikan semua jawaban sudah sesuai sebelum dikumpulkan.',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _ReviewMetric(
                    value: '${controller.answeredCount}',
                    label: 'Terjawab',
                    color: AppColors.green,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _ReviewMetric(
                    value: '${unanswered.length}',
                    label: 'Belum',
                    color: unanswered.isEmpty ? AppColors.green : AppColors.red,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _ReviewMetric(
                    value: '${controller.flagged.length}',
                    label: 'Ditandai',
                    color: AppColors.amber,
                  ),
                ),
              ],
            ),
            if (unanswered.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEEEE),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Text(
                  'Belum dijawab: soal ${unanswered.join(', ')}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 22),
            ElevatedButton(
              onPressed: () => _confirmSubmit(context),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.send_rounded, size: 18),
                  SizedBox(width: 8),
                  Text('Kumpulkan ujian'),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Kembali memeriksa'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmSubmit(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.send_rounded, color: AppColors.blue),
        title: const Text('Kumpulkan ujian sekarang?'),
        content: Text(
          controller.answeredCount == controller.questions.length
              ? 'Jawaban tidak dapat diubah setelah ujian dikumpulkan.'
              : 'Masih ada ${controller.questions.length - controller.answeredCount} soal belum dijawab. Jawaban tidak dapat diubah setelah dikumpulkan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Periksa lagi'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Ya, kumpulkan'),
          ),
        ],
      ),
    );
    if (confirmed == true) onSubmit();
  }
}

class _ReviewMetric extends StatelessWidget {
  const _ReviewMetric({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 14),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .08),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppColors.muted),
        ),
      ],
    ),
  );
}

class SubmissionSummaryScreen extends StatelessWidget {
  const SubmissionSummaryScreen({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final offline = controller.submittedOffline;
    return PopScope(
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Spacer(),
                Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(
                    color: (offline ? AppColors.amber : AppColors.green)
                        .withValues(alpha: .1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    offline
                        ? Icons.cloud_off_outlined
                        : Icons.check_circle_outline_rounded,
                    size: 48,
                    color: offline ? AppColors.amber : AppColors.green,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  offline ? 'Ujian tersimpan' : 'Ujian berhasil dikirim!',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 10),
                Text(
                  offline
                      ? 'Jawabanmu aman di perangkat dan akan dikirim otomatis saat koneksi kembali.'
                      : 'Semua jawaban sudah diterima server. Nilai akan muncul setelah guru menyelesaikan koreksi.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted, height: 1.55),
                ),
                const SizedBox(height: 28),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      children: [
                        _SummaryRow(
                          label: 'Ujian',
                          value: controller.activeExam?.title ?? '-',
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Divider(height: 1),
                        ),
                        _SummaryRow(
                          label: 'Jawaban tersimpan',
                          value:
                              '${controller.answeredCount}/${controller.questions.length} soal',
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Divider(height: 1),
                        ),
                        _SummaryRow(
                          label: 'Status',
                          value: offline
                              ? 'Menunggu sinkronisasi'
                              : 'Terkirim ke server',
                          valueColor: offline
                              ? AppColors.amber
                              : AppColors.green,
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      controller.closeAttempt();
                      Navigator.of(context).popUntil((route) => route.isFirst);
                    },
                    child: const Text('Kembali ke beranda'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
  });
  final String label;
  final String value;
  final Color? valueColor;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      const Spacer(),
      Flexible(
        child: Text(
          value,
          textAlign: TextAlign.right,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: valueColor ?? AppColors.text,
          ),
        ),
      ),
    ],
  );
}
