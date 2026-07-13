import 'package:flutter_test/flutter_test.dart';
import 'package:ujianaw/app.dart';

void main() {
  testWidgets('student can enter the demo application', (tester) async {
    await tester.pumpWidget(const RuangUjianApp());

    expect(find.text('Selamat datang!'), findsOneWidget);
    expect(find.text('Masuk ke aplikasi'), findsOneWidget);

    await tester.tap(find.text('Masuk ke aplikasi'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Halo, Alya'), findsOneWidget);
    expect(find.text('Tersedia sekarang'), findsOneWidget);
  });
}
