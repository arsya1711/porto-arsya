import 'dart:convert';

class StudentLoginResponse {
  const StudentLoginResponse({
    required this.refreshToken,
    required this.fullName,
    required this.studentNumber,
    required this.className,
  });

  final String refreshToken;
  final String fullName;
  final String studentNumber;
  final String className;
}

StudentLoginResponse parseStudentLoginResponse(
  Object? raw, {
  required String fallbackStudentNumber,
}) {
  final decoded = raw is String ? jsonDecode(raw) : raw;
  if (decoded is! Map) {
    throw const FormatException('Respons login bukan objek JSON.');
  }

  final root = Map<String, dynamic>.from(decoded);
  final rawSession = root['session'];
  final rawProfile = root['profile'];
  if (rawSession is! Map || rawProfile is! Map) {
    throw const FormatException(
      'Respons login tidak memiliki session/profile.',
    );
  }

  final session = Map<String, dynamic>.from(rawSession);
  final profile = Map<String, dynamic>.from(rawProfile);
  final refreshToken = _nonEmptyString(session['refresh_token']);
  if (refreshToken == null) {
    throw const FormatException('Refresh token tidak tersedia.');
  }

  return StudentLoginResponse(
    refreshToken: refreshToken,
    fullName: _nonEmptyString(profile['full_name']) ?? 'Siswa',
    studentNumber:
        _nonEmptyString(profile['student_number']) ?? fallbackStudentNumber,
    className: _nonEmptyString(profile['class_name']) ?? '-',
  );
}

String? functionErrorMessage(Object? details) {
  Object? decoded = details;
  if (details is String) {
    try {
      decoded = jsonDecode(details);
    } on FormatException {
      return null;
    }
  }
  if (decoded is! Map) return null;

  final error = decoded['error'];
  return _nonEmptyString(error);
}

String? _nonEmptyString(Object? value) {
  if (value is! String) return null;
  final normalized = value.trim();
  return normalized.isEmpty ? null : normalized;
}
