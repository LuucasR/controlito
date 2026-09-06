import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/money/money_format.dart';
import '../../../core/network/api_exception.dart';
import '../../cycles/domain/ciclo.dart';
import '../../services/presentation/widgets/condition_fields.dart';
import '../data/invoices_api.dart';
import '../domain/factura.dart';
import 'invoices_providers.dart';

/// Carga de la factura que llegó.
///
/// Pide el consumo del período SEPARADO del saldo anterior y los intereses.
/// Es la distinción que permite comparar contra lo esperado sin que una deuda
/// arrastrada se lea como un aumento de tarifa.
class InvoiceFormSheet extends ConsumerStatefulWidget {
  const InvoiceFormSheet({required this.ciclo, super.key});

  final Ciclo ciclo;

  @override
  ConsumerState<InvoiceFormSheet> createState() => _InvoiceFormSheetState();
}

class _InvoiceFormSheetState extends ConsumerState<InvoiceFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _consumo = TextEditingController();
  final _deuda = TextEditingController();
  final _intereses = TextEditingController();
  final _numero = TextEditingController();

  late DateTime _emision;
  late DateTime _vencimiento;

  bool _traeDeuda = false;
  bool _guardando = false;
  ApiException? _error;
  Factura? _resultado;

  @override
  void initState() {
    super.initState();
    final vence = widget.ciclo.dueDate;
    _vencimiento = vence != null ? DateTime.parse(vence) : DateTime.now();
    _emision = _vencimiento.subtract(const Duration(days: 10));
  }

  @override
  void dispose() {
    _consumo.dispose();
    _deuda.dispose();
    _intereses.dispose();
    _numero.dispose();
    super.dispose();
  }

  /// El usuario escribe "25.000,50"; la API espera "25000.50".
  String _normalizar(String texto) =>
      texto.trim().replaceAll('.', '').replaceAll(',', '.');

  String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _guardando = true;
      _error = null;
    });

    try {
      final factura = await ref.read(registrarFacturaProvider)(
        NuevaFactura(
          cycleId: widget.ciclo.id,
          issueDate: _iso(_emision),
          dueDate: _iso(_vencimiento),
          currentChargeAmount: _normalizar(_consumo.text),
          includedPriorDebtAmount: _traeDeuda ? _normalizar(_deuda.text) : null,
          priorDebtInterestAmount: _traeDeuda
              ? _normalizar(_intereses.text)
              : null,
          externalNumber: _numero.text.trim(),
        ),
      );

      // No se cierra la hoja: primero se muestra el resultado de la
      // comparacion, que es el motivo por el que existe esta pantalla.
      if (mounted) setState(() => _resultado = factura);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  Future<void> _elegirFecha({required bool esEmision}) async {
    final inicial = esEmision ? _emision : _vencimiento;
    final elegida = await showDatePicker(
      context: context,
      initialDate: inicial,
      firstDate: DateTime(2015),
      lastDate: DateTime(2100),
      helpText: esEmision ? 'Fecha de emisión' : 'Fecha de vencimiento',
    );

    if (elegida != null) {
      setState(() => esEmision ? _emision = elegida : _vencimiento = elegida);
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
      child: SingleChildScrollView(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: _resultado != null
              ? _Resultado(
                  factura: _resultado!,
                  onCerrar: () => Navigator.pop(context),
                )
              : Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Cargar factura', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 4),
                      Text(
                        '${widget.ciclo.serviceName} · ${widget.ciclo.periodoLegible}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (_error != null) BannerErrorApi(error: _error!),
                      TextFormField(
                        controller: _consumo,
                        enabled: !_guardando,
                        autofocus: true,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                        ],
                        decoration: InputDecoration(
                          labelText: 'Consumo del período',
                          prefixText: r'$ ',
                          helperText: widget.ciclo.expectedAmount == null
                              ? 'Sin estimación previa para comparar'
                              : 'Esperado: ${MoneyFormat.formatear(widget.ciclo.expectedAmount!)}',
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? 'Poné el monto'
                            : null,
                      ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _traeDeuda,
                        onChanged: _guardando
                            ? null
                            : (v) => setState(() => _traeDeuda = v),
                        title: const Text('La factura incluye saldo anterior'),
                        subtitle: const Text(
                          'Cargalo aparte: si lo sumás al consumo, la app lo va a leer '
                          'como un aumento de tarifa',
                        ),
                      ),
                      if (_traeDeuda) ...[
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _deuda,
                          enabled: !_guardando,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9.,]'),
                            ),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Saldo anterior',
                            prefixText: r'$ ',
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _intereses,
                          enabled: !_guardando,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9.,]'),
                            ),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Intereses o punitorios',
                            prefixText: r'$ ',
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.event_outlined),
                        title: const Text('Vence el'),
                        subtitle: Text(_iso(_vencimiento)),
                        trailing: const Icon(Icons.edit_outlined),
                        onTap: _guardando
                            ? null
                            : () => _elegirFecha(esEmision: false),
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.receipt_outlined),
                        title: const Text('Emitida el'),
                        subtitle: Text(_iso(_emision)),
                        trailing: const Icon(Icons.edit_outlined),
                        onTap: _guardando
                            ? null
                            : () => _elegirFecha(esEmision: true),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _numero,
                        enabled: !_guardando,
                        decoration: const InputDecoration(
                          labelText: 'Número de factura (opcional)',
                          hintText: '0001-00123456',
                        ),
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _guardando ? null : _guardar,
                        child: _guardando
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text('Guardar y comparar'),
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

