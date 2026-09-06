import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../storage/token_store.dart';

/// Agrega el access token a cada pedido y lo renueva cuando expira.
///
/// EL PUNTO CRÍTICO ES EL MUTEX. Sin él, si cinco pantallas cargan a la vez y
/// el access token ya expiró, se disparan cinco refresh en paralelo. Como el
/// backend rota el token en cada uso, cuatro de esos cinco llegan con un token
/// ya consumido: el servidor lo interpreta —correctamente— como un robo,
/// revoca la familia entera y el usuario queda deslogueado sin motivo aparente.
///
/// Con el mutex, el primer 401 dispara UN refresh y los demás esperan ese
/// mismo resultado.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this.tokenStore,
    required this.baseUrl,
    required this.alPerderSesion,
  });

  final TokenStore tokenStore;
  final String baseUrl;

  /// Se invoca cuando la sesión ya no se puede recuperar: hay que ir al login.
  final void Function() alPerderSesion;

  /// Vive SOLO en memoria: nunca se escribe a disco. Dura 15 minutos y se
  /// vuelve a pedir con el refresh, asi que una filtracion del almacenamiento
  /// no lo expone.
  String? accessToken;

  /// Refresh en curso. Mientras no sea null, cualquier otro pedido espera este.
  Future<String?>? _refreshEnCurso;

  /// Cliente aparte, sin interceptores: si usara el mismo, un 401 del propio
  /// refresh entraría de nuevo acá y se llamaría a sí mismo sin fin.
  late final Dio _dioLimpio = Dio(BaseOptions(baseUrl: baseUrl));

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (accessToken != null && !esRutaPublica(options.path)) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final esNoAutorizado = err.response?.statusCode == 401;
    final yaReintentado = err.requestOptions.extra['reintentado'] == true;

    if (!esNoAutorizado ||
        yaReintentado ||
        esRutaPublica(err.requestOptions.path)) {
      return handler.next(err);
    }

    final nuevoToken = await _refrescar();
    if (nuevoToken == null) {
      alPerderSesion();
      return handler.next(err);
    }

    // Se repite el pedido original una sola vez, marcado para no reintentar
    // en bucle si vuelve a dar 401.
    try {
      final opciones = err.requestOptions
        ..headers['Authorization'] = 'Bearer $nuevoToken'
        ..extra['reintentado'] = true;

      final respuesta = await _dioLimpio.fetch<dynamic>(opciones);
      return handler.resolve(respuesta);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }

  /// Devuelve el access token nuevo, o null si la sesión se perdió.
  /// Si ya hay un refresh en curso, espera ese en lugar de lanzar otro.
  Future<String?> _refrescar() {
    return _refreshEnCurso ??= _hacerRefresh().whenComplete(() {
      _refreshEnCurso = null;
    });
  }

  Future<String?> _hacerRefresh() async {
    final refreshToken = await tokenStore.leerRefreshToken();
    if (refreshToken == null) return null;

    try {
      final res = await _dioLimpio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final datos = res.data;
      if (datos == null) return null;

      final nuevoAccess = datos['accessToken'] as String?;
      final nuevoRefresh = datos['refreshToken'] as String?;
      if (nuevoAccess == null || nuevoRefresh == null) return null;

      accessToken = nuevoAccess;
      await tokenStore.guardarRefreshToken(nuevoRefresh);
      return nuevoAccess;
    } on DioException {
      // Token vencido, revocado, o robo detectado: en todos los casos no hay
      // forma de recuperar la sesión sin volver a iniciarla.
      accessToken = null;
      await tokenStore.limpiar();
      return null;
    }
  }

  /// Rutas que nunca llevan Authorization ni disparan un refresh.
  /// Es visible para poder verificarlo en los tests.
  @visibleForTesting
  bool esRutaPublica(String path) =>
      path.contains('/auth/login') ||
      path.contains('/auth/register') ||
      path.contains('/auth/refresh') ||
      path.contains('/health');
}
