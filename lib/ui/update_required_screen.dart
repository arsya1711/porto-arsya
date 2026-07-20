import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'common.dart';

/// Ditampilkan ketika versi aplikasi lebih lama daripada yang dilayani server.
///
/// Sengaja tanpa jalan pintas: klien lama bisa memakai kontrak RPC yang sudah
/// berubah, dan kegagalan di tengah ujian jauh lebih merugikan daripada menahan
/// siswa di layar ini sampai aplikasinya diperbarui.
class UpdateRequiredScreen extends StatelessWidget {
  const UpdateRequiredScreen({
    super.key,
    required this.currentVersion,
    this.minimumVersion,
  });

  final String currentVersion;
  final String? minimumVersion;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const BrandMark(size: 56),
                const SizedBox(height: 28),
                const Icon(
                  Icons.system_update_rounded,
                  size: 44,
                  color: AppColors.blue,
                ),
                const SizedBox(height: 18),
                Text(
                  'Perbarui AWExam',
                  style: Theme.of(context).textTheme.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Versi aplikasi yang kamu pakai sudah tidak didukung server. '
                  'Minta versi terbaru kepada pengawas atau guru sebelum '
                  'mengikuti ujian.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: AppColors.muted),
                ),
                const SizedBox(height: 26),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _VersionLabel(
                        label: 'Terpasang',
                        value: currentVersion,
                        color: AppColors.red,
                      ),
                      if (minimumVersion != null) ...[
                        const SizedBox(width: 26),
                        _VersionLabel(
                          label: 'Dibutuhkan',
                          value: minimumVersion!,
                          color: AppColors.green,
                        ),
                      ],
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

class _VersionLabel extends StatelessWidget {
  const _VersionLabel({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 9, color: AppColors.muted),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
      ],
    );
  }
}
