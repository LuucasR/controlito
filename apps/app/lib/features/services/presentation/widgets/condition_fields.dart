import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/network/api_exception.dart';
import '../../domain/servicio.dart';

/// Estado editable de una condición. Se comparte entre el alta del servicio y
/// el agregado de una condición nueva, para que las dos pantallas pidan
/// exactamente lo mismo y validen igual.
class EstadoCondicion {
  final monto = TextEditingController();
  final motivo = TextEditingController();

  ModoMonto modoMonto = ModoMonto.fijo;
  Frecuencia frecuencia = Frecuencia.mensual;
  ModeloInteres modeloInteres = ModeloInteres.desconocido;
  int? diaVencimiento = 10;

  /// El usuario escribe "25.000,50" y la API espera "25000.50".
  /// En es-AR el punto es separador de miles y la coma es el decimal.
  String? get montoNormalizado {
    final texto = monto.text.trim();
    if (texto.isEmpty) return null;
    return texto.replaceAll('.', '').replaceAll(',', '.');
  }

  bool get pideMonto => modoMonto != ModoMonto.variableDesconocido;

  void dispose() {
    monto.dispose();
    motivo.dispose();
  }
}

/// Campos de una condición: monto, frecuencia, vencimiento e interés.
class CondicionFields extends StatelessWidget {
  const CondicionFields({
    required this.estado,
    required this.habilitado,
    required this.onCambio,
    super.key,
  });

  final EstadoCondicion estado;
  final bool habilitado;
  final VoidCallback onCambio;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<ModoMonto>(
          initialValue: estado.modoMonto,
          decoration: const InputDecoration(
            labelText: 'Tipo de monto',
            prefixIcon: Icon(Icons.payments_outlined),
          ),
          items: ModoMonto.values
              .map(
                (m) => DropdownMenuItem(
                  value: m,
                  child: Text(
                    '${m.etiqueta} · ${m.ayuda}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: habilitado
              ? (v) {
                  estado.modoMonto = v ?? ModoMonto.fijo;
                  onCambio();
                }
              : null,
        ),
        if (estado.pideMonto) ...[
          const SizedBox(height: 16),
          TextFormField(
            controller: estado.monto,
            enabled: habilitado,
            // decimal: true es necesario para que varios teclados de Android
            // muestren la coma; igual se acepta punto o coma al normalizar.
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
            ],
            decoration: InputDecoration(
              labelText: estado.modoMonto == ModoMonto.fijo
                  ? 'Monto'
                  : 'Monto de referencia',
              hintText: '25000',
              prefixText: r'$ ',
              helperText: estado.modoMonto == ModoMonto.fijo
                  ? null
                  : 'Sirve de base para estimar la próxima factura',
            ),
            validator: (v) {
              if (estado.modoMonto != ModoMonto.fijo) return null;
              return (v == null || v.trim().isEmpty)
                  ? 'Indicá cuánto es'
                  : null;
            },
          ),
        ],
        const SizedBox(height: 16),
        DropdownButtonFormField<Frecuencia>(
          initialValue: estado.frecuencia,
          decoration: const InputDecoration(
            labelText: 'Cada cuánto se factura',
            prefixIcon: Icon(Icons.repeat),
          ),
          items: Frecuencia.values
              .map((f) => DropdownMenuItem(value: f, child: Text(f.etiqueta)))
              .toList(),
          onChanged: habilitado
              ? (v) {
                  estado.frecuencia = v ?? Frecuencia.mensual;
                  onCambio();
                }
              : null,
        ),
        if (estado.frecuencia != Frecuencia.sinPeriodicidad) ...[
          const SizedBox(height: 16),
          DropdownButtonFormField<int>(
            initialValue: estado.diaVencimiento,
            decoration: const InputDecoration(
              labelText: 'Día de vencimiento',
              prefixIcon: Icon(Icons.event_outlined),
              helperText: 'Si el mes no tiene ese día, vence el último',
            ),
            items: List.generate(31, (i) => i + 1)
                .map((d) => DropdownMenuItem(value: d, child: Text('Día $d')))
                .toList(),
            onChanged: habilitado
                ? (v) {
                    estado.diaVencimiento = v;
                    onCambio();
                  }
                : null,
          ),
        ],
        const SizedBox(height: 16),
        DropdownButtonFormField<ModeloInteres>(
          initialValue: estado.modeloInteres,
          decoration: const InputDecoration(
            labelText: 'Interés por mora',
            prefixIcon: Icon(Icons.percent),
            helperText: 'Si no lo sabés, dejalo en "No lo sé"',
          ),
          items: ModeloInteres.values
              .map((m) => DropdownMenuItem(value: m, child: Text(m.etiqueta)))
              .toList(),
          onChanged: habilitado
              ? (v) {
                  estado.modeloInteres = v ?? ModeloInteres.desconocido;
                  onCambio();
                }
              : null,
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: estado.motivo,
          enabled: habilitado,
          decoration: const InputDecoration(
            labelText: 'Motivo (opcional)',
            hintText: 'Promoción telefónica, aumento de marzo…',
          ),
        ),
      ],
    );
  }
}

/// Bloque de formulario con título y ayuda opcional.
class SeccionFormulario extends StatelessWidget {
  const SeccionFormulario({
    required this.titulo,
    required this.hijos,
    this.ayuda,
    super.key,
  });

  final String titulo;
  final String? ayuda;
  final List<Widget> hijos;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(titulo, style: theme.textTheme.titleSmall),
            if (ayuda != null) ...[
              const SizedBox(height: 4),
              Text(
                ayuda!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            const SizedBox(height: 16),
            ...hijos,
          ],
        ),
      ),
    );
  }
}

/// Muestra un error de la API con su detalle, que suele traer la acción sugerida.
class BannerErrorApi extends StatelessWidget {
  const BannerErrorApi({required this.error, super.key});

  final ApiException error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.error_outline,
            color: theme.colorScheme.onErrorContainer,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  error.message,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onErrorContainer,
                  ),
                ),
                if (error.detail != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    error.detail!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onErrorContainer,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
