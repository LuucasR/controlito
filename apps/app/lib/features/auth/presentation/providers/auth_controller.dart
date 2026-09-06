import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../data/auth_api.dart';
import '../../domain/session.dart';

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(dioProvider)),
);

final authControllerProvider = NotifierProvider<AuthController, EstadoAuth>(
  AuthController.new,
);

/// Estado de autenticación de la app.
///
/// Al arrancar intenta restaurar la sesión con el refresh token guardado. Si
/// no hay o ya no sirve, queda sin sesión: el router hace el resto.
class AuthController extends Notifier<EstadoAuth> {
  @override
  EstadoAuth build() {
    // El interceptor avisa por acá cuando la sesión se pierde a mitad de uso
    // (token revocado, robo detectado, cuenta borrada).
    ref.listen(sesionPerdidaProvider, (_, _) {
      state = const AuthSinSesion();
    });

    Future.microtask(restaurarSesion);
    return const AuthComprobando();
  }

  /// Intenta recuperar la sesión guardada. Se llama al arrancar la app.
  Future<void> restaurarSesion() async {
    final store = ref.read(tokenStoreProvider);
    final refreshToken = await store.leerRefreshToken();

    if (refreshToken == null) {
      state = const AuthSinSesion();
      return;
    }

    try {
      // Pedir el perfil dispara un 401 si el access token falta o expiró, y el
      // interceptor lo renueva solo. Si tampoco eso funciona, no hay sesión.
      final usuario = await ref.read(authApiProvider).perfil();
      state = AuthConSesion(usuario);
    } on Object {
      await store.limpiar();
      state = const AuthSinSesion();
    }
  }

  Future<void> registrar({
    required String email,
    required String password,
    String? displayName,
  }) async {
    final respuesta = await ref
        .read(authApiProvider)
        .registrar(email: email, password: password, displayName: displayName);
    await _guardar(respuesta);
  }

  Future<void> iniciarSesion({
    required String email,
    required String password,
  }) async {
    final respuesta = await ref
        .read(authApiProvider)
        .iniciarSesion(email: email, password: password);
    await _guardar(respuesta);
  }

  Future<void> cerrarSesion() async {
    final store = ref.read(tokenStoreProvider);
    final refreshToken = await store.leerRefreshToken();

    if (refreshToken != null) {
      await ref.read(authApiProvider).cerrarSesion(refreshToken);
    }

    await store.limpiar();
    ref.read(authInterceptorProvider).accessToken = null;
    state = const AuthSinSesion();
  }

  Future<void> _guardar(RespuestaSesion respuesta) async {
    // El access token vive solo en memoria; el refresh es el único que se
    // persiste, y con la duración más corta que la seguridad permita.
    ref.read(authInterceptorProvider).accessToken = respuesta.accessToken;
    await ref
        .read(tokenStoreProvider)
        .guardarRefreshToken(respuesta.refreshToken);
    state = AuthConSesion(respuesta.usuario);
  }
}
