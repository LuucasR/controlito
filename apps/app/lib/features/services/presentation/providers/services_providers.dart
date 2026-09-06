import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../data/services_api.dart';
import '../../domain/servicio.dart';

final servicesApiProvider = Provider<ServicesApi>(
  (ref) => ServicesApi(ref.watch(dioProvider)),
);

/// Categorías del sistema. Cambian muy poco, así que se mantienen en memoria
/// mientras la app viva en vez de pedirlas en cada formulario.
final categoriasProvider = FutureProvider<List<Categoria>>((ref) {
  ref.keepAlive();
  return ref.watch(servicesApiProvider).categorias();
});

/// Lista de servicios del usuario.
final serviciosProvider =
    AsyncNotifierProvider<ServiciosNotifier, List<Servicio>>(
      ServiciosNotifier.new,
    );

class ServiciosNotifier extends AsyncNotifier<List<Servicio>> {
  @override
  Future<List<Servicio>> build() => ref.watch(servicesApiProvider).listar();

  Future<Servicio> crear(NuevoServicio nuevo) async {
    final creado = await ref.read(servicesApiProvider).crear(nuevo);
    // Se recarga la lista en vez de insertar a mano: el servidor es la fuente
    // de verdad y puede haber completado campos por su cuenta.
    ref.invalidateSelf();
    return creado;
  }

  Future<void> archivar(String id) async {
    await ref.read(servicesApiProvider).archivar(id);
    ref.invalidateSelf();
  }
}

/// Detalle de un servicio, con su historial completo de condiciones.
final servicioProvider =
    AsyncNotifierProvider.family<ServicioNotifier, Servicio, String>(
      ServicioNotifier.new,
    );

class ServicioNotifier extends AsyncNotifier<Servicio> {
  ServicioNotifier(this.servicioId);

  /// En Riverpod 3 el parametro de la familia llega por el constructor del
  /// notifier, y build() no recibe argumentos.
  final String servicioId;

  @override
  Future<Servicio> build() =>
      ref.watch(servicesApiProvider).obtener(servicioId);

  Future<void> agregarCondicion(NuevaCondicion condicion) async {
    final actualizado = await ref
        .read(servicesApiProvider)
        .agregarCondicion(servicioId, condicion);
    state = AsyncData(actualizado);
    // La lista muestra la condición vigente, así que también cambió.
    ref.invalidate(serviciosProvider);
  }
}
