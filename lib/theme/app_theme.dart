import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

abstract final class AppColors {
  static const navy = Color(0xFF20213D);
  static const navyLight = Color(0xFF343657);
  static const blue = Color(0xFF6657E8);
  static const blueDark = Color(0xFF5142D8);
  static const blueSoft = Color(0xFFF0EEFF);
  static const background = Color(0xFFF8F8FC);
  static const border = Color(0xFFECECF3);
  static const text = Color(0xFF22233B);
  static const muted = Color(0xFF8B8CA3);
  static const green = Color(0xFF00AE91);
  static const amber = Color(0xFFF0A73B);
  static const red = Color(0xFFED5C5C);
}

abstract final class AppTheme {
  /// Keduanya di-bundle di assets/fonts; lihat bagian `fonts` pada pubspec.yaml.
  static const sansFamily = 'DM Sans';
  static const displayFamily = 'Manrope';

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.blue,
      primary: AppColors.blue,
      surface: Colors.white,
      error: AppColors.red,
    );
    final baseText = ThemeData.light().textTheme.apply(fontFamily: sansFamily);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: sansFamily,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: baseText.copyWith(
        headlineLarge: const TextStyle(
          fontFamily: displayFamily,
          fontSize: 28,
          fontWeight: FontWeight.w800,
          letterSpacing: -1,
          color: AppColors.navy,
        ),
        headlineMedium: const TextStyle(
          fontFamily: displayFamily,
          fontSize: 22,
          fontWeight: FontWeight.w800,
          letterSpacing: -.7,
          color: AppColors.navy,
        ),
        titleLarge: const TextStyle(
          fontFamily: displayFamily,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: AppColors.navy,
        ),
        titleMedium: const TextStyle(
          fontFamily: displayFamily,
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: AppColors.text,
        ),
        bodyMedium: const TextStyle(
          fontFamily: sansFamily,
          fontSize: 14,
          height: 1.45,
          color: AppColors.text,
        ),
        bodySmall: const TextStyle(
          fontFamily: sansFamily,
          fontSize: 12,
          height: 1.4,
          color: AppColors.muted,
        ),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: const TextStyle(
          fontFamily: displayFamily,
          fontSize: 17,
          fontWeight: FontWeight.w800,
          color: AppColors.navy,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 15,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(15),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(15),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(15),
          borderSide: const BorderSide(color: AppColors.blue, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.blue,
          foregroundColor: Colors.white,
          minimumSize: const Size(48, 54),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontFamily: sansFamily,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      dividerColor: AppColors.border,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: _AppPageTransitionBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}

class _AppPageTransitionBuilder extends PageTransitionsBuilder {
  const _AppPageTransitionBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(.035, 0),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      ),
    );
  }
}
