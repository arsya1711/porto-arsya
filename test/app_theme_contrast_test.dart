import 'dart:math' as math;

import 'package:awexam/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

double _relativeLuminance(Color color) {
  double linearize(int component) {
    final value = component / 255;
    return value <= 0.04045
        ? value / 12.92
        : math.pow((value + 0.055) / 1.055, 2.4).toDouble();
  }

  final argb = color.toARGB32();
  return 0.2126 * linearize((argb >> 16) & 0xff) +
      0.7152 * linearize((argb >> 8) & 0xff) +
      0.0722 * linearize(argb & 0xff);
}

double _contrastRatio(Color first, Color second) {
  final firstLuminance = _relativeLuminance(first);
  final secondLuminance = _relativeLuminance(second);
  final lighter = firstLuminance > secondLuminance
      ? firstLuminance
      : secondLuminance;
  final darker = firstLuminance > secondLuminance
      ? secondLuminance
      : firstLuminance;
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  test('semantic text colors retain accessible contrast on light surfaces', () {
    const semanticTextColors = [
      AppColors.blue,
      AppColors.muted,
      AppColors.green,
      AppColors.amber,
      AppColors.red,
    ];
    const surfaces = [Colors.white, AppColors.background];

    for (final color in semanticTextColors) {
      for (final surface in surfaces) {
        expect(
          _contrastRatio(color, surface),
          greaterThanOrEqualTo(4.5),
          reason:
              '${color.toARGB32().toRadixString(16)} tidak cukup kontras '
              'terhadap ${surface.toARGB32().toRadixString(16)}',
        );
      }
    }
  });
}
