import 'package:decimal/decimal.dart';

/// Con qué criterio se conoce el monto de un servicio.
enum ModoMonto {
  fijo('FIXED', 'Monto fijo', 'Siempre sale lo mismo'),
  variableEstimado(
    'VARIABLE_ESTIMATED',
    'Variable',
    'Cambia, pero se puede estimar',
  ),
  variableDesconocido(
    'VARIABLE_UNKNOWN',
    'No estimable',
    'Cambia y no se puede estimar',
  );

  const ModoMonto(this.valor, this.etiqueta, this.ayuda);
  final String valor;
  final String etiqueta;
  final String ayuda;

  static ModoMonto desde(String v) => ModoMonto.values.firstWhere(
    (e) => e.valor == v,
    orElse: () => variableEstimado,
  );
}

enum Frecuencia {
  mensual('MONTHLY', 'Mensual'),
  bimestral('BIMONTHLY', 'Bimestral'),
  trimestral('QUARTERLY', 'Trimestral'),
  semestral('SEMIANNUAL', 'Semestral'),
  anual('ANNUAL', 'Anual'),
  quincenal('BIWEEKLY', 'Quincenal'),
  semanal('WEEKLY', 'Semanal'),
  sinPeriodicidad('ON_DEMAND', 'Sin periodicidad fija');

  const Frecuencia(this.valor, this.etiqueta);
  final String valor;
  final String etiqueta;

  static Frecuencia desde(String v) =>
      Frecuencia.values.firstWhere((e) => e.valor == v, orElse: () => mensual);
}

/// Qué pasa con una deuda impaga. No se asume ninguna: el valor por defecto es
/// "no se sabe", y la app no proyecta arrastre hasta que el usuario lo defina.
enum PoliticaDeuda {
  seAcumula('ACCUMULATES_INTO_NEXT_INVOICE', 'Se suma a la próxima factura'),
  aparte('PAID_SEPARATELY', 'Se paga por separado'),
  cortan('NO_DEBT_SERVICE_CUT', 'No hay deuda: cortan el servicio'),
  desconocida('UNKNOWN', 'No lo sé');

  const PoliticaDeuda(this.valor, this.etiqueta);
  final String valor;
  final String etiqueta;

  static PoliticaDeuda desde(String v) => PoliticaDeuda.values.firstWhere(
    (e) => e.valor == v,
    orElse: () => desconocida,
  );
}

enum ModeloInteres {
  ninguno('NONE', 'Sin interés'),
  mensual('MONTHLY_PERCENT', 'Porcentaje mensual'),
  diario('DAILY_PERCENT', 'Porcentaje diario'),
  fijo('FIXED_FEE', 'Recargo fijo'),
  desconocido('UNKNOWN', 'No lo sé');

  const ModeloInteres(this.valor, this.etiqueta);
  final String valor;
  final String etiqueta;

  static ModeloInteres desde(String v) => ModeloInteres.values.firstWhere(
    (e) => e.valor == v,
    orElse: () => desconocido,
  );
}

enum EstadoServicio {
  activo('ACTIVE', 'Activo'),
  pausado('PAUSED', 'Pausado'),
  dadoDeBaja('CANCELLED', 'Dado de baja');

  const EstadoServicio(this.valor, this.etiqueta);
  final String valor;
  final String etiqueta;

  static EstadoServicio desde(String v) => EstadoServicio.values.firstWhere(
    (e) => e.valor == v,
    orElse: () => activo,
  );
}

class Categoria {
  const Categoria({
    required this.id,
    required this.name,
    required this.slug,
    this.icon,
    this.color,
  });

  factory Categoria.desdeJson(Map<String, dynamic> j) => Categoria(
    id: j['id'] as String,
    name: j['name'] as String,
    slug: j['slug'] as String,
    icon: j['icon'] as String?,
    color: j['color'] as String?,
  );

  final String id;
  final String name;
  final String slug;
  final String? icon;
  final String? color;
}

