import 'package:dio/dio.dart';

import '../../../core/network/api_exception.dart';
import '../domain/session.dart';

/// Respuesta de registro y login: usuario más el par de tokens.
class RespuestaSesion {
  const RespuestaSesion({
    required this.usuario,
    required this.accessToken,
    required this.refreshToken,
  });

  final Usuario usuario;
  final String accessToken;
  final String refreshToken;
}

class AuthApi {
  const AuthApi(this._dio);

  final Dio _dio;

  Future<RespuestaSesion> registrar({
    required String email,
    required String password,
    String? displayName,
  }) => _sesion('/auth/register', {
    'email': email,
    'password': password,
    if (displayName != null && displayName.isNotEmpty)
      'displayName': displayName,
  });

  Future<RespuestaSesion> iniciarSesion({
    required String email,
    required String password,
  }) => _sesion('/auth/login', {'email': email, 'password': password});

  Future<Usuario> perfil() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/auth/me');
      return Usuario.desdeJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }

  Future<void> cerrarSesion(String refreshToken) async {
    try {
      await _dio.post<void>(
        '/auth/logout',
        data: {'refreshToken': refreshToken},
      );
    } on DioException {
      // Cerrar sesión nunca debe fallar de cara al usuario: si el servidor no
      // responde, igual se borran las credenciales locales.
    }
  }

  Future<RespuestaSesion> _sesion(
    String ruta,
    Map<String, dynamic> cuerpo,
  ) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(ruta, data: cuerpo);
      final datos = res.data!;
      return RespuestaSesion(
        usuario: Usuario.desdeJson(datos['user'] as Map<String, dynamic>),
        accessToken: datos['accessToken'] as String,
        refreshToken: datos['refreshToken'] as String,
      );
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }
}
