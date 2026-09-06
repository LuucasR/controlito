import 'package:flutter/material.dart';

import '../../../core/money/money_format.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/ciclo.dart';

/// Fila de un vencimiento.
///
/// Dos reglas de presentación que atraviesan toda la app:
///  - El estado NUNCA se comunica solo por color: siempre lleva ícono y texto.
///  - Un monto estimado se distingue de uno real. Si no hay estimación posible
///    se muestra "?", jamás un cero: afirmar cero sería mentir.
class CycleTile extends StatelessWidget {
  const CycleTile({
    required this.ciclo,
    this.onTap,
    this.mostrarServicio = true,
    super.key,
  });

  final Ciclo ciclo;
  final VoidCallback? onTap;
  final bool mostrarServicio;

  EstadoVisual get _estado {
    if (ciclo.isOverdue) {
      return EstadoVisual.vencido;
    }
    return switch (ciclo.etapa) {
      EtapaCiclo.facturado ||
      EtapaCiclo.esperandoFactura => EstadoVisual.porVerificar,
      EtapaCiclo.cerrado => EstadoVisual.alDia,
      _ => EstadoVisual.estimado,
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final estado = _estado;
    final monto = ciclo.expectedAmount;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 48,
                decoration: BoxDecoration(
                  color: estado.color,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (mostrarServicio)
                      Text(
                        ciclo.providerName == null
                            ? ciclo.serviceName
                            : '${ciclo.providerName} · ${ciclo.serviceName}',
                        style: theme.textTheme.titleSmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    Text(
                      ciclo.periodoLegible,
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(estado.icono, size: 14, color: estado.color),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            ciclo.cuandoVence,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: estado.color,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    monto == null
                        ? MoneyFormat.desconocido
                        : ciclo.origenMonto.esReal
                        ? MoneyFormat.formatear(monto)
                        : MoneyFormat.estimado(monto.toString()),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  if (ciclo.dueDate != null)
                    Text(
                      _fechaCorta(ciclo.dueDate!),
                      style: theme.textTheme.bodySmall,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// "2026-09-10" se muestra como "10/09".
  static String _fechaCorta(String iso) {
    final p = iso.split('-');
    return p.length == 3 ? '${p[2]}/${p[1]}' : iso;
  }
}
