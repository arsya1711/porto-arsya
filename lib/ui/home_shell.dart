import 'package:flutter/material.dart';

import '../models/models.dart';
import '../state/app_controller.dart';
import '../theme/app_theme.dart';
import 'common.dart';
import 'exam_detail_screen.dart';

class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => Scaffold(
        body: IndexedStack(
          index: controller.homeTab,
          children: [
            ExamHome(controller: controller),
            HistoryPage(controller: controller),
            ProfilePage(controller: controller),
          ],
        ),
        bottomNavigationBar: _BottomNav(controller: controller),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.assignment_outlined, Icons.assignment_rounded, 'Ujian'),
      (Icons.history_rounded, Icons.history_rounded, 'Riwayat'),
      (Icons.person_outline_rounded, Icons.person_rounded, 'Profil'),
    ];
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0D101B35),
            blurRadius: 20,
            offset: Offset(0, -6),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 9, 22, 8),
          child: Row(
            children: items.asMap().entries.map((entry) {
              final selected = controller.homeTab == entry.key;
              final item = entry.value;
              return Expanded(
                child: InkWell(
                  onTap: () => controller.setTab(entry.key),
                  borderRadius: BorderRadius.circular(16),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.blueSoft : Colors.transparent,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          selected ? item.$2 : item.$1,
                          size: 21,
                          color: selected ? AppColors.blue : AppColors.muted,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.$3,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: selected
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: selected ? AppColors.blue : AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class ExamHome extends StatelessWidget {
  const ExamHome({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final available = controller.exams
        .where(
          (e) =>
              e.state == ExamState.available || e.state == ExamState.inProgress,
        )
        .toList();
    final upcoming = controller.exams
        .where((e) => e.state == ExamState.upcoming)
        .toList();
    return RefreshIndicator(
      onRefresh: controller.refreshExams,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _HomeHeader(controller: controller)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
            sliver: SliverToBoxAdapter(
              child: _SectionTitle(
                title: 'Ujian aktif',
                count: available.length,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: available.isEmpty && upcoming.isEmpty
                ? const SliverToBoxAdapter(child: _EmptyExamState())
                : SliverList.separated(
                    itemCount: available.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) => FeaturedExamCard(
                      exam: available[index],
                      onTap: () => _openExam(context, available[index]),
                    ),
                  ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 8),
            sliver: SliverToBoxAdapter(
              child: _SectionTitle(
                title: 'Agenda berikutnya',
                count: upcoming.length,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
            sliver: SliverList.separated(
              itemCount: upcoming.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) => ScheduleExamCard(
                exam: upcoming[index],
                onTap: () => _openExam(context, upcoming[index]),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openExam(BuildContext context, Exam exam) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ExamDetailScreen(controller: controller, exam: exam),
      ),
    );
  }
}

class _EmptyExamState extends StatelessWidget {
  const _EmptyExamState();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: AppColors.border),
      borderRadius: BorderRadius.circular(18),
    ),
    child: const Column(
      children: [
        Icon(Icons.event_available_outlined, size: 38, color: AppColors.muted),
        SizedBox(height: 12),
        Text(
          'Belum ada ujian untukmu',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
        ),
        SizedBox(height: 5),
        Text(
          'Ujian akan muncul setelah guru menugaskannya ke akun siswa ini.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 11, color: AppColors.muted),
        ),
      ],
    ),
  );
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.controller});
  final AppController controller;

  String _formattedDate() {
    const days = [
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
      'Minggu',
    ];
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    final now = DateTime.now();
    return '${days[now.weekday - 1]}, ${now.day} ${months[now.month - 1]} ${now.year}';
  }

  @override
  Widget build(BuildContext context) => Container(
    color: Colors.white,
    padding: EdgeInsets.fromLTRB(
      20,
      MediaQuery.paddingOf(context).top + 15,
      20,
      22,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.blueSoft,
                borderRadius: BorderRadius.circular(15),
              ),
              child: Text(
                controller.profile.name
                    .split(' ')
                    .map((e) => e[0])
                    .take(2)
                    .join(),
                style: const TextStyle(
                  color: AppColors.blue,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _greeting(),
                    style: const TextStyle(fontSize: 9, color: AppColors.muted),
                  ),
                  Text(
                    controller.profile.name,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.text,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(13),
              ),
              child: IconButton(
                tooltip: 'Informasi status data',
                onPressed: () => _showStatus(context),
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  size: 20,
                  color: AppColors.text,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 25),
        Text(
          'Ujian kamu',
          style: Theme.of(
            context,
          ).textTheme.headlineLarge?.copyWith(fontSize: 27),
        ),
        const SizedBox(height: 5),
        Row(
          children: [
            Text(
              _formattedDate(),
              style: TextStyle(fontSize: 10, color: AppColors.muted),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: (controller.isOnline ? AppColors.green : AppColors.amber)
                    .withValues(alpha: .09),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  Icon(
                    controller.isOnline
                        ? Icons.cloud_done_outlined
                        : Icons.cloud_off_outlined,
                    size: 13,
                    color: controller.isOnline
                        ? AppColors.green
                        : AppColors.amber,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    controller.isOnline ? 'Tersinkron' : 'Offline',
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
          ],
        ),
      ],
    ),
  );

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  void _showStatus(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Status data',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              Text(
                controller.isOnline
                    ? 'Aplikasi terhubung. Jadwal dan jawaban akan tersimpan ke server secara otomatis.'
                    : 'Aplikasi sedang offline. Jawaban tetap tersimpan di perangkat dan akan dikirim saat koneksi kembali.',
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    Navigator.pop(context);
                    await controller.refreshExams();
                  },
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Perbarui jadwal ujian'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LegacyHomeHeader extends StatelessWidget {
  const LegacyHomeHeader({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.navy, Color(0xFF1C3162)],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(34)),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -55,
            top: -45,
            child: Container(
              width: 190,
              height: 190,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white10, width: 24),
              ),
            ),
          ),
          Positioned(
            left: -30,
            bottom: -80,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.blue.withValues(alpha: .12),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              MediaQuery.paddingOf(context).top + 15,
              20,
              25,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const BrandMark(dark: true, size: 39),
                    const SizedBox(width: 11),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'AWEXAM',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                              letterSpacing: 1,
                            ),
                          ),
                          Text(
                            'Alhidayah Wattaqwa',
                            style: TextStyle(
                              color: Color(0xFFA9B6D0),
                              fontSize: 9,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .08),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: IconButton(
                        padding: EdgeInsets.zero,
                        onPressed: controller.toggleConnection,
                        icon: const Icon(
                          Icons.notifications_none_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 26),
                Text(
                  '${_greeting()}, ${controller.profile.name.split(' ').first}!',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -.7,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Ada satu ujian yang bisa kamu kerjakan hari ini.',
                  style: TextStyle(color: Color(0xFFA9B6D0), fontSize: 12),
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: _HeaderStat(
                        icon: Icons.assignment_turned_in_outlined,
                        value: '1',
                        label: 'Ujian aktif',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _HeaderStat(
                        icon: Icons.verified_outlined,
                        value: '88',
                        label: 'Nilai terakhir',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _HeaderStat(
                        icon: controller.isOnline
                            ? Icons.cloud_done_outlined
                            : Icons.cloud_off_outlined,
                        value: controller.isOnline ? 'Online' : 'Offline',
                        label: 'Status data',
                        compact: true,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }
}

class _HeaderStat extends StatelessWidget {
  const _HeaderStat({
    required this.icon,
    required this.value,
    required this.label,
    this.compact = false,
  });
  final IconData icon;
  final String value;
  final String label;
  final bool compact;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(11),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .08),
      borderRadius: BorderRadius.circular(15),
      border: Border.all(color: Colors.white.withValues(alpha: .07)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 17, color: const Color(0xFF9FB0FF)),
        const SizedBox(height: 8),
        Text(
          value,
          maxLines: 1,
          style: TextStyle(
            color: Colors.white,
            fontSize: compact ? 12 : 18,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Color(0xFFA9B6D0), fontSize: 8),
        ),
      ],
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.count});
  final String title;
  final int count;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(title, style: Theme.of(context).textTheme.titleMedium),
      ),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.blueSoft,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          '$count',
          style: const TextStyle(
            color: AppColors.blue,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    ],
  );
}

