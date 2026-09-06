import 'package:flutter/material.dart';

/// Marcador de pantalla todavia no construida.
/// Dice explicitamente en que etapa del roadmap se implementa: es preferible
/// a una pantalla vacia que parece un error.
class PantallaPendiente extends StatelessWidget {
  const PantallaPendiente({
    required this.titulo,
    required this.icono,
    required this.etapa,
    required this.descripcion,
    super.key,
  });

  final String titulo;
  final IconData icono;
  final String etapa;
  final String descripcion;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(titulo)),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icono, size: 48, color: theme.colorScheme.primary),
                const SizedBox(height: 16),
                Chip(label: Text(etapa)),
                const SizedBox(height: 12),
                Text(descripcion, textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
