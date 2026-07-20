import 'dart:io';

import 'package:awexam/theme/app_theme.dart';
import 'package:flutter_test/flutter_test.dart';

/// Nama family yang tidak cocok tidak memunculkan error apa pun: Flutter diam-diam
/// jatuh ke Roboto. Test ini mengikat konstanta tema ke deklarasi di pubspec.yaml.
void main() {
  final pubspec = File('pubspec.yaml').readAsStringSync();
  final declaredFamilies = RegExp(
    r'^\s*- family:\s*(.+)$',
    multiLine: true,
  ).allMatches(pubspec).map((match) => match.group(1)!.trim()).toSet();

  test('bundles every font family the theme refers to', () {
    expect(declaredFamilies, contains(AppTheme.sansFamily));
    expect(declaredFamilies, contains(AppTheme.displayFamily));
  });

  // Keberadaan file font tidak perlu diuji: aset yang hilang sudah menggagalkan
  // `flutter build`/`flutter test` pada tahap asset bundle.

  test('uses the bundled families in the text theme', () {
    final textTheme = AppTheme.light.textTheme;

    expect(textTheme.headlineLarge?.fontFamily, AppTheme.displayFamily);
    expect(textTheme.titleMedium?.fontFamily, AppTheme.displayFamily);
    expect(textTheme.bodyMedium?.fontFamily, AppTheme.sansFamily);
    // Gaya yang tidak ditimpa tetap harus mewarisi font bundel, bukan Roboto.
    expect(textTheme.labelLarge?.fontFamily, AppTheme.sansFamily);
  });
}
