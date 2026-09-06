import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// URL base de la API. Se inyecta en tiempo de compilacion:
///   flutter run --dart-define=API_BASE_URL=https://api.controlito.app/api/v1
/// NUNCA poner secretos aca: el binario es inspeccionable.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000/api/v1',
);

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      // Render free duerme a los 15 min: el primer request tras el arranque
      // puede tardar hasta un minuto en responder.
      connectTimeout: const Duration(seconds: 60),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'X-Client-Platform': kIsWeb ? 'web' : 'mobile',
        'Content-Type': 'application/json',
      },
      // Los errores se manejan por codigo de estado, no por excepcion.
      validateStatus: (status) => status != null && status < 500,
    ),
  );
  ref.onDispose(dio.close);
  return dio;
});

/// Estado de conexion con el backend.
enum EstadoApi { conectada, degradada, sinConexion }

class SaludApi {
  const SaludApi({required this.estado, required this.detalle});

  final EstadoApi estado;
  final String detalle;
}

/// Verifica la conectividad real contra la API.
/// En la Etapa 0 es lo que demuestra que Flutter y NestJS hablan entre si.
final saludApiProvider = FutureProvider<SaludApi>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get<Map<String, dynamic>>('/health/ready');
    final data = response.data ?? const {};
    final baseDatos = data['database'] as String? ?? 'desconocida';

    return baseDatos == 'up'
        ? const SaludApi(estado: EstadoApi.conectada, detalle: 'API y base de datos OK')
        : SaludApi(
            estado: EstadoApi.degradada,
            detalle: 'API OK · base de datos: $baseDatos',
          );
  } on DioException catch (e) {
    return SaludApi(
      estado: EstadoApi.sinConexion,
      detalle: 'No se pudo contactar $apiBaseUrl (${e.type.name})',
    );
  }
});