/// Resultado de la comparación: lo que la app existe para decir.
class _Resultado extends StatelessWidget {
  const _Resultado({required this.factura, required this.onCerrar});

  final Factura factura;
  final VoidCallback onCerrar;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final comp = factura.comparacion;
    final coincide = comp != null && !comp.hayDiferencia;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        Icon(
          coincide ? Icons.check_circle_outline : Icons.info_outline,
          size: 44,
          color: coincide ? Colors.green : theme.colorScheme.primary,
        ),
        const SizedBox(height: 12),
        Text(
          coincide ? 'Coincide con lo esperado' : 'Factura registrada',
          style: theme.textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _Linea(
                  etiqueta: 'Consumo del período',
                  valor: MoneyFormat.formatear(factura.currentChargeAmount),
                ),
                if (factura.traeDeudaAnterior) ...[
                  _Linea(
                    etiqueta: 'Saldo anterior',
                    valor: MoneyFormat.formatear(
                      factura.includedPriorDebtAmount,
                    ),
                  ),
                  if (factura.priorDebtInterestAmount > Decimal.zero)
                    _Linea(
                      etiqueta: 'Intereses',
                      valor: MoneyFormat.formatear(
                        factura.priorDebtInterestAmount,
                      ),
                    ),
                ],
                const Divider(height: 24),
                _Linea(
                  etiqueta: 'Total de la factura',
                  valor: MoneyFormat.formatear(factura.totalAmount),
                  destacado: true,
                ),
              ],
            ),
          ),
        ),
        if (comp?.esperado != null) ...[
          const SizedBox(height: 8),
          Card(
            color: comp!.hayDiferencia
                ? theme.colorScheme.errorContainer
                : theme.colorScheme.surfaceContainerHighest,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _Linea(
                    etiqueta: 'Esperabas',
                    valor: MoneyFormat.formatear(comp.esperado!),
                  ),
                  _Linea(
                    etiqueta: 'Llegó (consumo)',
                    valor: MoneyFormat.formatear(factura.currentChargeAmount),
                  ),
                  const Divider(height: 20),
                  _Linea(
                    etiqueta: comp.esAumento ? 'Aumento' : 'Diferencia',
                    valor:
                        '${MoneyFormat.formatear(comp.diferencia!)}'
                        '${comp.porcentaje == null ? "" : "  (${comp.porcentaje!.toStringAsFixed(1)}%)"}',
                    destacado: true,
                  ),
                ],
              ),
            ),
          ),
        ],
        for (final alerta in factura.alertas) ...[
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: Icon(
                alerta.severidad == 'CRITICAL'
                    ? Icons.priority_high
                    : Icons.warning_amber_outlined,
                color: alerta.severidad == 'CRITICAL'
                    ? theme.colorScheme.error
                    : Colors.orange,
              ),
              title: Text(alerta.titulo),
              subtitle: Text(alerta.mensaje),
            ),
          ),
        ],
        const SizedBox(height: 20),
        FilledButton(onPressed: onCerrar, child: const Text('Listo')),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _Linea extends StatelessWidget {
  const _Linea({
    required this.etiqueta,
    required this.valor,
    this.destacado = false,
  });

  final String etiqueta;
  final String valor;
  final bool destacado;

  @override
  Widget build(BuildContext context) {
    final estilo = destacado
        ? Theme.of(context).textTheme.titleMedium
        : Theme.of(context).textTheme.bodyMedium;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(etiqueta, style: estilo)),
          Text(
            valor,
            style: estilo?.copyWith(
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
