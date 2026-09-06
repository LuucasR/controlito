import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money/money_format.dart';
import 'domain/servicio.dart';
import 'presentation/providers/services_providers.dart';

class ServicesScreen extends ConsumerWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicios = ref.watch(serviciosProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Servicios'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            onPressed: () => ref.invalidate(serviciosProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/servicios/nuevo'),
        icon: const Icon(Icons.add),
        label: const Text('Nuevo servicio'),
      ),
      body: servicios.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _Error(
          mensaje: '$e',
          reintentar: () => ref.invalidate(serviciosProvider),
        ),
        data: (lista) => lista.isEmpty
            ? const _SinServicios()
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(serviciosProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _TarjetaServicio(servicio: lista[i]),
                ),
              ),
      ),
    );
  }
}

class _TarjetaServicio extends StatelessWidget {
  const _TarjetaServicio({required this.servicio});

  final Servicio servicio;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final condicion = servicio.currentCondition;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.go('/servicios/${servicio.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(servicio.name, style: theme.textTheme.titleMedium),
                        if (servicio.providerName != null)
                          Text(
                            servicio.providerName!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (servicio.category != null)
                    Chip(
                      label: Text(servicio.category!.name),
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _MontoEsperado(condicion: condicion)),
                  if (condicion?.dueDayOfMonth != null)
                    _Dato(
                      icono: Icons.event_outlined,
                      texto: 'Vence el ${condicion!.dueDayOfMonth}',
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Muestra el monto que se espera para el próximo período.
///
/// Cuando el servicio es de monto variable y no se puede estimar, muestra "?"
/// y NO un cero: afirmar que va a salir $0 sería mentir sobre el número más
/// importante de la aplicación.
class _MontoEsperado extends StatelessWidget {
  const _MontoEsperado({required this.condicion});

  final Condicion? condicion;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (condicion == null) {
      return Text(
        'Sin condiciones cargadas',
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.error,
        ),
      );
    }

    final monto = condicion!.baseAmount;
    final esEstimado = condicion!.amountMode != ModoMonto.fijo;

    if (monto == null) {
      return Row(
        children: [
          Text(MoneyFormat.desconocido, style: theme.textTheme.titleMedium),
          const SizedBox(width: 6),
          Text('sin estimación', style: theme.textTheme.bodySmall),
        ],
      );
    }

    return Row(
      children: [
        Text(
          esEstimado
              ? MoneyFormat.estimado(monto.toString())
              : MoneyFormat.formatear(monto),
          style: theme.textTheme.titleMedium?.copyWith(
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(width: 6),
        Text(
          condicion!.frequency.etiqueta.toLowerCase(),
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.icono, required this.texto});

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icono,
          size: 16,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: 4),
        Text(texto, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _SinServicios extends StatelessWidget {
  const _SinServicios();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.receipt_long_outlined,
                size: 56,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                'Todavía no cargaste servicios',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Empezá por uno que pagues todos los meses, con el monto y el día '
                'de vencimiento que tenés pactados. Con eso la app va a poder '
                'avisarte si una factura viene distinta de lo acordado.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.mensaje, required this.reintentar});

  final String mensaje;
  final VoidCallback reintentar;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.cloud_off_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 12),
            Text(mensaje, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: reintentar,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}
