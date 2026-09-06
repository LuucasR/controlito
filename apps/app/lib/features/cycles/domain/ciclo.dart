import 'package:decimal/decimal.dart';

/// Etapa del proceso documental de un período.
///
/// No incluye "pagado" ni "vencido" a propósito: eso no es una etapa del
/// proceso sino una función del saldo y de la fecha, y el servidor lo devuelve
/// aparte ya calculado.
enum EtapaCiclo {
  proyectado('PROJECTED', 'Proyectado'),
  esperandoFactura('AWAITING_INVOICE', 'Esperando factura'),
  facturado('INVOICED', 'Factura recibida'),
  cerrado('CLOSED', 'Cerrado'),
  omitido('SKIPPED', 'No se facturó'),
  cancelado('CANCELLED', 'Cancelado');

  const EtapaCiclo(this.valor, this.etiqueta);
  final String valor;
  final String etiqueta;

  static EtapaCiclo desde(String v) => EtapaCiclo.values.firstWhere(
    (e) => e.valor == v,
    orElse: () => proyectado,
  );
}

/// De dónde sale el monto. Permite distinguir lo real de lo estimado sin
/// tener que adivinarlo desde la interfaz.
enum OrigenMonto {
  facturaReal('REAL_INVOICE'),
  montoFijo('USER_FIXED'),
  estimado('USER_ESTIMATE'),
  ultimaFactura('LAST_INVOICE'),
  desconocido('UNKNOWN');

  const OrigenMonto(this.valor);
  final String valor;

  static OrigenMonto desde(String v) => OrigenMonto.values.firstWhere(
    (e) => e.valor == v,
    orElse: () => desconocido,
  );

  /// Solo el monto de una factura real es un hecho; el resto son estimaciones.
  bool get esReal => this == facturaReal;
}

class Ciclo {
  const Ciclo({
    required this.id,
    required this.serviceId,
    required this.serviceName,
    required this.periodKey,
    required this.periodStart,
    required this.periodEnd,
    required this.etapa,
    required this.origenMonto,
    required this.currency,
    required this.isOverdue,
    this.providerName,
    this.dueDate,
    this.expectedAmount,
    this.daysUntilDue,
  });

  factory Ciclo.desdeJson(Map<String, dynamic> j) => Ciclo(
    id: j['id'] as String,
    serviceId: j['serviceId'] as String,
    serviceName: j['serviceName'] as String,
    providerName: j['providerName'] as String?,
    periodKey: j['periodKey'] as String,
    periodStart: j['periodStart'] as String,
    periodEnd: j['periodEnd'] as String,
    dueDate: j['dueDate'] as String?,
    etapa: EtapaCiclo.desde(j['lifecycle'] as String),
    // El monto llega como texto para no perder precisión.
    expectedAmount: j['expectedAmount'] == null
        ? null
        : Decimal.parse(j['expectedAmount'] as String),
    origenMonto: OrigenMonto.desde(j['expectedAmountSource'] as String),
    currency: j['currency'] as String,
    daysUntilDue: j['daysUntilDue'] as int?,
    isOverdue: j['isOverdue'] as bool? ?? false,
  );

  final String id;
  final String serviceId;
  final String serviceName;
  final String? providerName;
  final String periodKey;
  final String periodStart;
  final String periodEnd;
  final String? dueDate;
  final EtapaCiclo etapa;
  final Decimal? expectedAmount;
  final OrigenMonto origenMonto;
  final String currency;
  final int? daysUntilDue;
  final bool isOverdue;

  /// Texto de cuándo vence, en lenguaje natural.
  String get cuandoVence {
    final dias = daysUntilDue;
    if (dueDate == null || dias == null) return 'Sin fecha de vencimiento';
    if (dias == 0) return 'Vence hoy';
    if (dias == 1) return 'Vence mañana';
    if (dias == -1) return 'Venció ayer';
    return dias > 0 ? 'Vence en $dias días' : 'Venció hace ${-dias} días';
  }

  /// Período legible: "2026-09" se muestra como "Septiembre 2026".
  String get periodoLegible {
    final partes = periodKey.split('-');
    if (partes.length < 2) return periodKey;

    final anio = partes[0];
    final meses = partes[1].split('/');
    final nombres = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];

    String nombre(String mm) {
      final n = int.tryParse(mm);
      return (n != null && n >= 1 && n <= 12) ? nombres[n - 1] : mm;
    }

    return meses.length == 1
        ? '${nombre(meses[0])} $anio'
        : '${nombre(meses[0])}-${nombre(meses[1])} $anio';
  }
}
