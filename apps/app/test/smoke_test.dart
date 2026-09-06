import 'package:controlito/core/money/money_format.dart';
import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_AR');
  });

  group('MoneyFormat', () {
    test('formatea en es-AR: punto de miles y coma decimal', () {
      expect(MoneyFormat.desdeJson('35500.00'), contains('35.500,00'));
      expect(MoneyFormat.desdeJson('1234.56'), contains('1.234,56'));
    });

    test('marca los montos estimados para no confundirlos con reales', () {
      expect(MoneyFormat.estimado('35500.00'), startsWith('≈'));
    });

    test('el desconocido es "?" y nunca cero', () {
      expect(MoneyFormat.desconocido, '?');
      expect(MoneyFormat.desconocido, isNot(contains('0')));
    });

    test('acepta Decimal sin perder precision', () {
      expect(
        MoneyFormat.formatear(Decimal.parse('10000') * Decimal.parse('0.05')),
        contains('500,00'),
      );
    });
  });
}
