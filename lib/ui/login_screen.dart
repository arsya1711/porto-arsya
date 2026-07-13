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
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 30, 24, 24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.sizeOf(context).height - 78,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const BrandMark(),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'RUANG UJIAN',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                            color: AppColors.navy,
                          ),
                        ),
                        Text(
                          'Portal siswa',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 56),
                Text(
                  'Selamat datang!',
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Masuk dengan akun siswa untuk melihat dan mengerjakan ujianmu.',
                  style: TextStyle(color: AppColors.muted, height: 1.5),
                ),
                const SizedBox(height: 34),
                const Text(
                  'Nomor induk siswa',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: username,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.badge_outlined),
                    hintText: 'Masukkan NIS',
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Kata sandi',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: password,
                  obscureText: obscure,
                  onSubmitted: (_) => submit(),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    hintText: 'Masukkan kata sandi',
                    suffixIcon: IconButton(
                      onPressed: () => setState(() => obscure = !obscure),
                      icon: Icon(
                        obscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
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
                const SizedBox(height: 24),
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
                              Text('Masuk ke aplikasi'),
                              SizedBox(width: 8),
                              Icon(Icons.arrow_forward_rounded, size: 18),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 44),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F3FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.info_outline_rounded,
                        size: 19,
                        color: AppColors.blue,
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Demo: gunakan NIS dan kata sandi yang sudah terisi.',
                          style: TextStyle(fontSize: 12, color: AppColors.blue),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  '© 2026 SMP Nusantara • Bantuan teknis',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 10, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
