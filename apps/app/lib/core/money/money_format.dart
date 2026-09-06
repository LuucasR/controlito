import 'package:decimal/decimal.dart';
import 'package:intl/intl.dart';

/// Formateo de dinero en es-AR: separador de miles con punto y decimal con coma.
///
/// El backend transporta los montos como STRING ("35500.00"), nunca como number:
/// un double pierde precision, y en Dart Web el problema es peor que en movil.
abstract final class MoneyFormat {
  static final Map<String, NumberFormat> _cache = {};

  static NumberFormat _formatter(String currency) => _cache.putIfAbsent(
        currency,
        () => NumberFormat.currency(locale: 'es_AR', symbol: r'$', decimalDigits: 2),
      );

  /// Formatea un monto que llega del backend como string decimal.
  static String desdeJson(String amount, {String currency = 'ARS'}) =>
      formatear(Decimal.parse(amount), currency: currency);

  static String formatear(Decimal amount, {String currency = 'ARS'}) =>
      _formatter(currency).format(amount.toDouble());

  /// Version aproximada, para todo valor ESTIMADO.
  /// La UI debe distinguir siempre lo estimado de lo real.
  static String estimado(String amount, {String currency = 'ARS'}) =>
      '≈ ${desdeJson(amount, currency: currency)}';

  /// Cuando una regla no esta configurada se muestra "?", NUNCA $0:
  /// afirmar cero es mentir sobre el numero mas importante de la app.
  static const String desconocido = '?';
}
