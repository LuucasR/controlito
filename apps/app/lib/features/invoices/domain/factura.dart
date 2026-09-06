import 'package:decimal/decimal.dart';

/// Resultado de comparar lo que llegó contra lo que se esperaba.
class Comparacion {
  const Comparacion({
    required this.esperado,
    required this.diferencia,
    required this.porcentaje,
    required this.direccion,
  });

  factory Comparacion.desdeJson(Map<String, dynamic> j) => Comparacion(
    esperado: j['expectedAmount'] == null
        ? null
        : Decimal.parse(j['expectedAmount'] as String),
    diferencia: j['difference'] == null
        ? null
        : Decimal.parse(j['difference'] as String),
    porcentaje: j['percent'] == null
        ? null
        : Decimal.parse(j['percent'] as String),
    direccion: j['direction'] as String,
  );

  final Decimal? esperado;
  final Decimal? diferencia;
  final Decimal? porcentaje;
  final String direccion;

  bool get hayDiferencia => diferencia != null && diferencia != Decimal.zero;
  bool get esAumento => hayDiferencia && diferencia! > Decimal.zero;
}

class Factura {
  const Factura({
    required this.id,
    required this.cycleId,
    required this.serviceId,
    required this.status,
    required this.issueDate,
    required this.dueDate,
    required this.totalAmount,
    required this.currentChargeAmount,
    required this.includedPriorDebtAmount,
    required this.priorDebtInterestAmount,
    required this.otherChargesAmount,
    required this.isEstimatedByProvider,
    this.externalNumber,
    this.secondDueDate,
    this.notes,
    this.comparacion,
    this.alertas = const [],
  });

  factory Factura.desdeJson(Map<String, dynamic> j) => Factura(
    id: j['id'] as String,
    cycleId: j['cycleId'] as String,
    serviceId: j['serviceId'] as String,
    status: j['status'] as String,
    externalNumber: j['externalNumber'] as String?,
    issueDate: j['issueDate'] as String,
    dueDate: j['dueDate'] as String,
    secondDueDate: j['secondDueDate'] as String?,
    totalAmount: Decimal.parse(j['totalAmount'] as String),
    currentChargeAmount: Decimal.parse(j['currentChargeAmount'] as String),
    includedPriorDebtAmount: Decimal.parse(
      j['includedPriorDebtAmount'] as String,
    ),
    priorDebtInterestAmount: Decimal.parse(
      j['priorDebtInterestAmount'] as String,
    ),
    otherChargesAmount: Decimal.parse(j['otherChargesAmount'] as String),
    isEstimatedByProvider: j['isEstimatedByProvider'] as bool? ?? false,
    notes: j['notes'] as String?,
    comparacion: j['comparison'] == null
        ? null
        : Comparacion.desdeJson(j['comparison'] as Map<String, dynamic>),
    alertas: (j['alerts'] as List<dynamic>? ?? const [])
        .map((a) => AlertaDeFactura.desdeJson(a as Map<String, dynamic>))
        .toList(),
  );

  final String id;
  final String cycleId;
  final String serviceId;
  final String status;
  final String? externalNumber;
  final String issueDate;
  final String dueDate;
  final String? secondDueDate;
  final Decimal totalAmount;
  final Decimal currentChargeAmount;
  final Decimal includedPriorDebtAmount;
  final Decimal priorDebtInterestAmount;
  final Decimal otherChargesAmount;
  final bool isEstimatedByProvider;
  final String? notes;
  final Comparacion? comparacion;
  final List<AlertaDeFactura> alertas;

  bool get anulada => status == 'VOID';

  /// Si la factura arrastra saldo de períodos anteriores.
  bool get traeDeudaAnterior => includedPriorDebtAmount > Decimal.zero;
}

class AlertaDeFactura {
  const AlertaDeFactura({
    required this.tipo,
    required this.severidad,
    required this.titulo,
    required this.mensaje,
  });

  factory AlertaDeFactura.desdeJson(Map<String, dynamic> j) => AlertaDeFactura(
    tipo: j['type'] as String,
    severidad: j['severity'] as String,
    titulo: j['title'] as String,
    mensaje: j['message'] as String,
  );

  final String tipo;
  final String severidad;
  final String titulo;
  final String mensaje;
}
