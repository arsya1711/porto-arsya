import 'package:flutter/services.dart';

/// Mengaktifkan perlindungan tangkapan layar hanya pada layar yang sensitif.
class ScreenSecurity {
  ScreenSecurity._();

  static const _channel = MethodChannel('awexam/security');

  static Future<void> setSecure(bool enabled) async {
    try {
      await _channel.invokeMethod<void>('setSecure', enabled);
    } on MissingPluginException {
      // Platform selain Android atau test runner tidak memasang channel ini.
    } on PlatformException {
      // Proteksi layar tidak boleh membuat ruang ujian gagal dibuka.
    }
  }
}
