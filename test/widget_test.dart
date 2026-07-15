import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ujianaw/app.dart';

void main() {
  testWidgets('student can enter the demo application', (tester) async {
    await tester.pumpWidget(const RuangUjianApp());

    expect(find.text('Halo, selamat datang 👋'), findsOneWidget);

    await tester.enterText(find.byType(TextField).at(0), '24001');
    await tester.enterText(find.byType(TextField).at(1), 'siswa123');

    await tester.scrollUntilVisible(
      find.text('Masuk ke aplikasi'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Masuk ke aplikasi'));
    await tester.pumpAndSettle();

    expect(find.text('Ujian kamu'), findsOneWidget);
    expect(find.text('Ujian aktif'), findsOneWidget);
  });
}
