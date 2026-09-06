import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../cycles/presentation/cycles_providers.dart';
import '../data/invoices_api.dart';
import '../domain/factura.dart';

final invoicesApiProvider = Provider<InvoicesApi>(
  (ref) => InvoicesApi(ref.watch(dioProvider)),
);

final facturasDelServicioProvider =
    FutureProvider.family<List<Factura>, String>(
      (ref, serviceId) => ref.watch(invoicesApiProvider).delServicio(serviceId),
    );

/// Registra la factura e invalida todo lo que depende de ella: los períodos
/// cambian de estado, y los vencimientos del inicio también.
final registrarFacturaProvider =
    Provider<Future<Factura> Function(NuevaFactura)>((ref) {
      return (nueva) async {
        final factura = await ref.read(invoicesApiProvider).registrar(nueva);
        ref.invalidate(ciclosDelServicioProvider);
        ref.invalidate(proximosVencimientosProvider);
        ref.invalidate(facturasDelServicioProvider);
        return factura;
      };
    });
