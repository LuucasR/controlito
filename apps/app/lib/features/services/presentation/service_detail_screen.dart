import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/money/money_format.dart';
import '../../cycles/presentation/cycle_tile.dart';
import '../../cycles/presentation/cycles_providers.dart';
import '../../../core/network/api_exception.dart';
import '../data/services_api.dart';
import '../domain/servicio.dart';
import 'providers/services_providers.dart';
import 'widgets/condition_fields.dart';

class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({required this.servicioId, super.key});

  final String servicioId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicio = ref.watch(servicioProvider(servicioId));

    return Scaffold(
      appBar: AppBar(
        title: Text(servicio.value?.name ?? 'Servicio'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/servicios'),
        ),
      ),
      body: servicio.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(padding: const EdgeInsets.all(32), child: Text('$e')),
        ),
        data: (s) => _Detalle(servicio: s),
      ),
      floatingActionButton: servicio.hasValue
          ? FloatingActionButton.extended(
              onPressed: () =>
                  _abrirNuevaCondicion(context, ref, servicio.value!),
              icon: const Icon(Icons.playlist_add),
              label: const Text('Nueva condición'),
            )
          : null,
    );
  }

  Future<void> _abrirNuevaCondicion(
    BuildContext context,
    WidgetRef ref,
    Servicio servicio,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FormularioCondicion(servicioId: servicio.id),
    );
  }
}

class _Detalle extends ConsumerWidget {
  const _Detalle({required this.servicio});

  final Servicio servicio;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final ciclos = ref.watch(ciclosDelServicioProvider(servicio.id));
    final vigente = servicio.currentCondition;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (servicio.providerName != null)
                  Text(
                    servicio.providerName!,
                    style: theme.textTheme.bodySmall,
                  ),
                Text(servicio.name, style: theme.textTheme.titleLarge),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (servicio.category != null)
                      Chip(label: Text(servicio.category!.name)),
                    Chip(label: Text(servicio.status.etiqueta)),
                    Chip(label: Text(servicio.debtPolicy.etiqueta)),
                  ],
                ),
                if (servicio.notes != null && servicio.notes!.isNotEmpty) ...[
                  const Divider(height: 24),
                  Text(servicio.notes!, style: theme.textTheme.bodyMedium),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text('Condición vigente', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        if (vigente == null)
          Card(
            child: ListTile(
              leading: Icon(
                Icons.warning_amber_outlined,
                color: theme.colorScheme.error,
              ),
              title: const Text('Sin condiciones cargadas'),
              subtitle: const Text(
                'Sin condiciones no se puede estimar la próxima factura',
              ),
            ),
          )
        else
          _TarjetaCondicion(condicion: vigente, destacada: true),
        const SizedBox(height: 24),
        Text('Períodos', style: theme.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          'Se generan solos a partir de las condiciones. Los montos son estimados '
          'hasta que registres la factura real.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        ciclos.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => Card(
            child: ListTile(
              leading: const Icon(Icons.error_outline),
              title: const Text('No se pudieron cargar los períodos'),
              subtitle: Text('$e'),
            ),
          ),
          data: (lista) => lista.isEmpty
              ? const Card(
                  child: ListTile(
                    leading: Icon(Icons.info_outline),
                    title: Text('Sin períodos'),
                    subtitle: Text(
                      'Un servicio sin periodicidad fija no genera períodos por adelantado',
                    ),
                  ),
                )
              : Column(
                  children: [
                    for (final c in lista.take(12))
                      CycleTile(ciclo: c, mostrarServicio: false),
                  ],
                ),
        ),
        if (servicio.conditions.length > 1) ...[
          const SizedBox(height: 24),
          Text('Historial de condiciones', style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Las condiciones anteriores no se borran: gracias a esto se puede saber '
            'qué estaba pactado en cada período.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          ...servicio.conditions
              .where((c) => !c.vigente)
              .map((c) => _TarjetaCondicion(condicion: c, destacada: false)),
        ],
      ],
    );
  }
}

class _TarjetaCondicion extends StatelessWidget {
  const _TarjetaCondicion({required this.condicion, required this.destacada});