class FeaturedExamCard extends StatelessWidget {
  const FeaturedExamCard({super.key, required this.exam, required this.onTap});
  final Exam exam;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF7162ED), Color(0xFF5546D8)],
      ),
      borderRadius: BorderRadius.circular(25),
      boxShadow: const [
        BoxShadow(
          color: Color(0x326657E8),
          blurRadius: 25,
          offset: Offset(0, 11),
        ),
      ],
    ),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(25),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            children: [
              Positioned(
                right: -45,
                top: -50,
                child: Container(
                  width: 155,
                  height: 155,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: .09),
                      width: 24,
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: .14),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            children: [
                              Icon(
                                Icons.bolt_rounded,
                                color: Color(0xFFFFE38B),
                                size: 14,
                              ),
                              SizedBox(width: 4),
                              Text(
                                'BISA DIMULAI',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 8,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: .6,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        Text(
                          exam.subjectCode,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 26),
                    Text(
                      exam.subject,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      exam.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 21,
                        height: 1.25,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -.5,
                      ),
                    ),
                    const SizedBox(height: 22),
                    Row(
                      children: [
                        _FeaturedMeta(
                          icon: Icons.schedule_rounded,
                          label:
                              '${exam.schedule.hour.toString().padLeft(2, '0')}.${exam.schedule.minute.toString().padLeft(2, '0')} WIB',
                        ),
                        const SizedBox(width: 16),
                        _FeaturedMeta(
                          icon: Icons.timer_outlined,
                          label: '${exam.durationMinutes} menit',
                        ),
                        const Spacer(),
                        Container(
                          width: 42,
                          height: 42,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.arrow_forward_rounded,
                            color: AppColors.blue,
                            size: 20,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _FeaturedMeta extends StatelessWidget {
  const _FeaturedMeta({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 15, color: Colors.white70),
      const SizedBox(width: 5),
      Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  );
}

class ScheduleExamCard extends StatelessWidget {
  const ScheduleExamCard({super.key, required this.exam, required this.onTap});
  final Exam exam;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(19),
      border: Border.all(color: AppColors.border),
    ),
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(19),
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 58,
                decoration: BoxDecoration(
                  color: AppColors.blueSoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '${exam.schedule.day}',
                      style: const TextStyle(
                        color: AppColors.blue,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Text(
                      'JUL',
                      style: TextStyle(
                        color: AppColors.blue,
                        fontSize: 8,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      exam.subject,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: AppColors.blue,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      exam.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: AppColors.text,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Row(
                      children: [
                        const Icon(
                          Icons.schedule_rounded,
                          size: 13,
                          color: AppColors.muted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${exam.schedule.hour.toString().padLeft(2, '0')}.${exam.schedule.minute.toString().padLeft(2, '0')} • ${exam.durationMinutes} menit',
                          style: const TextStyle(
                            fontSize: 9,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ),
      ),
    ),
  );
}

class ExamCard extends StatelessWidget {
  const ExamCard({super.key, required this.exam, required this.onTap});
  final Exam exam;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final available =
        exam.state == ExamState.available || exam.state == ExamState.inProgress;
    final accent = available ? AppColors.green : AppColors.blue;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(21),
        border: Border.all(
          color: available ? const Color(0xFFD9EEE7) : AppColors.border,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A101B35),
            blurRadius: 18,
            offset: Offset(0, 7),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Stack(
              children: [
                Positioned(
                  left: 0,
                  top: 0,
                  bottom: 0,
                  child: Container(width: 4, color: accent),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 17, 16, 15),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 50,
                            height: 56,
                            decoration: BoxDecoration(
                              color: accent.withValues(alpha: .09),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  '${exam.schedule.day}',
                                  style: TextStyle(
                                    color: accent,
                                    fontSize: 19,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Text(
                                  'JUL',
                                  style: TextStyle(
                                    color: accent,
                                    fontSize: 8,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: .7,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 13),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      exam.subjectCode,
                                      style: TextStyle(
                                        color: accent,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: .5,
                                      ),
                                    ),
                                    const SizedBox(width: 7),
                                    Container(
                                      width: 3,
                                      height: 3,
                                      decoration: const BoxDecoration(
                                        color: AppColors.muted,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 7),
                                    Expanded(
                                      child: Text(
                                        exam.subject,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: AppColors.muted,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  exam.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(height: 1.25),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 5),
                          Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.arrow_outward_rounded,
                              size: 16,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.schedule_rounded,
                              size: 15,
                              color: AppColors.muted,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${exam.schedule.hour.toString().padLeft(2, '0')}.${exam.schedule.minute.toString().padLeft(2, '0')} WIB',
                              style: const TextStyle(
                                fontSize: 10,
                                color: AppColors.text,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 13),
                            const Icon(
                              Icons.timer_outlined,
                              size: 15,
                              color: AppColors.muted,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              '${exam.durationMinutes} menit',
                              style: const TextStyle(
                                fontSize: 10,
                                color: AppColors.text,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const Spacer(),
                            StatusPill(
                              label: available ? 'Mulai' : 'Terjadwal',
                              color: accent,
                            ),
                          ],
                        ),
                      ),
                    ],
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

class _HistoryStat extends StatelessWidget {
  const _HistoryStat({
    required this.value,
    required this.label,
    required this.icon,
  });
  final String value;
  final String label;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Icon(icon, size: 18, color: Colors.white70),
      const SizedBox(height: 7),
      Text(
        value,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 2),
      Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(color: Colors.white70, fontSize: 8),
      ),
    ],
  );
}

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final completed = controller.exams
        .where((e) => e.state == ExamState.completed)
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Riwayat ujian'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Hasil belajarmu',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 6),
          const Text(
            'Nilai hanya tampil setelah difinalisasi guru.',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.blue, AppColors.blueDark],
              ),
              borderRadius: BorderRadius.circular(21),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x254B6BFB),
                  blurRadius: 22,
                  offset: Offset(0, 9),
                ),
              ],
            ),
            child: const Row(
              children: [
                Expanded(
                  child: _HistoryStat(
                    value: '88',
                    label: 'Rata-rata',
                    icon: Icons.trending_up_rounded,
                  ),
                ),
                SizedBox(
                  height: 46,
                  child: VerticalDivider(color: Colors.white24),
                ),
                Expanded(
                  child: _HistoryStat(
                    value: '1',
                    label: 'Ujian selesai',
                    icon: Icons.task_alt_rounded,
                  ),
                ),
                SizedBox(
                  height: 46,
                  child: VerticalDivider(color: Colors.white24),
                ),
                Expanded(
                  child: _HistoryStat(
                    value: 'A',
                    label: 'Predikat',
                    icon: Icons.workspace_premium_outlined,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text('Hasil terbaru', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          ...completed.map(
            (exam) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(17),
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEAF8F3),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          exam.subjectCode,
                          style: const TextStyle(
                            color: AppColors.green,
                            fontWeight: FontWeight.w800,
                            fontSize: 11,
                          ),
                        ),
                      ),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              exam.title,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              exam.subject,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 7),
                            const StatusPill(
                              label: 'Nilai final',
                              color: AppColors.green,
                              icon: Icons.verified_outlined,
                            ),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          Text(
                            '${exam.score?.toInt()}',
                            style: const TextStyle(
                              fontSize: 27,
                              fontWeight: FontWeight.w800,
                              color: AppColors.navy,
                            ),
                          ),
                          const Text(
                            'Nilai',
                            style: TextStyle(
                              fontSize: 10,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final p = controller.profile;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Akun saya'),
        backgroundColor: Colors.white,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: IconButton.filledTonal(
              onPressed: () {},
              icon: const Icon(Icons.edit_outlined, size: 18),
              style: IconButton.styleFrom(
                backgroundColor: AppColors.blueSoft,
                foregroundColor: AppColors.blue,
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF7162ED), Color(0xFF5546D8)],
              ),
              borderRadius: BorderRadius.circular(26),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x286657E8),
                  blurRadius: 25,
                  offset: Offset(0, 11),
                ),
              ],
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -30,
                  top: -45,
                  child: Container(
                    width: 125,
                    height: 125,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: .10),
                        width: 18,
                      ),
                    ),
                  ),
                ),
                Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(21),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x22000000),
                                blurRadius: 15,
                                offset: Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Text(
                            p.name.split(' ').map((e) => e[0]).take(2).join(),
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.blue,
                              fontSize: 19,
                            ),
                          ),
                        ),
                        const SizedBox(width: 15),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 19,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -.4,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                p.school,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 10,
                                ),
                              ),
                              const SizedBox(height: 9),
                              Wrap(
                                spacing: 6,
                                children: [
                                  _ProfileChip(label: 'NIS ${p.studentNumber}'),
                                  _ProfileChip(label: 'Kelas ${p.className}'),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .11),
                        borderRadius: BorderRadius.circular(17),
                      ),
                      child: const Row(
                        children: [
                          Expanded(
                            child: _ProfileStat(
                              value: '4',
                              label: 'Total ujian',
                            ),
                          ),
                          SizedBox(
                            height: 28,
                            child: VerticalDivider(color: Colors.white24),
                          ),
                          Expanded(
                            child: _ProfileStat(
                              value: '88',
                              label: 'Rata-rata',
                            ),
                          ),
                          SizedBox(
                            height: 28,
                            child: VerticalDivider(color: Colors.white24),
                          ),
                          Expanded(
                            child: _ProfileStat(
                              value: '100%',
                              label: 'Tersinkron',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 25),
          const _ProfileSectionTitle(title: 'PREFERENSI'),
          const SizedBox(height: 9),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                _ProfileMenu(
                  icon: Icons.text_fields_rounded,
                  iconColor: AppColors.blue,
                  iconBackground: AppColors.blueSoft,
                  title: 'Tampilan & ukuran teks',
                  subtitle: 'Mengikuti pengaturan perangkat',
                  onTap: () {},
                ),
                const _ProfileDivider(),
                _ProfileMenu(
                  icon: Icons.notifications_none_rounded,
                  iconColor: AppColors.amber,
                  iconBackground: Color(0xFFFFF5E5),
                  title: 'Pengingat ujian',
                  subtitle: 'Aktif • 15 menit sebelum ujian',
                  onTap: () {},
                ),
                const _ProfileDivider(),
                _ProfileMenu(
                  icon: Icons.lock_outline_rounded,
                  iconColor: AppColors.green,
                  iconBackground: Color(0xFFE8F8F4),
                  title: 'Keamanan akun',
                  subtitle: 'Kata sandi dan perangkat aktif',
                  onTap: () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: 21),
          const _ProfileSectionTitle(title: 'DATA & BANTUAN'),
          const SizedBox(height: 9),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                _ProfileMenu(
                  icon: controller.unsyncedCount == 0
                      ? Icons.cloud_done_outlined
                      : Icons.cloud_off_outlined,
                  iconColor: AppColors.green,
                  iconBackground: const Color(0xFFE8F8F4),
                  title: 'Penyimpanan & sinkronisasi',
                  subtitle: controller.unsyncedCount == 0
                      ? 'Semua data tersimpan aman'
                      : '${controller.unsyncedCount} jawaban menunggu jaringan',
                  trailing: const _SyncedBadge(),
                  onTap: () {},
                ),
                const _ProfileDivider(),
                _ProfileMenu(
                  icon: Icons.help_outline_rounded,
                  iconColor: const Color(0xFFEF7A56),
                  iconBackground: const Color(0xFFFFEEE9),
                  title: 'Pusat bantuan',
                  subtitle: 'Panduan dan bantuan teknis',
                  onTap: () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          TextButton.icon(
            onPressed: controller.logout,
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: const Text('Keluar dari akun'),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.red,
              minimumSize: const Size.fromHeight(50),
              backgroundColor: const Color(0xFFFFF1F1),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'AWExam Student  •  Versi 1.0.0',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 9, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _ProfileChip extends StatelessWidget {
  const _ProfileChip({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .13),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      label,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 8,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({required this.value, required this.label});
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        value,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(color: Colors.white60, fontSize: 8)),
    ],
  );
}

class _ProfileSectionTitle extends StatelessWidget {
  const _ProfileSectionTitle({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) => Text(
    title,
    style: const TextStyle(
      color: AppColors.muted,
      fontSize: 9,
      fontWeight: FontWeight.w800,
      letterSpacing: 1.1,
    ),
  );
}

class _ProfileMenu extends StatelessWidget {
  const _ProfileMenu({
    required this.icon,
    required this.iconColor,
    required this.iconBackground,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.trailing,
  });
  final IconData icon;
  final Color iconColor;
  final Color iconBackground;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconBackground,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 9, color: AppColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          trailing ??
              const Icon(
                Icons.chevron_right_rounded,
                size: 19,
                color: AppColors.muted,
              ),
        ],
      ),
    ),
  );
}

class _ProfileDivider extends StatelessWidget {
  const _ProfileDivider();
  @override
  Widget build(BuildContext context) =>
      const Divider(height: 1, indent: 64, color: AppColors.border);
}

class _SyncedBadge extends StatelessWidget {
  const _SyncedBadge();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(
      color: const Color(0xFFE8F8F4),
      borderRadius: BorderRadius.circular(20),
    ),
    child: const Text(
      'AMAN',
      style: TextStyle(
        color: AppColors.green,
        fontSize: 7,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}
