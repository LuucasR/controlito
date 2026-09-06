import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../data/services_api.dart';
import '../domain/servicio.dart';
import 'providers/services_providers.dart';
import 'widgets/condition_fields.dart';

/// Alta de un servicio junto con su condición inicial.
///
/// Van juntos a propósito: un servicio sin condiciones no sirve para proyectar
/// nada, así que pedir las dos cosas de una vez evita servicios a medias.
class ServiceFormScreen extends ConsumerStatefulWidget {
  const ServiceFormScreen({super.key});

  @override
  ConsumerState<ServiceFormScreen> createState() => _ServiceFormScreenState();
}

class _ServiceFormScreenState extends ConsumerState<ServiceFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _empresa = TextEditingController();
  final _notas = TextEditingController();
  final _condicion = EstadoCondicion();

  String? _categoriaId;
  PoliticaDeuda _politicaDeuda = PoliticaDeuda.desconocida;
  DateTime _desde = DateTime.now();

  bool _guardando = false;
  ApiException? _error;

  @override
  void dispose() {
    _nombre.dispose();
    _empresa.dispose();
    _notas.dispose();
    _condicion.dispose();
    super.dispose();
  }

  /// Fecha civil en el formato que espera la API: sin hora ni zona horaria.
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
      final creado = await ref
          .read(serviciosProvider.notifier)
          .crear(
            NuevoServicio(
              name: _nombre.text.trim(),
              providerName: _empresa.text.trim(),
              categoryId: _categoriaId,
              startDate: _desdeIso,
              amountMode: _condicion.modoMonto,
              frequency: _condicion.frecuencia,
              debtPolicy: _politicaDeuda,
              interestModel: _condicion.modeloInteres,
              baseAmount: _condicion.montoNormalizado,
              dueDayOfMonth: _condicion.diaVencimiento,
              notes: _notas.text.trim(),
              changeReason: _condicion.motivo.text.trim(),
            ),
          );

      if (mounted) context.go('/servicios/${creado.id}');
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  Future<void> _elegirFecha() async {
    final elegida = await showDatePicker(
      context: context,
      initialDate: _desde,
      firstDate: DateTime(2015),
      lastDate: DateTime(2100),
      helpText: 'Desde cuándo rigen estas condiciones',
    );
    if (elegida != null) setState(() => _desde = elegida);
  }

  @override
  Widget build(BuildContext context) {
    final categorias = ref.watch(categoriasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nuevo servicio'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.go('/servicios'),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) BannerErrorApi(error: _error!),
            SeccionFormulario(
              titulo: 'Qué servicio es',
              hijos: [
                TextFormField(
                  controller: _empresa,
                  enabled: !_guardando,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Empresa',
                    hintText: 'Movistar',
                    prefixIcon: Icon(Icons.business_outlined),
                  ),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _nombre,
                  enabled: !_guardando,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Servicio',
                    hintText: 'Internet Fibra 600 MB',
                    prefixIcon: Icon(Icons.label_outline),
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Poné un nombre' : null,
                ),
                const SizedBox(height: 16),
                categorias.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (_, _) =>
                      const Text('No se pudieron cargar las categorías'),
                  data: (lista) => DropdownButtonFormField<String>(
                    initialValue: _categoriaId,
                    decoration: const InputDecoration(
                      labelText: 'Categoría',
                      prefixIcon: Icon(Icons.category_outlined),
                    ),
                    items: lista
                        .map(
                          (c) => DropdownMenuItem(
                            value: c.id,
                            child: Text(c.name),
                          ),
                        )
                        .toList(),
                    onChanged: _guardando
                        ? null
                        : (v) => setState(() => _categoriaId = v),
                  ),
                ),
              ],
            ),
            SeccionFormulario(
              titulo: 'Condiciones pactadas',
              ayuda:
                  'Lo que acordaste con la empresa. Si mañana cambia, vas a poder cargar '
                  'la condición nueva sin perder esta.',
              hijos: [
                CondicionFields(
                  estado: _condicion,
                  habilitado: !_guardando,
                  onCambio: () => setState(() {}),
                ),
              ],
            ),
            SeccionFormulario(
              titulo: 'Desde cuándo',
              hijos: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: const Text('Estas condiciones rigen desde'),
                  subtitle: Text(_desdeIso),
                  trailing: const Icon(Icons.edit_outlined),
                  onTap: _guardando ? null : _elegirFecha,
                ),
              ],
            ),
            SeccionFormulario(
              titulo: 'Si quedás debiendo',
              ayuda:
                  'Cada empresa maneja la deuda distinto. Si no lo sabés, dejalo en '
                  '"No lo sé": la app no va a inventar un arrastre que no exista.',
              hijos: [
                DropdownButtonFormField<PoliticaDeuda>(
                  initialValue: _politicaDeuda,
                  decoration: const InputDecoration(
                    labelText: 'Qué pasa con la deuda',
                    prefixIcon: Icon(Icons.trending_up),
                  ),
                  items: PoliticaDeuda.values
                      .map(
                        (p) =>
                            DropdownMenuItem(value: p, child: Text(p.etiqueta)),
                      )
                      .toList(),
                  onChanged: _guardando
                      ? null
                      : (v) => setState(
                          () => _politicaDeuda = v ?? PoliticaDeuda.desconocida,
                        ),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _notas,
                  enabled: !_guardando,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Notas (opcional)',
                    hintText:
                        'Precio acordado por teléfono, número de reclamo…',
                    alignLabelWithHint: true,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _guardando ? null : _guardar,
              child: _guardando
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Guardar servicio'),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
