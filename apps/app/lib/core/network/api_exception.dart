import 'package:dio/dio.dart';

/// Error de la API, ya traducido desde el formato problem+json.
///
/// El `code` es el contrato estable: la interfaz decide qué hacer según ese
/// valor, nunca según el mensaje, que es texto para mostrarle a la persona y
/// puede cambiar sin aviso.
sealed class ApiException implements Exception {
  const ApiException(this.code, this.message, {this.detail, this.errors});

  final String code;
  final String message;
  final String? detail;
  final Map<String, String>? errors;

  @override
  String toString() => '$code: $message';

  /// Traduce cualquier fallo de dio a un tipo del dominio de la app.
  static ApiException desdeDio(DioException e) {
    final respuesta = e.response;

    if (respuesta == null) {
      // Sin respuesta: no hubo red, o el servidor tardó demasiado.
      // En Render free el primer pedido tras el arranque en frío puede tardar
      // casi un minuto, y hay que explicarlo en vez de mostrar "error".
      final esTimeout =
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout;
      return esTimeout ? const TiempoAgotado() : const SinConexion();
    }

    final datos = respuesta.data;
    if (datos is! Map<String, dynamic>) {
      return ErrorDelServidor('HTTP_${respuesta.statusCode}', 'Algo salió mal');
    }

    final code = datos['code'] as String? ?? 'UNKNOWN';
    final message = datos['title'] as String? ?? 'Algo salió mal';
    final detail = datos['detail'] as String?;

    final listaErrores = datos['errors'];
    final errores = listaErrores is List
        ? {
            for (final e in listaErrores.whereType<Map<String, dynamic>>())
              (e['path'] as String? ?? ''): (e['message'] as String? ?? ''),
          }
        : null;

    return switch (respuesta.statusCode) {
      401 => NoAutorizado(code, message, detail: detail),
      409 => Conflicto(code, message, detail: detail),
      422 => DatosInvalidos(code, message, detail: detail, errors: errores),
      _ => ErrorDelServidor(code, message, detail: detail),
    };
  }
}

class SinConexion extends ApiException {
  const SinConexion()
    : super(
        'NO_CONNECTION',
        'No pudimos conectarnos. Revisá tu conexión a internet.',
      );
}

class TiempoAgotado extends ApiException {
  const TiempoAgotado()
    : super(
        'TIMEOUT',
        'El servidor está tardando en responder. Probá de nuevo.',
      );
}

class NoAutorizado extends ApiException {
  const NoAutorizado(super.code, super.message, {super.detail});
}

class Conflicto extends ApiException {
  const Conflicto(super.code, super.message, {super.detail});
}

class DatosInvalidos extends ApiException {
  const DatosInvalidos(super.code, super.message, {super.detail, super.errors});
}

class ErrorDelServidor extends ApiException {
  const ErrorDelServidor(super.code, super.message, {super.detail});
}
