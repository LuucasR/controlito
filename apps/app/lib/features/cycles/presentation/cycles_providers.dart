import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/cycles_api.dart';
import '../domain/ciclo.dart';

final cyclesApiProvider = Provider<CyclesApi>(
  (ref) => CyclesApi(ref.watch(dioProvider)),
);

/// Próximos vencimientos. Alimenta el inicio.
final proximosVencimientosProvider = FutureProvider<List<Ciclo>>(
  (ref) => ref.watch(cyclesApiProvider).proximos(),
);

/// Períodos de un servicio.
final ciclosDelServicioProvider = FutureProvider.family<List<Ciclo>, String>(
  (ref, serviceId) => ref.watch(cyclesApiProvider).delServicio(serviceId),
);
