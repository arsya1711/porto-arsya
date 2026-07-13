import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract final class AppColors {
  static const navy = Color(0xFF101B35);
  static const navyLight = Color(0xFF1A2B52);
  static const blue = Color(0xFF4B6BFB);
  static const blueDark = Color(0xFF3153E7);
  static const blueSoft = Color(0xFFEEF1FF);
  static const background = Color(0xFFF5F7FB);
  static const border = Color(0xFFE8EBF2);
  static const text = Color(0xFF172033);
  static const muted = Color(0xFF7E879B);
  static const green = Color(0xFF16A879);
  static const amber = Color(0xFFF0A73B);
  static const red = Color(0xFFED5C5C);
}

abstract final class AppTheme {
  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.blue,
      primary: AppColors.blue,
      surface: Colors.white,
      error: AppColors.red,
    );
    final baseText = GoogleFonts.dmSansTextTheme();
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: baseText.copyWith(
        headlineLarge: GoogleFonts.manrope(
          fontSize: 28,
          fontWeight: FontWeight.w800,
          letterSpacing: -1,
          color: AppColors.navy,
        ),
        headlineMedium: GoogleFonts.manrope(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          letterSpacing: -.7,
          color: AppColors.navy,
        ),
        titleLarge: GoogleFonts.manrope(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: AppColors.navy,
        ),
        titleMedium: GoogleFonts.manrope(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: AppColors.text,
        ),
        bodyMedium: GoogleFonts.dmSans(
          fontSize: 14,
          height: 1.45,
          color: AppColors.text,
        ),
        bodySmall: GoogleFonts.dmSans(
          fontSize: 12,
          height: 1.4,
          color: AppColors.muted,
        ),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.manrope(
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
          textStyle: GoogleFonts.dmSans(
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
    );
  }
}
