import 'package:controlito/features/invoices/domain/factura.dart';
import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';

Factura factura({
  String consumo = '25000.00',
  String deuda = '0.00',
  String intereses = '0.00',
  Map<String, dynamic>? comparacion,
}) {
  final total =
      Decimal.parse(consumo) + Decimal.parse(deuda) + Decimal.parse(intereses);

  return Factura.desdeJson({
    'id': 'f1',
    'cycleId': 'c1',
    'serviceId': 's1',
    'status': 'ISSUED',
    'externalNumber': null,
    'issueDate': '2026-09-01',
    'dueDate': '2026-09-10',
    'secondDueDate': null,
    'totalAmount': total.toString(),
    'currentChargeAmount': consumo,
    'includedPriorDebtAmount': deuda,
    'priorDebtInterestAmount': intereses,
    'otherChargesAmount': '0.00',
    'isEstimatedByProvider': false,
    'notes': null,
    'comparison': comparacion,
    'alerts': const [],
  });
}

void main() {
  group('Factura', () {
    test('el total es la suma de sus partes', () {
      final f = factura(
        consumo: '25000.00',
        deuda: '10000.00',
        intereses: '500.00',
      );
      expect(f.totalAmount, Decimal.parse('35500'));
      expect(f.traeDeudaAnterior, isTrue);
    });

    test('una factura sin deuda no marca arrastre', () {
      expect(factura().traeDeudaAnterior, isFalse);
    });
  });

  group('Comparacion', () {
    test('reconoce un aumento', () {
      final f = factura(
        consumo: '32500.00',
        comparacion: {
          'expectedAmount': '25000.00',
          'difference': '7500.00',
          'percent': '30.00',
          'direction': 'AMOUNT_INCREASE',
        },
      );

      expect(f.comparacion!.hayDiferencia, isTrue);
      expect(f.comparacion!.esAumento, isTrue);
      expect(f.comparacion!.diferencia, Decimal.parse('7500'));
    });

    test('reconoce una baja', () {
      final f = factura(
        consumo: '20000.00',
        comparacion: {
          'expectedAmount': '25000.00',
          'difference': '-5000.00',
          'percent': '-20.00',
          'direction': 'AMOUNT_DECREASE',
        },
      );

      expect(f.comparacion!.hayDiferencia, isTrue);
      expect(f.comparacion!.esAumento, isFalse);
    });

    test('sin diferencia no reporta cambio', () {
      final f = factura(
        comparacion: {
          'expectedAmount': '25000.00',
          'difference': '0.00',
          'percent': '0.00',
          'direction': 'SIN_CAMBIO_RELEVANTE',
        },
      );

      expect(f.comparacion!.hayDiferencia, isFalse);
    });

    test('una factura con deuda no reporta aumento del consumo', () {
      // El caso del plan: 25.000 de consumo mas 10.500 de arrastre. El total es
      // 42% mayor, pero la tarifa no cambio.
      final f = factura(
        consumo: '25000.00',
        deuda: '10000.00',
        intereses: '500.00',
        comparacion: {
          'expectedAmount': '25000.00',
          'difference': '0.00',
          'percent': '0.00',
          'direction': 'SIN_CAMBIO_RELEVANTE',
        },
      );

      expect(f.totalAmount, Decimal.parse('35500'));
      expect(f.comparacion!.hayDiferencia, isFalse);
      expect(f.traeDeudaAnterior, isTrue);
    });
  });
}
