import 'package:controlito/core/network/auth_interceptor.dart';
import 'package:controlito/core/storage/token_store.dart';
import 'package:flutter_test/flutter_test.dart';

/// Almacen en memoria, para no tocar el Keychain ni localStorage en los tests.
class _StoreFalso implements TokenStore {
  _StoreFalso(this._token);

  String? _token;
  int limpiezas = 0;

  @override
  Future<String?> leerRefreshToken() async => _token;

  @override
  Future<void> guardarRefreshToken(String token) async => _token = token;

  @override
  Future<void> limpiar() async {
    _token = null;
    limpiezas++;
  }
}

void main() {
  group('AuthInterceptor', () {
    test('no manda Authorization si no hay access token', () {
      final i = AuthInterceptor(
        tokenStore: _StoreFalso(null),
        baseUrl: 'http://localhost:3000/api/v1',
        alPerderSesion: () {},
      );

      expect(i.accessToken, isNull);
    });

    test('el access token vive solo en memoria', () async {
      final store = _StoreFalso('refresh-guardado');
      final i = AuthInterceptor(
        tokenStore: store,
        baseUrl: 'http://localhost:3000/api/v1',
        alPerderSesion: () {},
      );

      i.accessToken = 'access-en-memoria';

      // Lo unico que se persiste es el refresh: si alguien lee el
      // almacenamiento del dispositivo, no encuentra el access token.
      expect(await store.leerRefreshToken(), 'refresh-guardado');
      expect(i.accessToken, 'access-en-memoria');
    });

    test('las rutas publicas no llevan Authorization aunque haya token', () {
      final i = AuthInterceptor(
        tokenStore: _StoreFalso('r'),
        baseUrl: 'http://localhost:3000/api/v1',
        alPerderSesion: () {},
      )..accessToken = 'token';

      // Mandar el Authorization al endpoint de refresh haria que un access
      // token vencido provoque un 401 en el propio refresh.
      for (final ruta in [
        '/auth/login',
        '/auth/register',
        '/auth/refresh',
        '/health',
      ]) {
        expect(
          i.esRutaPublica(ruta),
          isTrue,
          reason: 'La ruta $ruta deberia tratarse como publica',
        );
      }
      expect(i.esRutaPublica('/auth/me'), isFalse);
      expect(i.esRutaPublica('/servicios'), isFalse);
    });
  });
}