  final Condicion condicion;
  final bool destacada;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final monto = condicion.baseAmount;
    final esEstimado = condicion.amountMode != ModoMonto.fijo;

    return Card(
      color: destacada ? theme.colorScheme.primaryContainer : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  destacada ? Icons.play_circle_outline : Icons.history,
                  size: 18,
                  color: destacada
                      ? theme.colorScheme.onPrimaryContainer
                      : theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    condicion.vigente
                        ? 'Desde ${condicion.validFrom} · vigente'
                        : 'Del ${condicion.validFrom} al ${condicion.validTo}',
                    style: theme.textTheme.bodySmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              monto == null
                  ? MoneyFormat.desconocido
                  : esEstimado
                  ? MoneyFormat.estimado(monto.toString())
                  : MoneyFormat.formatear(monto),
              style: theme.textTheme.headlineSmall?.copyWith(
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                _Etiqueta(
                  icono: Icons.repeat,
                  texto: condicion.frequency.etiqueta,
                ),
                if (condicion.dueDayOfMonth != null)
                  _Etiqueta(
                    icono: Icons.event_outlined,
                    texto: 'Vence el ${condicion.dueDayOfMonth}',
                  ),
                _Etiqueta(
                  icono: Icons.percent,
                  texto: condicion.interestModel.etiqueta,
                ),
              ],
            ),
            if (condicion.changeReason != null &&
                condicion.changeReason!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(condicion.changeReason!, style: theme.textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

class _Etiqueta extends StatelessWidget {
  const _Etiqueta({required this.icono, required this.texto});

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icono, size: 14),
        const SizedBox(width: 4),
        Text(texto, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

/// Formulario para agregar una condición nueva.
///
/// Deja claro en pantalla que la condición anterior NO se pierde: se cierra el
/// día en que arranca esta. Es la diferencia entre poder detectar un aumento y
/// no poder.
class _FormularioCondicion extends ConsumerStatefulWidget {
  const _FormularioCondicion({required this.servicioId});

  final String servicioId;

  @override
  ConsumerState<_FormularioCondicion> createState() =>
      _FormularioCondicionState();
}

class _FormularioCondicionState extends ConsumerState<_FormularioCondicion> {
  final _formKey = GlobalKey<FormState>();
  final _condicion = EstadoCondicion();

  DateTime _desde = DateTime.now();
  bool _guardando = false;
  ApiException? _error;

  @override
  void dispose() {
    _condicion.dispose();
    super.dispose();
  }

  String get _desdeIso =>
      '${_desde.year.toString().padLeft(4, '0')}-'
      '${_desde.month.toString().padLeft(2, '0')}-'
      '${_desde.day.toString().padLeft(2, '0')}';

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _guardando = true;
      _error = null;
    });

    try {
      await ref
          .read(servicioProvider(widget.servicioId).notifier)
          .agregarCondicion(
            NuevaCondicion(
              validFrom: _desdeIso,
              amountMode: _condicion.modoMonto,
              frequency: _condicion.frecuencia,
              interestModel: _condicion.modeloInteres,
              baseAmount: _condicion.montoNormalizado,
              dueDayOfMonth: _condicion.diaVencimiento,
              changeReason: _condicion.motivo.text.trim(),
            ),
          );

      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Nueva condición', style: theme.textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(
                  'La condición actual queda cerrada el día que arranca esta. '
                  'No se pierde: pasa al historial.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                if (_error != null) BannerErrorApi(error: _error!),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: const Text('Rige desde'),
                  subtitle: Text(_desdeIso),
                  trailing: const Icon(Icons.edit_outlined),
                  onTap: _guardando
                      ? null
                      : () async {
                          final elegida = await showDatePicker(
                            context: context,
                            initialDate: _desde,
                            firstDate: DateTime(2015),
                            lastDate: DateTime(2100),
                          );
                          if (elegida != null) setState(() => _desde = elegida);
                        },
                ),
                const SizedBox(height: 8),
                CondicionFields(
                  estado: _condicion,
                  habilitado: !_guardando,
                  onCambio: () => setState(() {}),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _guardando ? null : _guardar,
                  child: _guardando
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Guardar condición'),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
