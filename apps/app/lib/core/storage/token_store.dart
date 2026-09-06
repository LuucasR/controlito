import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Guarda el refresh token entre sesiones.
///
/// El ACCESS token nunca se guarda en disco en ninguna plataforma: dura 15
/// minutos y se vuelve a pedir con el refresh. Así, si el almacenamiento se
/// filtra, lo que se expone es lo mínimo posible.
abstract interface class TokenStore {
  Future<String?> leerRefreshToken();
  Future<void> guardarRefreshToken(String token);
  Future<void> limpiar();

  /// Elige la implementación según la plataforma.
  factory TokenStore.paraPlataforma() =>
      kIsWeb ? _TokenStoreWeb() : _TokenStoreMovil();
}

const _clave = 'controlito.refresh_token';

/// Android: EncryptedSharedPreferences respaldado por el Keystore del sistema.
/// iOS: Keychain. Es almacenamiento seguro de verdad.
class _TokenStoreMovil implements TokenStore {
  static const _almacen = FlutterSecureStorage();

  @override
  Future<String?> leerRefreshToken() => _almacen.read(key: _clave);

  @override
  Future<void> guardarRefreshToken(String token) =>
      _almacen.write(key: _clave, value: token);

  @override
  Future<void> limpiar() => _almacen.delete(key: _clave);
}

/// Web: localStorage.
///
/// ADVERTENCIA CONSCIENTE: esto NO es almacenamiento seguro. Cualquier script
/// que se ejecute en la página puede leerlo. No se usa flutter_secure_storage
/// porque en web guarda la clave de cifrado en el mismo localStorage, así que
/// es ofuscación disfrazada de seguridad, que es peor: hace creer que hay una
/// protección que no existe.
///
/// La solución real es una cookie httpOnly, y requiere que la API y la web
/// compartan dominio. Cuando exista el dominio propio, se reemplaza esta clase
/// y no cambia nada más del código.
class _TokenStoreWeb implements TokenStore {
  @override
  Future<String?> leerRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_clave);
  }

  @override
  Future<void> guardarRefreshToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_clave, token);
  }

  @override
  Future<void> limpiar() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_clave);
  }
}
