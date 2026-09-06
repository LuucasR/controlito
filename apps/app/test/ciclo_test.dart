import 'package:controlito/features/cycles/domain/ciclo.dart';
import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';

Ciclo ciclo({
  int? dias,
  String? monto,
  String origen = 'USER_FIXED',
  String key = '2026-09',
}) => Ciclo.desdeJson({
  'id': 'c1',
  'serviceId': 's1',
  'serviceName': 'Internet',
  'providerName': 'Movistar',
  'periodKey': key,
  'periodStart': '2026-09-01',
  'periodEnd': '2026-10-01',
  'dueDate': dias == null ? null : '2026-09-10',
  'lifecycle': 'PROJECTED',
  'expectedAmount': monto,
  'expectedAmountSource': origen,
  'currency': 'ARS',
  'daysUntilDue': dias,
  'isOverdue': dias != null && dias < 0,
});

void main() {
  group('Ciclo', () {
    test('traduce el período a lenguaje entendible', () {
      expect(ciclo(dias: 5).periodoLegible, 'Septiembre 2026');
      expect(
        ciclo(dias: 5, key: '2026-09/10').periodoLegible,
        'Septiembre-Octubre 2026',
      );
      expect(ciclo(dias: 5, key: '2026-01').periodoLegible, 'Enero 2026');
    });

    test('describe el vencimiento en lenguaje natural', () {
      expect(ciclo(dias: 0).cuandoVence, 'Vence hoy');
      expect(ciclo(dias: 1).cuandoVence, 'Vence mañana');
      expect(ciclo(dias: 5).cuandoVence, 'Vence en 5 días');
      expect(ciclo(dias: -1).cuandoVence, 'Venció ayer');
      expect(ciclo(dias: -8).cuandoVence, 'Venció hace 8 días');
      expect(ciclo().cuandoVence, 'Sin fecha de vencimiento');
    });

    test('distingue un monto real de uno estimado', () {
      // Solo el de una factura real es un hecho; el resto son estimaciones y
      // la interfaz tiene que mostrarlas distinto.
      expect(ciclo(dias: 5, origen: 'REAL_INVOICE').origenMonto.esReal, isTrue);
      expect(ciclo(dias: 5, origen: 'USER_FIXED').origenMonto.esReal, isFalse);
      expect(
        ciclo(dias: 5, origen: 'USER_ESTIMATE').origenMonto.esReal,
        isFalse,
      );
      expect(ciclo(dias: 5, origen: 'UNKNOWN').origenMonto.esReal, isFalse);
    });

    test('un monto ausente queda nulo, nunca en cero', () {
      // Es lo que permite mostrar "?" en vez de afirmar $0.
      expect(ciclo(dias: 5).expectedAmount, isNull);
      // Se compara el VALOR y no su texto: Decimal normaliza los ceros
      // finales, y el formateo a dos decimales es tarea de la presentacion.
      expect(
        ciclo(dias: 5, monto: '25000.00').expectedAmount,
        Decimal.parse('25000'),
      );
    });
  });
}
