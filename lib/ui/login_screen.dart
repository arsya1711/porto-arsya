import 'package:flutter/material.dart';

import '../state/app_controller.dart';
import '../theme/app_theme.dart';
import 'common.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final username = TextEditingController(text: '24001');
  final password = TextEditingController(text: 'siswa123');
  bool obscure = true;
  String? error;

  @override
  void dispose() {
    username.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    final success = await widget.controller.login(username.text, password.text);
    if (mounted && !success) {
      setState(() => error = 'NIS atau kata sandi salah.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          const Positioned.fill(bottom: null, child: _LoginHero()),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 34, 20, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Row(
                    children: [
                      BrandMark(dark: true, size: 44),
                      SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'RUANG UJIAN',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.1,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'SMP Nusantara',
                            style: TextStyle(
                              fontSize: 10,
                              color: Color(0xFFB6C2DC),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 46),
                  const Text(
                    'Belajar jujur,\nraih hasil terbaik.',
                    style: TextStyle(
                      fontSize: 30,
                      height: 1.15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Semua ujianmu dalam satu tempat yang aman.',
                    style: TextStyle(fontSize: 12, color: Color(0xFFB6C2DC)),
                  ),
                  const SizedBox(height: 40),
                  Container(
                    padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(26),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x1A1A2A52),
                          blurRadius: 34,
                          offset: Offset(0, 14),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Masuk ke akunmu',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Gunakan akun siswa yang diberikan sekolah.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                        const SizedBox(height: 24),
                        const _FieldLabel('Nomor induk siswa'),
                        const SizedBox(height: 8),
                        TextField(
                          controller: username,
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            prefixIcon: Icon(Icons.badge_outlined, size: 20),
                            hintText: 'Contoh: 24001',
                          ),
                        ),
                        const SizedBox(height: 17),
                        Row(
                          children: [
                            const Expanded(child: _FieldLabel('Kata sandi')),
                            TextButton(
                              onPressed: () {},
                              child: const Text(
                                'Lupa?',
                                style: TextStyle(fontSize: 11),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        TextField(
                          controller: password,
                          obscureText: obscure,
                          onSubmitted: (_) => submit(),
                          decoration: InputDecoration(
                            prefixIcon: const Icon(
                              Icons.lock_outline_rounded,
                              size: 20,
                            ),
                            hintText: 'Masukkan kata sandi',
                            suffixIcon: IconButton(
                              onPressed: () =>
                                  setState(() => obscure = !obscure),
                              icon: Icon(
                                obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                size: 20,
                              ),
                            ),
                          ),
                        ),
                        if (error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: Text(
                              error!,
                              style: const TextStyle(
                                color: AppColors.red,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        const SizedBox(height: 22),
                        ListenableBuilder(
                          listenable: widget.controller,
                          builder: (_, _) => ElevatedButton(
                            onPressed: widget.controller.isAuthenticating
                                ? null
                                : submit,
                            child: widget.controller.isAuthenticating
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text('Masuk sekarang'),
                                      SizedBox(width: 9),
                                      Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 18,
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 15,
                      vertical: 13,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.blueSoft,
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.auto_awesome_rounded,
                          size: 18,
                          color: AppColors.blue,
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Mode demo aktif • Data login sudah terisi',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.blue,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Butuh bantuan? Hubungi pengawas ujian',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 10, color: AppColors.muted),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 11,
      fontWeight: FontWeight.w700,
      color: AppColors.text,
    ),
  );
}

class _LoginHero extends StatelessWidget {
  const _LoginHero();
  @override
  Widget build(BuildContext context) => Container(
    height: 390,
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF101B35), Color(0xFF1D3264)],
      ),
      borderRadius: BorderRadius.vertical(bottom: Radius.circular(38)),
    ),
    child: Stack(
      children: [
        Positioned(
          right: -85,
          top: -65,
          child: Container(
            width: 250,
            height: 250,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white10, width: 30),
            ),
          ),
        ),
        Positioned(
          left: -70,
          top: 220,
          child: Container(
            width: 170,
            height: 170,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.blue.withValues(alpha: .10),
            ),
          ),
        ),
        Positioned(
          right: 28,
          top: 170,
          child: Transform.rotate(
            angle: -.15,
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .06),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white10),
              ),
              child: const Icon(
                Icons.edit_note_rounded,
                color: Colors.white24,
                size: 36,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
