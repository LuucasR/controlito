import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';

enum SeveridadAlerta {
  critica('CRITICAL', 'Importante', Icons.priority_high, Color(0xFFC62828)),
  advertencia(
    'WARNING',
    'Atención',
    Icons.warning_amber_outlined,
    Color(0xFFEF6C00),
  ),
  informativa('INFO', 'Aviso', Icons.info_outline, Color(0xFF1565C0));

  const SeveridadAlerta(this.valor, this.etiqueta, this.icono, this.color);
  final String valor;
  final String etiqueta;
  final IconData icono;
  final Color color;

  static SeveridadAlerta desde(String v) => SeveridadAlerta.values.firstWhere(
    (e) => e.valor == v,
    orElse: () => informativa,
  );
}

class Alerta {
  const Alerta({
    required this.id,
    required this.tipo,
    required this.severidad,
    required this.estado,
    required this.titulo,
    required this.mensaje,
    required this.detectadaEl,
    this.serviceId,
    this.baseline,
    this.observado,
    this.diferencia,
    this.porcentaje,
  });

  factory Alerta.desdeJson(Map<String, dynamic> j) => Alerta(
    id: j['id'] as String,
    serviceId: j['serviceId'] as String?,
    tipo: j['type'] as String,
    severidad: SeveridadAlerta.desde(j['severity'] as String),
    estado: j['status'] as String,
    titulo: j['title'] as String,
    mensaje: j['message'] as String,
    detectadaEl: j['detectedOn'] as String,
    // La evidencia numérica llega como texto, igual que todo el dinero.
    baseline: j['baselineValue'] == null
        ? null
        : Decimal.parse(j['baselineValue'] as String),
    observado: j['observedValue'] == null
        ? null
        : Decimal.parse(j['observedValue'] as String),
    diferencia: j['deltaAbsolute'] == null
        ? null
        : Decimal.parse(j['deltaAbsolute'] as String),
    porcentaje: j['deltaPercent'] == null
        ? null
        : Decimal.parse(j['deltaPercent'] as String),
  );

  final String id;
  final String? serviceId;
  final String tipo;
  final SeveridadAlerta severidad;
  final String estado;
  final String titulo;
  final String mensaje;
  final String detectadaEl;
  final Decimal? baseline;
  final Decimal? observado;
  final Decimal? diferencia;
  final Decimal? porcentaje;

  bool get vista => estado != 'NEW';

  /// Si tiene los números que respaldan la detección.
  bool get tieneEvidencia => baseline != null && observado != null;
}
