enum ExamState { available, upcoming, completed, inProgress, expired }

enum QuestionType { multipleChoice, essay }

class StudentProfile {
  const StudentProfile({
    required this.name,
    required this.studentNumber,
    required this.className,
    required this.school,
  });
  final String name;
  final String studentNumber;
  final String className;
  final String school;
}

class Exam {
  const Exam({
    required this.id,
    required this.title,
    required this.subject,
    required this.subjectCode,
    required this.teacher,
    required this.schedule,
    required this.durationMinutes,
    required this.questionCount,
    required this.state,
    required this.instructions,
    this.score,
    this.requiresCode = false,
    this.lockdown = true,
    this.allowBackwardNavigation = true,
  });

  final String id;
  final String title;
  final String subject;
  final String subjectCode;
  final String teacher;
  final DateTime schedule;
  final int durationMinutes;
  final int questionCount;
  final ExamState state;
  final List<String> instructions;
  final double? score;
  final bool requiresCode;
  final bool lockdown;
  final bool allowBackwardNavigation;
}

class ExamQuestion {
  const ExamQuestion({
    required this.id,
    required this.type,
    required this.body,
    this.options = const [],
  });
  final String id;
  final QuestionType type;
  final String body;
  final List<String> options;
}

class ExamSession {
  const ExamSession({
    required this.attemptId,
    required this.startedAt,
    required this.deadline,
    required this.questions,
    this.savedAnswers = const {},
  });

  final String attemptId;
  final DateTime startedAt;
  final DateTime deadline;
  final List<ExamQuestion> questions;
  final Map<String, String> savedAnswers;
}
