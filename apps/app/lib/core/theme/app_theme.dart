import 'package:flutter/material.dart';

/// Tema unico para movil y web. Material 3 con semilla de color propia.
///
/// Los estados de un servicio NUNCA se comunican solo por color: cada uno lleva
/// icono y texto. El color acompana, no informa por si mismo.
abstract final class AppTheme {
  static const Color _seed = Color(0xFF00696D);

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: _seed,
      brightness: brightness,
    );
    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
    );
  }
}

/// Estados visuales de un servicio o ciclo.
/// Cada uno define color, icono y etiqueta: la informacion importante nunca
/// depende unicamente del color.
enum EstadoVisual {
  alDia(Icons.check_circle_outline, 'Al día', Color(0xFF2E7D32)),
  pagoParcial(Icons.timelapse, 'Pago parcial', Color(0xFFF9A825)),
  vencido(Icons.error_outline, 'Vencido', Color(0xFFC62828)),
  porVerificar(Icons.help_outline, 'Por verificar', Color(0xFFEF6C00)),
  estimado(Icons.schedule, 'Estimado', Color(0xFF1565C0)),
  diferencia(
    Icons.warning_amber_outlined,
    'Diferencia detectada',
    Color(0xFFD84315),
  );

  const EstadoVisual(this.icono, this.etiqueta, this.color);

  final IconData icono;
  final String etiqueta;
  final Color color;
}
