import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/money/money_format.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final salud = ref.watch(saludApiProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Controlito'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            onPressed: () => ref.invalidate(saludApiProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _TarjetaConexion(salud: salud),
          const SizedBox(height: 16),
          Text('Vista previa', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          const _TarjetaEjemplo(),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Etapa 0 — Fundaciones',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'El esqueleto está listo: navegación adaptativa, formato es-AR y '
                    'conexión con la API. Las métricas reales llegan en la Etapa 7, '
                    'después de construir servicios, facturas, pagos y proyecciones.',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TarjetaConexion extends StatelessWidget {
  const _TarjetaConexion({required this.salud});

  final AsyncValue<SaludApi> salud;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: salud.when(
          loading: () => const Row(
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 12),
              Expanded(child: Text('Contactando la API…')),
            ],
          ),
          error: (e, _) =>
              _fila(context, Icons.error_outline, Colors.red, 'Error', '$e'),
          data: (s) => switch (s.estado) {
            EstadoApi.conectada => _fila(
              context,
              Icons.check_circle_outline,
              Colors.green,
              'Conectado',
              s.detalle,
            ),
            EstadoApi.degradada => _fila(
              context,
              Icons.warning_amber_outlined,
              Colors.orange,
              'Parcial',
              s.detalle,
            ),
            EstadoApi.sinConexion => _fila(
              context,
              Icons.cloud_off_outlined,
              Colors.red,
              'Sin conexión',
              s.detalle,
            ),
          },
        ),
      ),
    );
  }

  Widget _fila(
    BuildContext context,
    IconData icono,
    Color color,
    String titulo,
    String detalle,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icono, color: color),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 2),
              Text(detalle, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}

/// Muestra el contrato de dinero y los estados visuales ya funcionando.
/// Los montos son los del ejemplo del plan, todavia con datos fijos.
class _TarjetaEjemplo extends StatelessWidget {
  const _TarjetaEjemplo();

  @override
  Widget build(BuildContext context) {
    const estado = EstadoVisual.pagoParcial;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Movistar · Internet Fibra 600 MB',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Icon(estado.icono, size: 18, color: estado.color),
                const SizedBox(width: 4),
                Text(estado.etiqueta, style: TextStyle(color: estado.color)),
              ],
            ),
            const Divider(height: 24),
            _linea(
              context,
              'Última factura',
              MoneyFormat.desdeJson('25000.00'),
            ),
            _linea(context, 'Pagado', MoneyFormat.desdeJson('15000.00')),
            _linea(
              context,
              'Saldo pendiente',
              MoneyFormat.desdeJson('10000.00'),
            ),
            _linea(context, 'Interés estimado', MoneyFormat.estimado('500.00')),
            const Divider(height: 24),
            _linea(
              context,
              'Próxima factura estimada',
              MoneyFormat.estimado('35500.00'),
              destacado: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _linea(
    BuildContext context,
    String etiqueta,
    String valor, {
    bool destacado = false,
  }) {
    final estilo = destacado
        ? Theme.of(context).textTheme.titleMedium
        : Theme.of(context).textTheme.bodyMedium;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(etiqueta, style: estilo),
          Text(
            valor,
            // Cifras tabulares: sin esto las columnas de montos no alinean.
            style: estilo?.copyWith(
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
