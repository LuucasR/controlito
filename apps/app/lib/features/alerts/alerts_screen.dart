import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money/money_format.dart';
import '../../core/network/api_client.dart';
import 'data/alerts_api.dart';
import 'domain/alerta.dart';

final alertsApiProvider = Provider<AlertsApi>(
  (ref) => AlertsApi(ref.watch(dioProvider)),
);

final alertasProvider = FutureProvider<List<Alerta>>(
  (ref) => ref.watch(alertsApiProvider).listar(),
);

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alertas = ref.watch(alertasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Alertas'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            onPressed: () => ref.invalidate(alertasProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(alertasProvider),
        child: alertas.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            padding: const EdgeInsets.all(32),
            children: [
              const SizedBox(height: 48),
              Text('$e', textAlign: TextAlign.center),
            ],
          ),
          data: (lista) => lista.isEmpty
              ? const _SinAlertas()
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: lista.length,
                  itemBuilder: (_, i) => _TarjetaAlerta(alerta: lista[i]),
                ),
        ),
      ),
    );
  }
}

class _TarjetaAlerta extends ConsumerWidget {
  const _TarjetaAlerta({required this.alerta});

  final Alerta alerta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // El estado nunca se comunica solo por color: ícono y texto.
                Icon(
                  alerta.severidad.icono,
                  size: 18,
                  color: alerta.severidad.color,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    alerta.titulo,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: alerta.vista
                          ? theme.colorScheme.onSurfaceVariant
                          : null,
                    ),
                  ),
                ),
                Text(alerta.detectadaEl, style: theme.textTheme.bodySmall),
              ],
            ),
            const SizedBox(height: 8),
            Text(alerta.mensaje, style: theme.textTheme.bodyMedium),
            if (alerta.tieneEvidencia) ...[
              const SizedBox(height: 12),
              // La evidencia numérica va a la vista: sin ella, un aviso de
              // "aumento detectado" obliga a ir a buscar los números.
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _Dato(
                      titulo: 'Esperado',
                      valor: MoneyFormat.formatear(alerta.baseline!),
                    ),
                    _Dato(
                      titulo: 'Llegó',
                      valor: MoneyFormat.formatear(alerta.observado!),
                    ),
                    if (alerta.diferencia != null)
                      _Dato(
                        titulo: alerta.porcentaje == null
                            ? 'Diferencia'
                            : '${alerta.porcentaje!.toStringAsFixed(1)}%',
                        valor: MoneyFormat.formatear(alerta.diferencia!),
                        color: alerta.severidad.color,
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (alerta.serviceId != null)
                  TextButton(
                    onPressed: () =>
                        context.go('/servicios/${alerta.serviceId}'),
                    child: const Text('Ver servicio'),
                  ),
                if (!alerta.vista)
                  TextButton(
                    onPressed: () async {
                      await ref.read(alertsApiProvider).marcarVista(alerta.id);
                      ref.invalidate(alertasProvider);
                    },
                    child: const Text('Marcar como vista'),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Text('Vista', style: theme.textTheme.bodySmall),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.titulo, required this.valor, this.color});

  final String titulo;
  final String valor;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Text(titulo, style: theme.textTheme.bodySmall),
        const SizedBox(height: 2),
        Text(
          valor,
          style: theme.textTheme.titleSmall?.copyWith(
            color: color,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

class _SinAlertas extends StatelessWidget {
  const _SinAlertas();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(32),
      children: [
        const SizedBox(height: 64),
        Icon(
          Icons.notifications_none,
          size: 56,
          color: theme.colorScheme.primary,
        ),
        const SizedBox(height: 16),
        Text(
          'Sin alertas',
          style: theme.textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Acá van a aparecer los cambios que detectemos: aumentos, corrimientos '
          'de vencimiento y facturas que traen deuda anterior. Se detectan al '
          'cargar cada factura.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium,
        ),
      ],
    );
  }
}
