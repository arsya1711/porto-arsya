import 'package:flutter/material.dart';

import 'data/demo_repository.dart';
import 'data/exam_repository.dart';
import 'state/app_controller.dart';
import 'theme/app_theme.dart';
import 'ui/home_shell.dart';
import 'ui/login_screen.dart';

class RuangUjianApp extends StatefulWidget {
  const RuangUjianApp({super.key, this.repository});

  final ExamRepository? repository;

  @override
  State<RuangUjianApp> createState() => _RuangUjianAppState();
}

class _RuangUjianAppState extends State<RuangUjianApp> {
  late final AppController controller;

  @override
  void initState() {
    super.initState();
    controller = AppController(widget.repository ?? DemoRepository());
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Ruang Ujian Siswa',
      theme: AppTheme.light,
      home: ListenableBuilder(
        listenable: controller,
        builder: (context, _) => controller.isLoggedIn
            ? HomeShell(controller: controller)
            : LoginScreen(controller: controller),
      ),
    );
  }
}
