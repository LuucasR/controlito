import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money/money_format.dart';
import '../auth/domain/session.dart';
import '../auth/presentation/providers/auth_controller.dart';
import '../cycles/domain/ciclo.dart';
import '../cycles/presentation/cycle_tile.dart';
import '../cycles/presentation/cycles_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final proximos = ref.watch(proximosVencimientosProvider);
    final saludo = auth is AuthConSesion
        ? 'Hola, ${auth.usuario.nombreVisible}'
        : 'Controlito';

    return Scaffold(
      appBar: AppBar(
        title: Text(saludo),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            onPressed: () => ref.invalidate(proximosVencimientosProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(proximosVencimientosProvider),
        child: proximos.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _Error(
            mensaje: '$e',
            reintentar: () => ref.invalidate(proximosVencimientosProvider),
          ),
          data: (ciclos) => _Contenido(ciclos: ciclos),
        ),
      ),
    );
  }
}

class _Contenido extends StatelessWidget {
  const _Contenido({required this.ciclos});

  final List<Ciclo> ciclos;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (ciclos.isEmpty) return const _SinVencimientos();

    final vencidos = ciclos.where((c) => c.isOverdue).toList();
    final porVencer = ciclos.where((c) => !c.isOverdue).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Resumen(ciclos: ciclos),
        if (vencidos.isNotEmpty) ...[
          const SizedBox(height: 24),
          Row(
            children: [
              Icon(
                Icons.error_outline,
                size: 18,
                color: theme.colorScheme.error,
              ),
              const SizedBox(width: 6),
              Text(
                'Vencidos',
                style: theme.textTheme.titleMedium?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...vencidos.map(
            (c) => CycleTile(ciclo: c, onTap: () => _abrir(context, c)),
          ),
        ],
        const SizedBox(height: 24),
        Text('Próximos vencimientos', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        if (porVencer.isEmpty)
          const Card(
            child: ListTile(
              leading: Icon(Icons.check_circle_outline),
              title: Text('No hay vencimientos próximos'),
            ),
          )
        else
          ...porVencer.map(
            (c) => CycleTile(ciclo: c, onTap: () => _abrir(context, c)),
          ),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Qué falta', style: theme.textTheme.titleSmall),
                const SizedBox(height: 8),
                const Text(
                  'Estos montos salen de las condiciones que cargaste, no de facturas '
                  'reales. En la próxima etapa vas a poder registrar la factura que '
                  'llega y comparar cuánto vino contra cuánto debería haber venido.',
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _abrir(BuildContext context, Ciclo ciclo) =>
      context.go('/servicios/${ciclo.serviceId}');
}

/// Resumen de lo que viene.
///
/// Los montos son ESTIMADOS y se dice explícitamente: salen de las condiciones
/// pactadas, no de facturas reales. Cuando algún servicio no se puede estimar,
/// se aclara cuántos quedaron afuera en vez de sumar cero por ellos, que daría
/// un total falsamente preciso.
class _Resumen extends StatelessWidget {
  const _Resumen({required this.ciclos});

  final List<Ciclo> ciclos;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final conMonto = ciclos.where((c) => c.expectedAmount != null);
    final sinMonto = ciclos.length - conMonto.length;

    final total = conMonto.isEmpty
        ? null
        : conMonto.map((c) => c.expectedAmount!).reduce((a, b) => a + b);

    return Card(
      color: theme.colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Estimado para los próximos 45 días',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              total == null
                  ? MoneyFormat.desconocido
                  : MoneyFormat.estimado(total.toString()),
              style: theme.textTheme.headlineMedium?.copyWith(
                color: theme.colorScheme.onPrimaryContainer,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${ciclos.length} ${ciclos.length == 1 ? "vencimiento" : "vencimientos"}'
              '${sinMonto > 0 ? " · $sinMonto sin estimación" : ""}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SinVencimientos extends StatelessWidget {
  const _SinVencimientos();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(32),
      children: [
        const SizedBox(height: 48),
        Icon(
          Icons.event_available_outlined,
          size: 56,
          color: theme.colorScheme.primary,
        ),
        const SizedBox(height: 16),
        Text(
          'Todavía no hay vencimientos',
          style: theme.textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Cargá un servicio con su monto y su día de vencimiento, y acá van a '
          'aparecer los períodos que vienen.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium,
        ),
        const SizedBox(height: 24),
        Center(
          child: FilledButton.icon(
            onPressed: () => context.go('/servicios/nuevo'),
            icon: const Icon(Icons.add),
            label: const Text('Cargar un servicio'),
          ),
        ),
      ],
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.mensaje, required this.reintentar});

  final String mensaje;
  final VoidCallback reintentar;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(32),
      children: [
        const SizedBox(height: 48),
        Icon(
          Icons.cloud_off_outlined,
          size: 48,
          color: Theme.of(context).colorScheme.error,
        ),
        const SizedBox(height: 12),
        Text(mensaje, textAlign: TextAlign.center),
        const SizedBox(height: 8),
        Text(
          'Si el servidor estuvo inactivo, el primer pedido puede tardar hasta un minuto.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
        Center(
          child: FilledButton.tonal(
            onPressed: reintentar,
            child: const Text('Reintentar'),
          ),
        ),
      ],
    );
  }
}
