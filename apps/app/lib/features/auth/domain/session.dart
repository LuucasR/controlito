/// Usuario autenticado, tal como lo devuelve la API.
class Usuario {
  const Usuario({
    required this.id,
    required this.email,
    required this.displayName,
    required this.timezone,
    required this.locale,
    required this.defaultCurrency,
  });

  factory Usuario.desdeJson(Map<String, dynamic> json) => Usuario(
    id: json['id'] as String,
    email: json['email'] as String,
    displayName: json['displayName'] as String?,
    timezone: json['timezone'] as String,
    locale: json['locale'] as String,
    defaultCurrency: json['defaultCurrency'] as String,
  );

  final String id;
  final String email;
  final String? displayName;
  final String timezone;
  final String locale;
  final String defaultCurrency;

  /// Nombre para mostrar, con la parte del email como respaldo.
  String get nombreVisible => displayName?.trim().isNotEmpty ?? false
      ? displayName!
      : email.split('@').first;
}

/// Estado de autenticación de la aplicación.
sealed class EstadoAuth {
  const EstadoAuth();
}

/// Al arrancar, mientras se comprueba si hay una sesión guardada.
class AuthComprobando extends EstadoAuth {
  const AuthComprobando();
}

class AuthSinSesion extends EstadoAuth {
  const AuthSinSesion();
}

class AuthConSesion extends EstadoAuth {
  const AuthConSesion(this.usuario);
  final Usuario usuario;
}
