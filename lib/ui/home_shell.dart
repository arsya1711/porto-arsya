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
        bottomNavigationBar: NavigationBar(
          selectedIndex: controller.homeTab,
          onDestinationSelected: controller.setTab,
          backgroundColor: Colors.white,
          indicatorColor: const Color(0xFFE8EDFF),
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.assignment_outlined),
              selectedIcon: Icon(Icons.assignment_rounded),
              label: 'Ujian',
            ),
            const NavigationDestination(
              icon: Icon(Icons.history_rounded),
              selectedIcon: Icon(Icons.history_rounded),
              label: 'Riwayat',
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: controller.unsyncedCount > 0,
                child: const Icon(Icons.person_outline_rounded),
              ),
              selectedIcon: const Icon(Icons.person_rounded),
              label: 'Profil',
            ),
          ],
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
      onRefresh: () async =>
          Future<void>.delayed(const Duration(milliseconds: 500)),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _HomeHeader(controller: controller)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
            sliver: SliverToBoxAdapter(
              child: _SectionTitle(
                title: 'Tersedia sekarang',
                count: available.length,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverList.separated(
              itemCount: available.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) => ExamCard(
                exam: available[index],
                onTap: () => _openExam(context, available[index]),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 8),
            sliver: SliverToBoxAdapter(
              child: _SectionTitle(
                title: 'Akan datang',
                count: upcoming.length,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
            sliver: SliverList.separated(
              itemCount: upcoming.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) => ExamCard(
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

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.navy,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.paddingOf(context).top + 18,
        20,
        24,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const BrandMark(dark: true, size: 40),
              const SizedBox(width: 11),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'RUANG UJIAN',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        letterSpacing: .8,
                      ),
                    ),
                    Text(
                      'SMP Nusantara',
                      style: TextStyle(color: Color(0xFFAAB5CA), fontSize: 10),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: controller.toggleConnection,
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),
          Text(
            'Halo, ${controller.profile.name.split(' ').first} 👋',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 23,
              fontWeight: FontWeight.w800,
              letterSpacing: -.4,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'Siap mengerjakan ujian hari ini?',
            style: TextStyle(color: Color(0xFFAAB5CA), fontSize: 13),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: .08)),
            ),
            child: Row(
              children: [
                Icon(
                  controller.isOnline
                      ? Icons.cloud_done_outlined
                      : Icons.cloud_off_outlined,
                  size: 19,
                  color: controller.isOnline
                      ? const Color(0xFF71DFBB)
                      : const Color(0xFFFFC764),
                ),
                const SizedBox(width: 9),
                Text(
                  controller.isOnline
                      ? 'Online • Semua data tersinkron'
                      : 'Offline • Jawaban tetap tersimpan',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
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
          color: const Color(0xFFE8EDFF),
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

class ExamCard extends StatelessWidget {
  const ExamCard({super.key, required this.exam, required this.onTap});
  final Exam exam;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final available =
        exam.state == ExamState.available || exam.state == ExamState.inProgress;
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: available
                          ? const Color(0xFFEAF8F3)
                          : const Color(0xFFF0F3FF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      exam.subjectCode,
                      style: TextStyle(
                        color: available ? AppColors.green : AppColors.blue,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          exam.subject,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          exam.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.grey.shade400,
                  ),
                ],
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Divider(height: 1),
              ),
              Row(
                children: [
                  const Icon(
                    Icons.calendar_today_outlined,
                    size: 15,
                    color: AppColors.muted,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _date(exam.schedule),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(width: 14),
                  const Icon(
                    Icons.timer_outlined,
                    size: 16,
                    color: AppColors.muted,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    '${exam.durationMinutes} menit',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.muted,
                    ),
                  ),
                  const Spacer(),
                  StatusPill(
                    label: available ? 'Bisa dimulai' : 'Terjadwal',
                    color: available ? AppColors.green : AppColors.blue,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _date(DateTime value) =>
      '${value.day} Jul • ${value.hour.toString().padLeft(2, '0')}.${value.minute.toString().padLeft(2, '0')} WIB';
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
          const SizedBox(height: 22),
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
        title: const Text('Profil'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 34,
                    backgroundColor: const Color(0xFFE8EDFF),
                    child: Text(
                      p.name.split(' ').map((e) => e[0]).take(2).join(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.blue,
                        fontSize: 20,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(p.name, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(
                    '${p.studentNumber} • ${p.className}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(
                    Icons.school_outlined,
                    color: AppColors.blue,
                  ),
                  title: const Text('Sekolah'),
                  subtitle: Text(p.school),
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(
                    Icons.cloud_outlined,
                    color: AppColors.blue,
                  ),
                  title: const Text('Penyimpanan lokal'),
                  subtitle: Text(
                    controller.unsyncedCount == 0
                        ? 'Tidak ada data menunggu sinkronisasi'
                        : '${controller.unsyncedCount} jawaban menunggu jaringan',
                  ),
                ),
                const Divider(height: 1, indent: 56),
                const ListTile(
                  leading: Icon(
                    Icons.text_fields_rounded,
                    color: AppColors.blue,
                  ),
                  title: Text('Ukuran teks'),
                  subtitle: Text('Mengikuti pengaturan perangkat'),
                  trailing: Icon(Icons.chevron_right_rounded),
                ),
                const Divider(height: 1, indent: 56),
                const ListTile(
                  leading: Icon(
                    Icons.lock_outline_rounded,
                    color: AppColors.blue,
                  ),
                  title: Text('Ganti kata sandi'),
                  trailing: Icon(Icons.chevron_right_rounded),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: controller.logout,
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Keluar dari akun'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.red,
              side: const BorderSide(color: Color(0xFFF1CACA)),
              minimumSize: const Size.fromHeight(50),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Ruang Ujian Siswa • v1.0.0',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}
