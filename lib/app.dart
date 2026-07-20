import 'dart:async';

import 'package:flutter/material.dart';

import 'data/attempt_draft_store.dart';
import 'data/demo_repository.dart';
import 'data/exam_repository.dart';
import 'state/app_controller.dart';
import 'theme/app_theme.dart';
import 'ui/home_shell.dart';
import 'ui/login_screen.dart';
import 'ui/update_required_screen.dart';

class AWExamApp extends StatefulWidget {
  const AWExamApp({
    super.key,
    this.repository,
    this.draftStore,
    this.currentVersion,
  });

  final ExamRepository? repository;
  final AttemptDraftStore? draftStore;
  final String? currentVersion;

  @override
  State<AWExamApp> createState() => _AWExamAppState();
}

class _AWExamAppState extends State<AWExamApp> {
  late final AppController controller;

  @override
  void initState() {
    super.initState();
    controller = AppController(
      widget.repository ?? DemoRepository(),
      draftStore: widget.draftStore,
      currentVersion: widget.currentVersion,
    );
    unawaited(controller.initialize());
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
      title: 'AWExam',
      theme: AppTheme.light,
      home: ListenableBuilder(
        listenable: controller,
        builder: (context, _) {
          if (controller.isInitializing) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (controller.updateRequired) {
            return UpdateRequiredScreen(
              currentVersion: widget.currentVersion ?? '-',
              minimumVersion: controller.minimumVersion,
            );
          }
          return controller.isLoggedIn
              ? HomeShell(controller: controller)
              : LoginScreen(controller: controller);
        },
      ),
    );
  }
}
