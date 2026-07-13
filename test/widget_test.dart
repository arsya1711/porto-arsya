import 'package:flutter_test/flutter_test.dart';
import 'package:ujianaw/app.dart';

void main() {
  testWidgets('student can enter the demo application', (tester) async {
    await tester.pumpWidget(const RuangUjianApp());

    expect(find.text('Belajar jujur,\nraih hasil terbaik.'), findsOneWidget);
    expect(find.text('Masuk sekarang'), findsOneWidget);

    await tester.ensureVisible(find.text('Masuk sekarang'));
    await tester.tap(find.text('Masuk sekarang'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Selamat pagi, Alya'), findsOneWidget);
    expect(find.text('Tersedia sekarang'), findsOneWidget);
  });
}
