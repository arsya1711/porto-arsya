import 'package:flutter/material.dart';

import '../state/app_controller.dart';
import '../theme/app_theme.dart';

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
      backgroundColor: Colors.white,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 18, 24, 28),
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.blue,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: const Icon(
                    Icons.school_rounded,
                    size: 21,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 11),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'RuangUjian',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.text,
                        ),
                      ),
                      Text(
                        'SMP Nusantara',
                        style: TextStyle(fontSize: 9, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.help_outline_rounded, size: 16),
                  label: const Text('Bantuan', style: TextStyle(fontSize: 10)),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const _LoginArtwork(),
            const SizedBox(height: 28),
            Text(
              'Halo, selamat datang 👋',
              style: Theme.of(
                context,
              ).textTheme.headlineLarge?.copyWith(fontSize: 26),
            ),
            const SizedBox(height: 7),
            const Text(
              'Masuk untuk melihat jadwal dan mulai ujianmu.',
              style: TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            const SizedBox(height: 24),
            const _FieldTitle('Nomor induk siswa'),
            const SizedBox(height: 8),
            TextField(
              controller: username,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
                hintText: 'Masukkan NIS',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Expanded(child: _FieldTitle('Kata sandi')),
                TextButton(
                  onPressed: () {},
                  child: const Text(
                    'Lupa kata sandi?',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
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
                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                hintText: 'Masukkan kata sandi',
                suffixIcon: IconButton(
                  onPressed: () => setState(() => obscure = !obscure),
                  icon: Icon(
                    obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    size: 19,
                  ),
                ),
              ),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 9),
                child: Text(
                  error!,
                  style: const TextStyle(color: AppColors.red, fontSize: 11),
                ),
              ),
            const SizedBox(height: 22),
            ListenableBuilder(
              listenable: widget.controller,
              builder: (_, _) => ElevatedButton(
                onPressed: widget.controller.isAuthenticating ? null : submit,
                child: widget.controller.isAuthenticating
                    ? const SizedBox(
                        width: 21,
                        height: 21,
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
            const SizedBox(height: 18),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.verified_user_outlined,
                  color: AppColors.green,
                  size: 15,
                ),
                SizedBox(width: 6),
                Text(
                  'Akses aman dan terenkripsi',
                  style: TextStyle(color: AppColors.muted, fontSize: 9),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldTitle extends StatelessWidget {
  const _FieldTitle(this.text);
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

class _LoginArtwork extends StatelessWidget {
  const _LoginArtwork();
  @override
  Widget build(BuildContext context) => Container(
    height: 190,
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFF0EEFF), Color(0xFFE5F9F5)],
      ),
      borderRadius: BorderRadius.circular(28),
    ),
    child: Stack(
      alignment: Alignment.center,
      children: [
        Positioned(
          left: 24,
          top: 25,
          child: _bubble(Icons.check_rounded, AppColors.green, 38),
        ),
        Positioned(
          right: 28,
          bottom: 28,
          child: _bubble(Icons.timer_outlined, AppColors.blue, 42),
        ),
        Positioned(
          right: 42,
          top: 22,
          child: Container(
            width: 9,
            height: 9,
            decoration: const BoxDecoration(
              color: AppColors.amber,
              shape: BoxShape.circle,
            ),
          ),
        ),
        Positioned(
          left: 53,
          bottom: 24,
          child: Container(
            width: 7,
            height: 7,
            decoration: const BoxDecoration(
              color: AppColors.blue,
              shape: BoxShape.circle,
            ),
          ),
        ),
        Transform.rotate(
          angle: -.045,
          child: Container(
            width: 132,
            height: 130,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(25),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x196657E8),
                  blurRadius: 25,
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
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.blueSoft,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.edit_note_rounded,
                        color: AppColors.blue,
                        size: 20,
                      ),
                    ),
                    const Spacer(),
                    const Icon(
                      Icons.more_horiz_rounded,
                      color: AppColors.muted,
                      size: 18,
                    ),
                  ],
                ),
                const Spacer(),
                Container(
                  height: 7,
                  width: 80,
                  decoration: BoxDecoration(
                    color: AppColors.navy,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  height: 5,
                  width: 58,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 12),
                const Row(
                  children: [
                    Icon(
                      Icons.check_circle_rounded,
                      size: 16,
                      color: AppColors.green,
                    ),
                    SizedBox(width: 5),
                    Text(
                      'Siap',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w700,
                        color: AppColors.green,
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
  );

  static Widget _bubble(IconData icon, Color color, double size) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: Colors.white,
      shape: BoxShape.circle,
      boxShadow: const [
        BoxShadow(
          color: Color(0x10101B35),
          blurRadius: 12,
          offset: Offset(0, 5),
        ),
      ],
    ),
    child: Icon(icon, size: size * .48, color: color),
  );
}