/// Condiciones pactadas durante un tramo de tiempo.
///
/// `validTo` nulo significa que sigue vigente. Las condiciones no se
/// sobrescriben: al cambiar, la anterior queda cerrada y se crea una nueva, de
/// modo que siempre se puede saber qué regía en cada período.
class Condicion {
  const Condicion({
    required this.id,
    required this.validFrom,
    required this.validTo,
    required this.amountMode,
    required this.frequency,
    required this.interestModel,
    this.baseAmount,
    this.dueDayOfMonth,
    this.secondDueDayOfMonth,
    this.changeReason,
    this.notes,
  });

  factory Condicion.desdeJson(Map<String, dynamic> j) => Condicion(
    id: j['id'] as String,
    validFrom: j['validFrom'] as String,
    validTo: j['validTo'] as String?,
    amountMode: ModoMonto.desde(j['amountMode'] as String),
    frequency: Frecuencia.desde(j['frequency'] as String),
    interestModel: ModeloInteres.desde(j['interestModel'] as String),
    // El monto llega como texto: convertirlo a double perdería precisión.
    baseAmount: j['baseAmount'] == null
        ? null
        : Decimal.parse(j['baseAmount'] as String),
    dueDayOfMonth: j['dueDayOfMonth'] as int?,
    secondDueDayOfMonth: j['secondDueDayOfMonth'] as int?,
    changeReason: j['changeReason'] as String?,
    notes: j['notes'] as String?,
  );

  final String id;
  final String validFrom;
  final String? validTo;
  final ModoMonto amountMode;
  final Frecuencia frequency;
  final ModeloInteres interestModel;
  final Decimal? baseAmount;
  final int? dueDayOfMonth;
  final int? secondDueDayOfMonth;
  final String? changeReason;
  final String? notes;

  bool get vigente => validTo == null;
}

class Servicio {
  const Servicio({
    required this.id,
    required this.name,
    required this.status,
    required this.currency,
    required this.startDate,
    required this.debtPolicy,
    required this.archived,
    this.providerName,
    this.accountNumber,
    this.notes,
    this.endDate,
    this.autoDebit = false,
    this.category,
    this.currentCondition,
    this.conditions = const [],
  });

  factory Servicio.desdeJson(Map<String, dynamic> j) => Servicio(
    id: j['id'] as String,
    name: j['name'] as String,
    providerName: j['providerName'] as String?,
    accountNumber: j['accountNumber'] as String?,
    notes: j['notes'] as String?,
    status: EstadoServicio.desde(j['status'] as String),
    currency: j['currency'] as String,
    startDate: j['startDate'] as String,
    endDate: j['endDate'] as String?,
    autoDebit: j['autoDebit'] as bool? ?? false,
    debtPolicy: PoliticaDeuda.desde(j['debtPolicy'] as String),
    archived: j['archived'] as bool? ?? false,
    category: j['category'] == null
        ? null
        : Categoria.desdeJson({
            ...j['category'] as Map<String, dynamic>,
            'slug': (j['category'] as Map<String, dynamic>)['slug'] ?? '',
          }),
    currentCondition: j['currentCondition'] == null
        ? null
        : Condicion.desdeJson(j['currentCondition'] as Map<String, dynamic>),
    conditions: (j['conditions'] as List<dynamic>? ?? const [])
        .map((c) => Condicion.desdeJson(c as Map<String, dynamic>))
        .toList(),
  );

  final String id;
  final String name;
  final String? providerName;
  final String? accountNumber;
  final String? notes;
  final EstadoServicio status;
  final String currency;
  final String startDate;
  final String? endDate;
  final bool autoDebit;
  final PoliticaDeuda debtPolicy;
  final bool archived;
  final Categoria? category;
  final Condicion? currentCondition;
  final List<Condicion> conditions;

  /// "Movistar · Internet Fibra 600 MB", o solo el nombre si no hay empresa.
  String get titulo => providerName == null ? name : '$providerName · $name';
}
