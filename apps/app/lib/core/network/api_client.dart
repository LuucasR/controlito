import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/token_store.dart';
import 'auth_interceptor.dart';

/// URL base de la API. Se inyecta al compilar:
///   flutter run --dart-define=API_BASE_URL=https://controlito-api.onrender.com/api/v1
/// NUNCA poner secretos acá: el binario es inspeccionable.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000/api/v1',
);

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => TokenStore.paraPlataforma(),
);

/// Señal de que la sesión se perdió y hay que volver al login.
///
/// Es un provider aparte, y no una llamada directa al controlador de
/// autenticación, para que el interceptor no dependa de él: si dependiera,
/// tendríamos una dependencia circular (el controlador crea el cliente HTTP
/// que contiene al interceptor).
class SesionPerdida extends Notifier<int> {
  @override
  int build() => 0;

  /// Cada aviso incrementa el contador; quien escucha reacciona al cambio.
  void marcar() => state = state + 1;
}

final sesionPerdidaProvider = NotifierProvider<SesionPerdida, int>(
  SesionPerdida.new,
);

final authInterceptorProvider = Provider<AuthInterceptor>((ref) {
  return AuthInterceptor(
    tokenStore: ref.watch(tokenStoreProvider),
    baseUrl: apiBaseUrl,
    alPerderSesion: () => ref.read(sesionPerdidaProvider.notifier).marcar(),
  );
});

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      // Render free suspende el servicio a los 15 minutos sin tráfico y
      // despertarlo tarda hasta un minuto: el primer pedido del día lo paga.
      connectTimeout: const Duration(seconds: 60),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'X-Client-Platform': kIsWeb ? 'web' : 'mobile',
        'Content-Type': 'application/json',
      },
      // Los 4xx llegan como DioException para traducirlos a ApiException en un
      // solo lugar; los 5xx también.
      validateStatus: (status) => status != null && status < 400,
    ),
  );

  dio.interceptors.add(ref.watch(authInterceptorProvider));
  ref.onDispose(dio.close);
  return dio;
});

/// Estado de conexión con el backend, para el diagnóstico del dashboard.
enum EstadoApi { conectada, degradada, sinConexion }

class SaludApi {
  const SaludApi({required this.estado, required this.detalle});
  final EstadoApi estado;
  final String detalle;
}

final saludApiProvider = FutureProvider<SaludApi>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get<Map<String, dynamic>>('/health/ready');
    final baseDatos = response.data?['database'] as String? ?? 'desconocida';

    return baseDatos == 'up'
        ? const SaludApi(
            estado: EstadoApi.conectada,
            detalle: 'API y base de datos OK',
          )
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
